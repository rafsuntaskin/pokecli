import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export function getProjectRoot(cwd = process.cwd()): string {
  return resolve(cwd);
}

export function getPokeDir(projectRoot: string): string {
  return join(projectRoot, ".poke");
}

export function getConfigPath(projectRoot: string): string {
  return join(getPokeDir(projectRoot), "config.json");
}

export function getDbPath(projectRoot: string): string {
  return join(getPokeDir(projectRoot), "poke.db");
}

export function getTmuxSocketPath(projectRoot: string): string {
  return join(getPokeDir(projectRoot), "tmux.sock");
}

export function ensurePokeDir(projectRoot: string): void {
  mkdirSync(getPokeDir(projectRoot), { recursive: true });
}

export function createTmuxTarget(projectRoot: string): string {
  const hash = createHash("sha256").update(projectRoot).digest("hex").slice(0, 10);
  return `poke-${hash}`;
}
