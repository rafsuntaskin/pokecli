export function assertSupportedPlatform(): void {
  if (process.platform === "win32") {
    throw new Error("PokeCLI requires macOS, Linux, or Windows through WSL with tmux installed.");
  }
}
