export function assertSupportedPlatform() {
    if (process.platform === "win32") {
        throw new Error("PokeCLI requires macOS, Linux, or Windows through WSL with tmux installed.");
    }
}
//# sourceMappingURL=platform.js.map