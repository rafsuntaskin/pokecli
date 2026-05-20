import { readConfig } from "./config.js";
import { getRule, listActions, listDueActions, listRules, logEvent, markActionExecuted, markActionFailed, markActionSkipped, openDb, } from "./db.js";
import { findMatch, evaluateRule } from "./rules.js";
import { capturePane, displayMessage, sendKeys, sessionExists, setScheduledPaneTitle } from "./tmux.js";
export async function runWatcher(projectRoot, options = {}) {
    const config = readConfig(projectRoot);
    const db = openDb(projectRoot);
    let running = true;
    let lastTitleKey = null;
    process.on("SIGINT", () => {
        running = false;
    });
    console.log(options.once ? `Running one watcher tick for ${config.tmuxTarget}.` : `Watching ${config.tmuxTarget}. Press Ctrl-C to stop.`);
    while (running) {
        try {
            if (!sessionExists(config)) {
                console.log("Session is gone. Stopping watcher.");
                break;
            }
            let output;
            try {
                output = capturePane(config, 0);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (/can't find window|no such window|no current window/i.test(message)) {
                    console.log("Agent window is gone. Stopping watcher.");
                    logEvent(db, "watcher_stopped", "Watcher stopped because agent window is gone");
                    break;
                }
                throw error;
            }
            for (const rule of listRules(db, true)) {
                const scheduled = evaluateRule(db, rule, output);
                if (scheduled) {
                    const runAt = new Date(scheduled.run_at);
                    const summary = `Scheduled '${scheduled.response}' to fire at ${formatLocal(runAt)} (${formatRelative(Date.now(), runAt.getTime())})`;
                    console.log(summary);
                    displayMessage(config, `[poke] ${summary}`);
                }
            }
            for (const action of listDueActions(db)) {
                try {
                    const latestConfig = readConfig(projectRoot);
                    if (latestConfig.automationPaused) {
                        markActionSkipped(db, action.id, "automation paused");
                        logEvent(db, "action_skipped", "Skipped due action because automation is paused", { actionId: action.id });
                        continue;
                    }
                    if (!sessionExists(latestConfig)) {
                        markActionSkipped(db, action.id, "tmux session not running");
                        logEvent(db, "action_skipped", "Skipped due action because session is not running", { actionId: action.id });
                        continue;
                    }
                    const rule = getRule(db, action.rule_id);
                    if (!rule) {
                        markActionSkipped(db, action.id, "rule missing");
                        logEvent(db, "action_skipped", "Skipped due action because rule is missing", { actionId: action.id });
                        continue;
                    }
                    if (rule.require_still_visible) {
                        const output = capturePane(latestConfig, 0);
                        if (!findMatch(rule, output)) {
                            markActionSkipped(db, action.id, "prompt no longer visible");
                            logEvent(db, "action_skipped", "Skipped due action because prompt is no longer visible", { actionId: action.id });
                            continue;
                        }
                    }
                    sendKeys(latestConfig, action.response);
                    markActionExecuted(db, action.id);
                    logEvent(db, "action_executed", "Automated response sent", { actionId: action.id, response: action.response });
                    console.log(`Sent scheduled response: ${action.response}`);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    markActionFailed(db, action.id, message);
                    logEvent(db, "action_failed", message, { actionId: action.id });
                }
            }
            lastTitleKey = syncScheduledPaneTitle(config, listActions(db, true), lastTitleKey);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logEvent(db, "error", message);
            console.error(message);
        }
        if (options.once) {
            running = false;
        }
        else if (running) {
            await sleep(config.pollIntervalSeconds * 1000);
        }
    }
    db.close();
    console.log(options.once ? "Watcher tick complete." : "\nWatcher stopped.");
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function formatLocal(date) {
    return date.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}
function syncScheduledPaneTitle(config, pendingActions, lastKey) {
    const nextAction = pendingActions[0];
    const key = nextAction ? `${pendingActions.length}|${nextAction.id}|${nextAction.run_at}` : null;
    if (key === lastKey)
        return lastKey;
    setScheduledPaneTitle(config, nextAction ? formatTitleTime(new Date(nextAction.run_at)) : null);
    return key;
}
function formatTitleTime(date) {
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}
function formatRelative(fromMs, toMs) {
    const diff = Math.max(0, toMs - fromMs);
    const totalMin = Math.round(diff / 60_000);
    if (totalMin < 1)
        return "in <1m";
    if (totalMin < 60)
        return `in ${totalMin}m`;
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return mins === 0 ? `in ${hours}h` : `in ${hours}h ${mins}m`;
}
//# sourceMappingURL=watcher.js.map