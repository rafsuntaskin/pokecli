import { readConfig } from "./config.js";
import {
  getRule,
  listDueActions,
  listRules,
  logEvent,
  markActionExecuted,
  markActionFailed,
  markActionSkipped,
  openDb,
} from "./db.js";
import { findMatch, evaluateRule } from "./rules.js";
import { capturePane, displayMessage, sendKeys, sessionExists } from "./tmux.js";

export async function runWatcher(projectRoot: string, options: { once?: boolean } = {}): Promise<void> {
  const config = readConfig(projectRoot);
  const db = openDb(projectRoot);
  let running = true;

  process.on("SIGINT", () => {
    running = false;
  });

  console.log(options.once ? `Running one watcher tick for ${config.tmuxTarget}.` : `Watching ${config.tmuxTarget}. Press Ctrl-C to stop.`);

  while (running) {
    try {
      if (!sessionExists(config)) {
        logEvent(db, "error", "Configured tmux session is not running", { target: config.tmuxTarget });
      } else {
        const output = capturePane(config);
        for (const rule of listRules(db, true)) {
          const scheduled = evaluateRule(db, rule, output);
          if (scheduled) {
            const runAt = new Date(scheduled.run_at);
            const summary = `Scheduled '${scheduled.response}' to fire at ${formatLocal(runAt)} (${formatRelative(Date.now(), runAt.getTime())})`;
            console.log(summary);
            displayMessage(config, `[poke] ${summary}`);
          }
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
            const output = capturePane(latestConfig);
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
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          markActionFailed(db, action.id, message);
          logEvent(db, "action_failed", message, { actionId: action.id });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logEvent(db, "error", message);
      console.error(message);
    }

    if (options.once) {
      running = false;
    } else if (running) {
      await sleep(config.pollIntervalSeconds * 1000);
    }
  }

  db.close();
  console.log(options.once ? "Watcher tick complete." : "\nWatcher stopped.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatLocal(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(fromMs: number, toMs: number): string {
  const diff = Math.max(0, toMs - fromMs);
  const totalMin = Math.round(diff / 60_000);
  if (totalMin < 1) return "in <1m";
  if (totalMin < 60) return `in ${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins === 0 ? `in ${hours}h` : `in ${hours}h ${mins}m`;
}
