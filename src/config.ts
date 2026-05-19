import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getConfigPath, ensurePokeDir } from "./paths.js";
import type { ProjectConfig } from "./types.js";

export function configExists(projectRoot: string): boolean {
  return existsSync(getConfigPath(projectRoot));
}

export function readConfig(projectRoot: string): ProjectConfig {
  const path = getConfigPath(projectRoot);

  if (!existsSync(path)) {
    throw new Error(`No PokeCLI config found. Run "poke" from this project to set it up.`);
  }

  return JSON.parse(readFileSync(path, "utf8")) as ProjectConfig;
}

export function writeConfig(config: ProjectConfig): void {
  ensurePokeDir(config.projectRoot);
  writeFileSync(getConfigPath(config.projectRoot), `${JSON.stringify(config, null, 2)}\n`);
}

export function updateConfig(projectRoot: string, update: Partial<ProjectConfig>): ProjectConfig {
  const config = { ...readConfig(projectRoot), ...update };
  writeConfig(config);
  return config;
}
