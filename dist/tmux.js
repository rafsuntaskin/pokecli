import { execFileSync, spawnSync } from "node:child_process";
import { getTmuxSocketPath } from "./paths.js";
import { missingTmuxMessage } from "./tmux-install.js";
export function assertTmuxAvailable() {
    const result = spawnSync("tmux", ["-V"], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
        throw new Error(missingTmuxMessage());
    }
}
export function sessionExists(config) {
    const result = spawnSync("tmux", [...socketArgs(config), "has-session", "-t", config.tmuxTarget], { stdio: "ignore" });
    return result.status === 0;
}
export function startSession(config) {
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
export function attachSession(config) {
    assertTmuxAvailable();
    if (!sessionExists(config)) {
        throw new Error(`Session is not running. Start it with "poke start".`);
    }
    spawnSync("tmux", [...socketArgs(config), "attach", "-t", config.tmuxTarget], { stdio: "inherit" });
}
export function sendKeys(config, text) {
    assertTmuxAvailable();
    if (!sessionExists(config)) {
        throw new Error(`Session is not running. Start it with "poke start".`);
    }
    execFileSync("tmux", [...socketArgs(config), "send-keys", "-t", config.tmuxTarget, text, "Enter"]);
}
export function capturePane(config, lines = 200) {
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
export function displayMessage(config, message, durationMs = 5000) {
    const list = spawnSync("tmux", [...socketArgs(config), "list-clients", "-t", config.tmuxTarget, "-F", "#{client_name}"], { encoding: "utf8" });
    if (list.status !== 0)
        return;
    const clients = list.stdout.split("\n").filter(Boolean);
    for (const client of clients) {
        const args = [...socketArgs(config), "display-message", "-d", String(durationMs), "-c", client, "-t", config.tmuxTarget, message];
        const result = spawnSync("tmux", args, { stdio: "ignore" });
        if (result.status !== 0) {
            spawnSync("tmux", [...socketArgs(config), "display-message", "-c", client, "-t", config.tmuxTarget, message], { stdio: "ignore" });
        }
    }
}
function socketArgs(config) {
    return ["-S", getTmuxSocketPath(config.projectRoot)];
}
//# sourceMappingURL=tmux.js.map