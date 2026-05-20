#!/usr/bin/env node
const originalEmit = process.emit;
process.emit = function emit(this: NodeJS.Process, event: string, ...args: unknown[]): boolean {
  if (event === "warning") {
    const warning = args[0] as { name?: string; message?: string } | undefined;
    if (warning?.name === "ExperimentalWarning" && /SQLite/.test(warning.message ?? "")) {
      return false;
    }
  }
  return (originalEmit as (this: NodeJS.Process, e: string, ...a: unknown[]) => boolean).call(this, event, ...args);
} as typeof process.emit;

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getProjectRoot } from "./paths.js";
import { assertSupportedPlatform } from "./platform.js";
import type { MatchType } from "./types.js";

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}

const VERSION = readVersion();
const projectRoot = getProjectRoot();

async function main(): Promise<void> {
  assertSupportedPlatform();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "-h" || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  if (command === "-V" || command === "--version" || command === "version") {
    console.log(VERSION);
    return;
  }

  const { configExists, readConfig } = await import("./config.js");

  if (!command) {
    if (configExists(projectRoot)) {
      const { runProjectMenu } = await import("./menu.js");
      await runProjectMenu(projectRoot);
    } else {
      const { runFirstSetup } = await import("./setup.js");
      await runFirstSetup(projectRoot);
    }
    return;
  }

  if (command === "start") {
    const { startConfiguredSession } = await import("./menu.js");
    await startConfiguredSession(projectRoot);
    return;
  }

  if (command === "attach") {
    const { attachSession } = await import("./tmux.js");
    attachSession(readConfig(projectRoot));
    return;
  }

  if (command === "send") {
    const message = args.slice(1).join(" ").trim();
    if (!message) throw new Error("Usage: poke send <text>");
    const { openDb, logEvent } = await import("./db.js");
    const { sendKeys } = await import("./tmux.js");
    const config = readConfig(projectRoot);
    const db = openDb(projectRoot);
    sendKeys(config, message);
    logEvent(db, "manual_send", "Manual message sent", { message });
    db.close();
    return;
  }

  if (command === "capture") {
    const { capturePane } = await import("./tmux.js");
    const options = parseOptions(args.slice(1));
    const lines = Number(options.lines ?? "200");
    console.log(capturePane(readConfig(projectRoot), lines));
    return;
  }

  if (command === "run") {
    const { runWatcher } = await import("./watcher.js");
    const options = parseOptions(args.slice(1));
    await runWatcher(projectRoot, { once: Boolean(options.once) });
    return;
  }

  if (command === "rules") {
    const { printRules } = await import("./menu.js");
    printRules(projectRoot);
    return;
  }

  if (command === "rule") {
    await handleRuleCommand(args.slice(1));
    return;
  }

  if (command === "actions") {
    const { printActions } = await import("./menu.js");
    const options = parseOptions(args.slice(1));
    printActions(projectRoot, Boolean(options.pending));
    return;
  }

  if (command === "cancel") {
    const { cancelPendingAction } = await import("./menu.js");
    const id = args[1];
    if (!id) throw new Error("Usage: poke cancel <action-id>");
    cancelPendingAction(projectRoot, id);
    return;
  }

  if (command === "pause") {
    const { setAutomation } = await import("./menu.js");
    setAutomation(projectRoot, true);
    return;
  }

  if (command === "resume") {
    const { setAutomation } = await import("./menu.js");
    setAutomation(projectRoot, false);
    return;
  }

  if (command === "restart-watcher") {
    const { restartWatcher } = await import("./menu.js");
    restartWatcher(projectRoot);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function handleRuleCommand(args: string[]): Promise<void> {
  const action = args[0];
  const name = args[1];
  const options = parseOptions(args.slice(2));

  if (action === "enable" || action === "disable") {
    if (!name) throw new Error(`Rule id/name is required for ${action}.`);
    const { setRuleState } = await import("./menu.js");
    setRuleState(projectRoot, name, action === "enable");
    return;
  }

  if (action !== "add") {
    throw new Error("Usage: poke rule add <name> (--contains <text> | --regex <pattern>) --response <text>");
  }

  if (!name) throw new Error("Rule name is required.");
  const hasContains = typeof options.contains === "string";
  const hasRegex = typeof options.regex === "string";
  if (hasContains === hasRegex) throw new Error("Pass exactly one of --contains or --regex.");
  if (!options.response) throw new Error("--response is required.");

  const { createRule, openDb } = await import("./db.js");
  const { parseDuration } = await import("./duration.js");
  const matchType: MatchType = hasContains ? "contains" : "regex";
  const matchValue = String(hasContains ? options.contains : options.regex);
  const response = String(options.response);
  const delay = typeof options.delay === "string" ? options.delay : "0s";
  const dedupe = typeof options.dedupe === "string" ? options.dedupe : "10m";
  const db = openDb(projectRoot);

  createRule(db, {
    name,
    matchType,
    matchValue,
    response,
    delaySeconds: parseDuration(delay),
    dedupeSeconds: parseDuration(dedupe),
    requireStillVisible: (options["require-still-visible"] ?? "true") !== "false",
    expiryPattern: typeof options["expiry-pattern"] === "string" ? String(options["expiry-pattern"]) : null,
  });

  db.close();
  console.log(`Added rule: ${name}`);
}

function parseOptions(args: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: poke [command]

Watch one tmux-backed AI agent session and send scheduled responses.

Running \`poke\` with no command runs first-time setup or, for an
existing project, starts the session if it's not running and attaches.

Commands:
  start                           Start the configured session
  attach                          Attach to the configured tmux session
  send <text>                     Send text to the configured session
  capture [--lines 200]           Print recent terminal output
  run [--once]                    Run the watcher and scheduler loop
  restart-watcher                 Restart the hidden watcher window
  rules                           List configured rules
  rule add <name> [options]       Add a rule
  rule enable <id|name>           Enable a rule
  rule disable <id|name>          Disable a rule
  actions [--pending]             List scheduled actions
  cancel <action-id>              Cancel a pending scheduled action
  pause                           Pause automation
  resume                          Resume automation

Options:
  -h, --help                      Show help
  -V, --version                   Show version`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
