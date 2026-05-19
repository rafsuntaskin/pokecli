import { readConfig, updateConfig } from "./config.js";
import {
  cancelAction,
  listActions,
  listRules,
  logEvent,
  openDb,
  setRuleEnabled,
} from "./db.js";
import { formatDuration } from "./duration.js";
import { attachSession, sessionExists, setScheduledPaneTitle, startSession, startWatcherWindow } from "./tmux.js";

export async function runProjectMenu(projectRoot: string): Promise<void> {
  const config = readConfig(projectRoot);

  if (!sessionExists(config)) {
    const { runFirstSetup } = await import("./setup.js");
    await runFirstSetup(projectRoot);
    return;
  }

  attachSession(config);
}

export async function startConfiguredSession(projectRoot: string): Promise<void> {
  const config = readConfig(projectRoot);
  const db = openDb(projectRoot);
  startSession(config);
  logEvent(db, "session_started", "Session started", { target: config.tmuxTarget, command: config.command });
  db.close();
  console.log(`Started ${config.command} in ${config.tmuxTarget}. Press Ctrl-b d to detach.`);
}

export function restartWatcher(projectRoot: string): void {
  const config = readConfig(projectRoot);
  if (!sessionExists(config)) {
    throw new Error(`Session is not running. Start it with "poke".`);
  }
  startWatcherWindow(config);
  console.log("Watcher restarted.");
}

export function printRules(projectRoot: string): void {
  const db = openDb(projectRoot);
  const rules = listRules(db);

  if (rules.length === 0) {
    console.log("No rules configured.");
  } else {
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

export function printActions(projectRoot: string, pendingOnly: boolean): void {
  const db = openDb(projectRoot);
  const actions = listActions(db, pendingOnly);

  if (actions.length === 0) {
    console.log(pendingOnly ? "No pending actions." : "No actions.");
  } else {
    for (const action of actions) {
      console.log(`${action.id} | ${action.status} | run_at=${action.run_at} | response=${action.response}`);
    }
  }

  db.close();
}

export function cancelPendingAction(projectRoot: string, id: string): void {
  const config = readConfig(projectRoot);
  const db = openDb(projectRoot);
  cancelAction(db, id);
  logEvent(db, "action_cancelled", "Action cancelled", { actionId: id });
  const nextAction = listActions(db, true)[0];
  setScheduledPaneTitle(config, nextAction ? formatTitleTime(new Date(nextAction.run_at)) : null);
  db.close();
  console.log(`Cancelled action: ${id}`);
}

export function setAutomation(projectRoot: string, paused: boolean): void {
  const config = updateConfig(projectRoot, { automationPaused: paused });
  const db = openDb(projectRoot);
  logEvent(db, paused ? "automation_paused" : "automation_resumed", paused ? "Automation paused" : "Automation resumed");
  db.close();
  console.log(`Automation ${config.automationPaused ? "paused" : "resumed"}.`);
}

export function setRuleState(projectRoot: string, ruleId: string, enabled: boolean): void {
  const db = openDb(projectRoot);
  setRuleEnabled(db, ruleId, enabled);
  db.close();
}

function formatTitleTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
