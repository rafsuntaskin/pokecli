import { spawnSync } from "node:child_process";

const MANAGERS = [
  { binary: "brew", command: "brew install tmux" },
  { binary: "apt-get", command: "sudo apt-get install -y tmux" },
  { binary: "dnf", command: "sudo dnf install -y tmux" },
  { binary: "pacman", command: "sudo pacman -S --noconfirm tmux" },
  { binary: "apk", command: "sudo apk add tmux" },
];

function hasCommand(binary) {
  const result = spawnSync(binary, ["--version"], { stdio: "ignore" });
  return result.error?.code !== "ENOENT";
}

function isTmuxAvailable() {
  const result = spawnSync("tmux", ["-V"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

if (!isTmuxAvailable()) {
  const pm = MANAGERS.find((m) => hasCommand(m.binary));
  const install = pm
    ? `Install with: ${pm.command}`
    : "See https://github.com/tmux/tmux/wiki/Installing";

  console.warn("");
  console.warn("Heads up: tmux was not found on PATH.");
  console.warn(`PokeCLI requires tmux to run. ${install}`);
  console.warn("");
}

process.exit(0);
