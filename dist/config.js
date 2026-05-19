import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getConfigPath, ensurePokeDir } from "./paths.js";
export function configExists(projectRoot) {
    return existsSync(getConfigPath(projectRoot));
}
export function readConfig(projectRoot) {
    const path = getConfigPath(projectRoot);
    if (!existsSync(path)) {
        throw new Error(`No PokeCLI config found. Run "poke" from this project to set it up.`);
    }
    return JSON.parse(readFileSync(path, "utf8"));
}
export function writeConfig(config) {
    ensurePokeDir(config.projectRoot);
    writeFileSync(getConfigPath(config.projectRoot), `${JSON.stringify(config, null, 2)}\n`);
}
export function updateConfig(projectRoot, update) {
    const config = { ...readConfig(projectRoot), ...update };
    writeConfig(config);
    return config;
}
//# sourceMappingURL=config.js.map