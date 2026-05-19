const DURATION_PATTERN = /^(\d+)(s|m|h)$/;
export function parseDuration(value) {
    const trimmed = value.trim();
    const match = DURATION_PATTERN.exec(trimmed);
    if (!match) {
        throw new Error(`Invalid duration "${value}". Use a simple value like 10s, 5m, 1h, or 90m.`);
    }
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === "s")
        return amount;
    if (unit === "m")
        return amount * 60;
    return amount * 60 * 60;
}
export function formatDuration(seconds) {
    if (seconds % 3600 === 0)
        return `${seconds / 3600}h`;
    if (seconds % 60 === 0)
        return `${seconds / 60}m`;
    return `${seconds}s`;
}
//# sourceMappingURL=duration.js.map