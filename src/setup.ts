import { writeConfig } from "./config.js";
import { openDb, createRule, logEvent } from "./db.js";
import { parseDuration } from "./duration.js";
import { createTmuxTarget, ensurePokeDir } from "./paths.js";
import { assertTmuxAvailable, attachSession, startSession } from "./tmux.js";
import type { AgentKind, MatchType, ProjectConfig, RuleInput } from "./types.js";
import { claudeAutoResumeRule, codexAutoResumeRule } from "./rules.js";
import { askConfirm, askInput, askSelect } from "./prompt.js";

export async function runFirstSetup(projectRoot: string): Promise<void> {
  console.log("Welcome to PokeCLI\n");
  console.log(`Project: ${projectRoot}\n`);

  const useDirectory = await askConfirm({
    message: "Use this directory?",
    default: true,
  });

  if (!useDirectory) {
    console.log("Setup cancelled.");
    return;
  }

  assertTmuxAvailable();

  const agent = await askSelect<AgentKind>({
    message: "Which agent do you want to run?",
    choices: [
      { name: "Claude", value: "claude" },
      { name: "Codex", value: "codex" },
      { name: "Custom command", value: "custom" },
    ],
  });

  const command = agent === "custom"
    ? await askInput({ message: "Command to run", required: true })
    : agent;

  const config: ProjectConfig = {
    version: 1,
    projectRoot,
    agent,
    command,
    tmuxTarget: createTmuxTarget(projectRoot),
    automationPaused: false,
    pollIntervalSeconds: 5,
  };

  ensurePokeDir(projectRoot);
  writeConfig(config);
  const db = openDb(projectRoot);

  const enableAutoResume = await askConfirm({
    message: "Enable auto-resume when a usage limit is hit?",
    default: true,
  });

  if (enableAutoResume) {
    const rule = await buildAutoResumeRule(agent);
    createRule(db, rule);
    logEvent(db, "setup_completed", "Initial setup completed with auto-resume rule", {
      agent,
      command,
      ruleName: rule.name,
    });
  } else {
    logEvent(db, "setup_completed", "Initial setup completed without automation", { agent, command });
  }

  const shouldStart = await askConfirm({ message: "Start the agent now?", default: true });
  if (shouldStart) {
    startSession(config);
    logEvent(db, "session_started", "Session started", { target: config.tmuxTarget, command });
    console.log(`Started session: ${config.tmuxTarget}`);

    const shouldAttach = await askConfirm({ message: "Attach to the session now?", default: true });
    if (shouldAttach) {
      attachSession(config);
    }
  }

  db.close();
}

async function buildAutoResumeRule(agent: AgentKind): Promise<RuleInput> {
  const delay = await askInput({
    message: "Resume delay",
    default: "1h",
    validate: validateDuration,
  });
  const response = await askInput({
    message: "Response to send",
    default: "continue",
    required: true,
  });
  const dedupe = await askInput({
    message: "Dedupe window",
    default: "90m",
    validate: validateDuration,
  });

  if (agent === "claude") {
    const base = claudeAutoResumeRule(parseDuration(delay), response, parseDuration(dedupe));
    return maybeCustomizeRule(base);
  }

  if (agent === "codex") {
    const base = codexAutoResumeRule(parseDuration(delay), response, parseDuration(dedupe));
    return maybeCustomizeRule(base);
  }

  const matchType = await askSelect<MatchType>({
    message: "Match type:",
    choices: [
      { name: "Contains text", value: "contains" },
      { name: "Regex", value: "regex" },
    ],
  });
  const matchValue = await askInput({
    message: matchType === "contains" ? "Text to watch for" : "Regex to watch for",
    required: true,
  });

  return {
    name: "auto-resume-limit",
    matchType,
    matchValue,
    response,
    delaySeconds: parseDuration(delay),
    dedupeSeconds: parseDuration(dedupe),
    requireStillVisible: true,
  };
}

async function maybeCustomizeRule(rule: RuleInput): Promise<RuleInput> {
  const customize = await askConfirm({
    message: "Customize the default match pattern?",
    default: false,
  });

  if (!customize) return rule;

  const matchValue = await askInput({
    message: "Regex to watch for",
    default: rule.matchValue,
    required: true,
  });

  return { ...rule, matchValue };
}

function validateDuration(value: string): true | string {
  try {
    parseDuration(value);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid duration.";
  }
}
