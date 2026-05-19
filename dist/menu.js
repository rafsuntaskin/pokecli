import { readConfig, updateConfig } from "./config.js";
import { cancelAction, createRule, listActions, listRules, logEvent, openDb, setRuleEnabled, } from "./db.js";
import { parseDuration, formatDuration } from "./duration.js";
import { capturePane, attachSession, sendKeys, sessionExists, startSession } from "./tmux.js";
import { runWatcher } from "./watcher.js";
import { askConfirm, askInput, askSelect } from "./prompt.js";
export async function runProjectMenu(projectRoot) {
    const config = readConfig(projectRoot);
    const db = openDb(projectRoot);
    const pendingCount = listActions(db, true).length;
    const running = sessionExists(config);
    console.log("PokeCLI\n");
    console.log(`Project: ${config.projectRoot}`);
    console.log(`Command: ${config.command}`);
    console.log(`Session: ${running ? "running" : "stopped"}`);
    console.log(`Automation: ${config.automationPaused ? "paused" : "on"}`);
    console.log(`Pending actions: ${pendingCount}\n`);
    db.close();
    const choice = await askSelect({
        message: "What do you want to do?",
        choices: [
            { name: "Attach to session", value: "attach" },
            { name: "Start session", value: "start" },
            { name: "Send message", value: "send" },
            { name: "Start watcher", value: "watch" },
            { name: "View rules", value: "rules" },
            { name: "Add rule", value: "add-rule" },
            { name: "View pending actions", value: "actions" },
            { name: "Pause automation", value: "pause" },
            { name: "Resume automation", value: "resume" },
            { name: "Capture output", value: "capture" },
            { name: "Exit", value: "exit" },
        ],
    });
    if (choice === "attach")
        attachSession(readConfig(projectRoot));
    if (choice === "start")
        await startConfiguredSession(projectRoot);
    if (choice === "send")
        await promptSend(projectRoot);
    if (choice === "watch")
        await runWatcher(projectRoot);
    if (choice === "rules")
        printRules(projectRoot);
    if (choice === "add-rule")
        await promptAddRule(projectRoot);
    if (choice === "actions")
        printActions(projectRoot, true);
    if (choice === "pause")
        setAutomation(projectRoot, true);
    if (choice === "resume")
        setAutomation(projectRoot, false);
    if (choice === "capture")
        console.log(capturePane(readConfig(projectRoot)));
}
export async function startConfiguredSession(projectRoot) {
    const config = readConfig(projectRoot);
    const db = openDb(projectRoot);
    startSession(config);
    logEvent(db, "session_started", "Session started", { target: config.tmuxTarget, command: config.command });
    db.close();
    console.log(`Started session: ${config.tmuxTarget}`);
}
async function promptSend(projectRoot) {
    const message = await askInput({ message: "Message", required: true });
    const config = readConfig(projectRoot);
    const db = openDb(projectRoot);
    sendKeys(config, message);
    logEvent(db, "manual_send", "Manual message sent", { message });
    db.close();
}
export function printRules(projectRoot) {
    const db = openDb(projectRoot);
    const rules = listRules(db);
    if (rules.length === 0) {
        console.log("No rules configured.");
    }
    else {
        for (const rule of rules) {
            console.log([
                `${rule.enabled ? "on " : "off"} ${rule.name}`,
                `match=${rule.match_type}:${rule.match_value}`,
                `response=${rule.response}`,
                `delay=${formatDuration(rule.delay_seconds)}`,
                `dedupe=${formatDuration(rule.dedupe_seconds)}`,
                ...(rule.expiry_pattern ? [`expiry=${rule.expiry_pattern}`] : []),
            ].join(" | "));
        }
    }
    db.close();
}
async function promptAddRule(projectRoot) {
    const name = await askInput({ message: "Rule name", required: true });
    const matchType = await askSelect({
        message: "Match type:",
        choices: [
            { name: "Contains text", value: "contains" },
            { name: "Regex", value: "regex" },
        ],
    });
    const matchValue = await askInput({ message: "Match value", required: true });
    const response = await askInput({ message: "Response to send", default: "continue", required: true });
    const delay = await askInput({ message: "Delay", default: "0s", validate: validateDuration });
    const dedupe = await askInput({ message: "Dedupe window", default: "90m", validate: validateDuration });
    const requireStillVisible = await askConfirm({ message: "Require prompt to still be visible before sending?", default: true });
    const db = openDb(projectRoot);
    createRule(db, {
        name,
        matchType,
        matchValue,
        response,
        delaySeconds: parseDuration(delay),
        dedupeSeconds: parseDuration(dedupe),
        requireStillVisible,
    });
    db.close();
    console.log(`Added rule: ${name}`);
}
export function printActions(projectRoot, pendingOnly) {
    const db = openDb(projectRoot);
    const actions = listActions(db, pendingOnly);
    if (actions.length === 0) {
        console.log(pendingOnly ? "No pending actions." : "No actions.");
    }
    else {
        for (const action of actions) {
            console.log(`${action.id} | ${action.status} | run_at=${action.run_at} | response=${action.response}`);
        }
    }
    db.close();
}
export function cancelPendingAction(projectRoot, id) {
    const db = openDb(projectRoot);
    cancelAction(db, id);
    logEvent(db, "action_cancelled", "Action cancelled", { actionId: id });
    db.close();
    console.log(`Cancelled action: ${id}`);
}
export function setAutomation(projectRoot, paused) {
    const config = updateConfig(projectRoot, { automationPaused: paused });
    const db = openDb(projectRoot);
    logEvent(db, paused ? "automation_paused" : "automation_resumed", paused ? "Automation paused" : "Automation resumed");
    db.close();
    console.log(`Automation ${config.automationPaused ? "paused" : "resumed"}.`);
}
export function setRuleState(projectRoot, ruleId, enabled) {
    const db = openDb(projectRoot);
    setRuleEnabled(db, ruleId, enabled);
    db.close();
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
//# sourceMappingURL=menu.js.map