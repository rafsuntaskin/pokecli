import { confirm, input, select } from "@inquirer/prompts";
import { writeConfig } from "./config.js";
import { openDb, createRule, logEvent } from "./db.js";
import { parseDuration } from "./duration.js";
import { createTmuxTarget, ensurePokeDir } from "./paths.js";
import { assertTmuxAvailable, attachSession, startSession } from "./tmux.js";
import { claudeAutoResumeRule, codexAutoResumeRule } from "./rules.js";
export async function runFirstSetup(projectRoot) {
    console.log("Welcome to PokeCLI\n");
    console.log(`Project: ${projectRoot}\n`);
    const useDirectory = await confirm({
        message: "Use this directory?",
        default: true,
    });
    if (!useDirectory) {
        console.log("Setup cancelled.");
        return;
    }
    assertTmuxAvailable();
    const agent = await select({
        message: "Which agent do you want to run?",
        choices: [
            { name: "Claude", value: "claude" },
            { name: "Codex", value: "codex" },
            { name: "Custom command", value: "custom" },
        ],
    });
    const command = agent === "custom"
        ? await input({ message: "Command to run:", required: true })
        : agent;
    const config = {
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
    const enableAutoResume = await confirm({
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
    }
    else {
        logEvent(db, "setup_completed", "Initial setup completed without automation", { agent, command });
    }
    const shouldStart = await confirm({ message: "Start the agent now?", default: true });
    if (shouldStart) {
        startSession(config);
        logEvent(db, "session_started", "Session started", { target: config.tmuxTarget, command });
        console.log(`Started session: ${config.tmuxTarget}`);
        const shouldAttach = await confirm({ message: "Attach to the session now?", default: true });
        if (shouldAttach) {
            attachSession(config);
        }
    }
    db.close();
}
async function buildAutoResumeRule(agent) {
    const delay = await input({
        message: "Resume delay:",
        default: "1h",
        validate: validateDuration,
    });
    const response = await input({
        message: "Response to send:",
        default: "continue",
        required: true,
    });
    const dedupe = await input({
        message: "Dedupe window:",
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
    const matchType = await select({
        message: "Match type:",
        choices: [
            { name: "Contains text", value: "contains" },
            { name: "Regex", value: "regex" },
        ],
    });
    const matchValue = await input({
        message: matchType === "contains" ? "Text to watch for:" : "Regex to watch for:",
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
async function maybeCustomizeRule(rule) {
    const customize = await confirm({
        message: "Customize the default match pattern?",
        default: false,
    });
    if (!customize)
        return rule;
    const matchValue = await input({
        message: "Regex to watch for:",
        default: rule.matchValue,
        required: true,
    });
    return { ...rule, matchValue };
}
function validateDuration(value) {
    try {
        parseDuration(value);
        return true;
    }
    catch (error) {
        return error instanceof Error ? error.message : "Invalid duration.";
    }
}
//# sourceMappingURL=setup.js.map