#!/usr/bin/env node
import { Command } from "commander";
import { configExists, readConfig } from "./config.js";
import { createRule, logEvent, openDb } from "./db.js";
import { parseDuration } from "./duration.js";
import {
  cancelPendingAction,
  printActions,
  printRules,
  runProjectMenu,
  setAutomation,
  setRuleState,
  startConfiguredSession,
} from "./menu.js";
import { getProjectRoot } from "./paths.js";
import { assertSupportedPlatform } from "./platform.js";
import { runFirstSetup } from "./setup.js";
import { attachSession, capturePane, sendKeys } from "./tmux.js";
import { runWatcher } from "./watcher.js";
import type { MatchType } from "./types.js";

const projectRoot = getProjectRoot();
assertSupportedPlatform();

const program = new Command();
program
  .name("poke")
  .description("Watch one tmux-backed AI agent session and send scheduled responses.")
  .version("0.1.0");

program
  .action(async () => {
    if (configExists(projectRoot)) {
      await runProjectMenu(projectRoot);
    } else {
      await runFirstSetup(projectRoot);
    }
  });

program
  .command("start")
  .description("Start the configured session")
  .action(async () => {
    await startConfiguredSession(projectRoot);
  });

program
  .command("attach")
  .description("Attach to the configured tmux session")
  .action(() => {
    attachSession(readConfig(projectRoot));
  });

program
  .command("send")
  .description("Send text to the configured session")
  .argument("<text...>")
  .action((parts: string[]) => {
    const message = parts.join(" ");
    const config = readConfig(projectRoot);
    const db = openDb(projectRoot);
    sendKeys(config, message);
    logEvent(db, "manual_send", "Manual message sent", { message });
    db.close();
  });

program
  .command("capture")
  .description("Print recent terminal output")
  .option("--lines <lines>", "number of lines", "200")
  .action((options: { lines: string }) => {
    console.log(capturePane(readConfig(projectRoot), Number(options.lines)));
  });

program
  .command("run")
  .description("Run the watcher and scheduler loop")
  .option("--once", "run a single watcher/scheduler tick", false)
  .action(async (options: { once: boolean }) => {
    await runWatcher(projectRoot, { once: options.once });
  });

program
  .command("rules")
  .description("List configured rules")
  .action(() => {
    printRules(projectRoot);
  });

program
  .command("rule")
  .description("Manage rules")
  .argument("<action>", "add, enable, or disable")
  .argument("[name]", "rule name for add or rule id/name for enable/disable")
  .option("--contains <text>", "substring to match")
  .option("--regex <pattern>", "regex to match")
  .option("--response <text>", "response to send")
  .option("--delay <duration>", "delay before sending", "0s")
  .option("--dedupe <duration>", "dedupe window", "10m")
  .option("--require-still-visible <value>", "require prompt to still be visible", "true")
  .action((action: string, name: string | undefined, options: Record<string, string | undefined>) => {
    if (action === "enable" || action === "disable") {
      if (!name) throw new Error(`Rule id/name is required for ${action}.`);
      setRuleState(projectRoot, name, action === "enable");
      return;
    }

    if (action !== "add") {
      throw new Error(`Unknown rule action: ${action}`);
    }

    if (!name) throw new Error("Rule name is required.");
    const hasContains = Boolean(options.contains);
    const hasRegex = Boolean(options.regex);
    if (hasContains === hasRegex) throw new Error("Pass exactly one of --contains or --regex.");
    if (!options.response) throw new Error("--response is required.");

    const matchType: MatchType = hasContains ? "contains" : "regex";
    const matchValue = hasContains ? options.contains! : options.regex!;
    const db = openDb(projectRoot);
    createRule(db, {
      name,
      matchType,
      matchValue,
      response: options.response,
      delaySeconds: parseDuration(options.delay ?? "0s"),
      dedupeSeconds: parseDuration(options.dedupe ?? "10m"),
      requireStillVisible: (options.requireStillVisible ?? "true") !== "false",
    });
    db.close();
    console.log(`Added rule: ${name}`);
  });

program
  .command("actions")
  .description("List scheduled actions")
  .option("--pending", "only show pending actions", false)
  .action((options: { pending: boolean }) => {
    printActions(projectRoot, options.pending);
  });

program
  .command("cancel")
  .description("Cancel a pending scheduled action")
  .argument("<action-id>")
  .action((id: string) => {
    cancelPendingAction(projectRoot, id);
  });

program
  .command("pause")
  .description("Pause automation")
  .action(() => {
    setAutomation(projectRoot, true);
  });

program
  .command("resume")
  .description("Resume automation")
  .action(() => {
    setAutomation(projectRoot, false);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
