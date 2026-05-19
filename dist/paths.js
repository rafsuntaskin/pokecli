import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
export function getProjectRoot(cwd = process.cwd()) {
    return resolve(cwd);
}
export function getPokeDir(projectRoot) {
    return join(projectRoot, ".poke");
}
export function getConfigPath(projectRoot) {
    return join(getPokeDir(projectRoot), "config.json");
}
export function getDbPath(projectRoot) {
    return join(getPokeDir(projectRoot), "poke.db");
}
export function getTmuxSocketPath(projectRoot) {
    return join(getPokeDir(projectRoot), "tmux.sock");
}
export function ensurePokeDir(projectRoot) {
    mkdirSync(getPokeDir(projectRoot), { recursive: true });
}
export function createTmuxTarget(projectRoot) {
    const hash = createHash("sha256").update(projectRoot).digest("hex").slice(0, 10);
    return `poke-${hash}`;
}
//# sourceMappingURL=paths.js.map