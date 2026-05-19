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
import { attachSession, sessionExists, startSession } from "./tmux.js";
import { runWatcher } from "./watcher.js";
import { askSelect } from "./prompt.js";

type MenuChoice = "session" | "watch" | "toggle-automation" | "exit";

export async function runProjectMenu(projectRoot: string): Promise<void> {
  const config = readConfig(projectRoot);
  const db = openDb(projectRoot);
  const pendingCount = listActions(db, true).length;
  const running = sessionExists(config);
  db.close();

  console.log("PokeCLI\n");
  console.log(`Project: ${config.projectRoot}`);
  console.log(`Command: ${config.command}`);
  console.log(`Session: ${running ? "running" : "stopped"}`);
  console.log(`Automation: ${config.automationPaused ? "paused" : "on"}`);
  console.log(`Pending actions: ${pendingCount}\n`);

  const sessionLabel = running ? "Attach to session" : "Start session";
  const automationLabel = config.automationPaused ? "Resume automation" : "Pause automation";

  const choice = await askSelect<MenuChoice>({
    message: "What do you want to do?",
    choices: [
      { name: sessionLabel, value: "session" },
      { name: "Start watcher", value: "watch" },
      { name: automationLabel, value: "toggle-automation" },
      { name: "Exit", value: "exit" },
    ],
  });

  if (choice === "session") {
    if (running) {
      attachSession(readConfig(projectRoot));
    } else {
      await startConfiguredSession(projectRoot);
      attachSession(readConfig(projectRoot));
    }
  }
  if (choice === "watch") await runWatcher(projectRoot);
  if (choice === "toggle-automation") setAutomation(projectRoot, !config.automationPaused);
}

export async function startConfiguredSession(projectRoot: string): Promise<void> {
  const config = readConfig(projectRoot);
  const db = openDb(projectRoot);
  startSession(config);
  logEvent(db, "session_started", "Session started", { target: config.tmuxTarget, command: config.command });
  db.close();
  console.log(`Started session: ${config.tmuxTarget}`);
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
  const db = openDb(projectRoot);
  cancelAction(db, id);
  logEvent(db, "action_cancelled", "Action cancelled", { actionId: id });
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
