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
function agentTarget(config) {
    return `${config.tmuxTarget}:0`;
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
        "-n",
        "agent",
        "-c",
        config.projectRoot,
        config.command,
    ]);
    if (!sessionExists(config)) {
        throw new Error("tmux did not create the session. Check tmux socket permissions and try again.");
    }
    startWatcherWindow(config);
}
export function startWatcherWindow(config) {
    spawnSync("tmux", [...socketArgs(config), "kill-window", "-t", `${config.tmuxTarget}:1`], { stdio: "ignore" });
    const result = spawnSync("tmux", [
        ...socketArgs(config),
        "new-window",
        "-d",
        "-n",
        "watcher",
        "-c",
        config.projectRoot,
        "-t",
        `${config.tmuxTarget}:1`,
        "poke run",
    ], { stdio: "ignore" });
    if (result.status !== 0) {
        console.warn("Warning: watcher window did not start. Auto-resume is inactive until this is fixed.");
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
    execFileSync("tmux", [...socketArgs(config), "send-keys", "-t", agentTarget(config), text, "Enter"]);
}
export function capturePane(config, lines = 200) {
    assertTmuxAvailable();
    if (!sessionExists(config)) {
        throw new Error(`Session is not running. Start it with "poke start".`);
    }
    const args = [...socketArgs(config), "capture-pane", "-t", agentTarget(config), "-p"];
    if (lines > 0) {
        args.push("-S", `-${lines}`);
    }
    return execFileSync("tmux", args, { encoding: "utf8" });
}
export function displayMessage(config, message, durationMs = 5000) {
    const list = spawnSync("tmux", [...socketArgs(config), "list-clients", "-t", config.tmuxTarget, "-F", "#{client_name}"], { encoding: "utf8" });
    if (list.status !== 0)
        return;
    const clients = list.stdout.split("\n").filter(Boolean);
    for (const client of clients) {
        const args = [...socketArgs(config), "display-message", "-d", String(durationMs), "-c", client, "-t", agentTarget(config), message];
        const result = spawnSync("tmux", args, { stdio: "ignore" });
        if (result.status !== 0) {
            spawnSync("tmux", [...socketArgs(config), "display-message", "-c", client, "-t", agentTarget(config), message], { stdio: "ignore" });
        }
    }
}
function socketArgs(config) {
    return ["-S", getTmuxSocketPath(config.projectRoot)];
}
//# sourceMappingURL=tmux.js.map