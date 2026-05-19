import { execFileSync, spawnSync } from "node:child_process";
import { getTmuxSocketPath } from "./paths.js";
import type { ProjectConfig } from "./types.js";

export function assertTmuxAvailable(): void {
  const result = spawnSync("tmux", ["-V"], { encoding: "utf8" });

  if (result.error || result.status !== 0) {
    throw new Error("tmux is required but was not found. Install tmux, then run poke again.");
  }
}

export function sessionExists(config: ProjectConfig): boolean {
  const result = spawnSync("tmux", [...socketArgs(config), "has-session", "-t", config.tmuxTarget], { stdio: "ignore" });
  return result.status === 0;
}

export function startSession(config: ProjectConfig): void {
  assertTmuxAvailable();

  if (sessionExists(config)) {
    throw new Error(`Session already running: ${config.tmuxTarget}`);
  }

  execFileSync("tmux", [
    ...socketArgs(config),
    "new-session",
    "-d",
    "-s",
    config.tmuxTarget,
    "-c",
    config.projectRoot,
    config.command,
  ]);

  if (!sessionExists(config)) {
    throw new Error("tmux did not create the session. Check tmux socket permissions and try again.");
  }
}

export function attachSession(config: ProjectConfig): void {
  assertTmuxAvailable();

  if (!sessionExists(config)) {
    throw new Error(`Session is not running. Start it with "poke start".`);
  }

  spawnSync("tmux", [...socketArgs(config), "attach", "-t", config.tmuxTarget], { stdio: "inherit" });
}

export function sendKeys(config: ProjectConfig, text: string): void {
  assertTmuxAvailable();

  if (!sessionExists(config)) {
    throw new Error(`Session is not running. Start it with "poke start".`);
  }

  execFileSync("tmux", [...socketArgs(config), "send-keys", "-t", config.tmuxTarget, text, "Enter"]);
}

export function capturePane(config: ProjectConfig, lines = 200): string {
  assertTmuxAvailable();

  if (!sessionExists(config)) {
    throw new Error(`Session is not running. Start it with "poke start".`);
  }

  return execFileSync("tmux", [
    ...socketArgs(config),
    "capture-pane",
    "-t",
    config.tmuxTarget,
    "-p",
    "-S",
    `-${lines}`,
  ], { encoding: "utf8" });
}

function socketArgs(config: ProjectConfig): string[] {
  return ["-S", getTmuxSocketPath(config.projectRoot)];
}
