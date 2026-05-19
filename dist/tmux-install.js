import { spawnSync } from "node:child_process";
import { askConfirm } from "./prompt.js";
const MANAGERS = [
    { name: "Homebrew", binary: "brew", installArgs: ["install", "tmux"], command: "brew install tmux", requiresSudo: false },
    { name: "apt", binary: "apt-get", installArgs: ["install", "-y", "tmux"], command: "sudo apt-get install -y tmux", requiresSudo: true },
    { name: "dnf", binary: "dnf", installArgs: ["install", "-y", "tmux"], command: "sudo dnf install -y tmux", requiresSudo: true },
    { name: "pacman", binary: "pacman", installArgs: ["-S", "--noconfirm", "tmux"], command: "sudo pacman -S --noconfirm tmux", requiresSudo: true },
    { name: "apk", binary: "apk", installArgs: ["add", "tmux"], command: "sudo apk add tmux", requiresSudo: true },
];
const FALLBACK_HELP = "See https://github.com/tmux/tmux/wiki/Installing for instructions.";
function hasCommand(binary) {
    const result = spawnSync(binary, ["--version"], { stdio: "ignore" });
    const code = result.error?.code;
    return code !== "ENOENT";
}
function isTmuxAvailable() {
    const result = spawnSync("tmux", ["-V"], { stdio: "ignore" });
    return !result.error && result.status === 0;
}
function detectPackageManager() {
    return MANAGERS.find((pm) => hasCommand(pm.binary)) ?? null;
}
export function missingTmuxMessage() {
    const pm = detectPackageManager();
    if (!pm)
        return `tmux is required but was not found. ${FALLBACK_HELP}`;
    return `tmux is required but was not found. Install with: ${pm.command}`;
}
export async function ensureTmuxAvailable() {
    if (isTmuxAvailable())
        return;
    const pm = detectPackageManager();
    if (!pm) {
        throw new Error(`tmux is required but was not found. ${FALLBACK_HELP}`);
    }
    console.log(`tmux is required but was not found.`);
    if (pm.requiresSudo) {
        throw new Error(`Install with: ${pm.command}`);
    }
    const runIt = await askConfirm({ message: `Install tmux with ${pm.name} now (${pm.command})?`, default: true });
    if (!runIt) {
        throw new Error(`Install with: ${pm.command}`);
    }
    const result = spawnSync(pm.binary, pm.installArgs, { stdio: "inherit" });
    if (result.status !== 0 || !isTmuxAvailable()) {
        throw new Error(`Failed to install tmux via ${pm.name}. Install it manually and rerun poke.`);
    }
    console.log("tmux installed.");
}
//# sourceMappingURL=tmux-install.js.map