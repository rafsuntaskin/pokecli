import { writeConfig } from "./config.js";
import { openDb, createRule, logEvent } from "./db.js";
import { parseDuration } from "./duration.js";
import { createTmuxTarget, ensurePokeDir } from "./paths.js";
import { assertTmuxAvailable, attachSession, startSession } from "./tmux.js";
import type { AgentKind, ProjectConfig, RuleInput } from "./types.js";
import { claudeAutoResumeRule, codexAutoResumeRule } from "./rules.js";
import { askConfirm, askInput, askSelect } from "./prompt.js";

const FALLBACK_DELAY_SECONDS = parseDuration("30m");
const DEDUPE_SECONDS = parseDuration("90m");
const DEFAULT_RESPONSE = "continue";

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

  const rule = enableAutoResume ? buildAutoResumeRule(agent) : null;
  if (rule) {
    createRule(db, rule);
    logEvent(db, "setup_completed", "Initial setup completed with auto-resume rule", {
      agent,
      command,
      ruleName: rule.name,
    });
  } else {
    if (enableAutoResume) {
      console.log("Auto-resume is only available for Claude or Codex; skipping rule setup. Add a custom rule with `poke rule add`.");
    }
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

function buildAutoResumeRule(agent: AgentKind): RuleInput | null {
  if (agent === "claude") {
    return claudeAutoResumeRule(FALLBACK_DELAY_SECONDS, DEFAULT_RESPONSE, DEDUPE_SECONDS);
  }
  if (agent === "codex") {
    return codexAutoResumeRule(FALLBACK_DELAY_SECONDS, DEFAULT_RESPONSE, DEDUPE_SECONDS);
  }
  return null;
}
