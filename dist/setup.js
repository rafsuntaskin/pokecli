import { writeConfig } from "./config.js";
import { openDb, createRule, logEvent } from "./db.js";
import { parseDuration } from "./duration.js";
import { createTmuxTarget, ensurePokeDir } from "./paths.js";
import { attachSession, startSession } from "./tmux.js";
import { ensureTmuxAvailable } from "./tmux-install.js";
import { claudeAutoResumeRule, codexAutoResumeRule } from "./rules.js";
import { askSelect } from "./prompt.js";
const FALLBACK_DELAY_SECONDS = parseDuration("30m");
const DEDUPE_SECONDS = parseDuration("90m");
const DEFAULT_RESPONSE = "continue";
export async function runFirstSetup(projectRoot) {
    console.log(`PokeCLI · ${projectRoot}\n`);
    await ensureTmuxAvailable();
    const agent = await askSelect({
        message: "Which agent?",
        choices: [
            { name: "Claude", value: "claude" },
            { name: "Codex", value: "codex" },
        ],
    });
    const config = {
        version: 1,
        projectRoot,
        agent,
        command: agent,
        tmuxTarget: createTmuxTarget(projectRoot),
        automationPaused: false,
        pollIntervalSeconds: 5,
    };
    ensurePokeDir(projectRoot);
    writeConfig(config);
    const db = openDb(projectRoot);
    const rule = buildAutoResumeRule(agent);
    createRule(db, rule);
    logEvent(db, "setup_completed", "Initial setup completed with auto-resume rule", { agent, ruleName: rule.name });
    db.close();
    startSession(config);
    console.log(`Started ${config.command} in ${config.tmuxTarget}. Press Ctrl-b d to detach.`);
    attachSession(config);
}
function buildAutoResumeRule(agent) {
    if (agent === "claude") {
        return claudeAutoResumeRule(FALLBACK_DELAY_SECONDS, DEFAULT_RESPONSE, DEDUPE_SECONDS);
    }
    return codexAutoResumeRule(FALLBACK_DELAY_SECONDS, DEFAULT_RESPONSE, DEDUPE_SECONDS);
}
//# sourceMappingURL=setup.js.map