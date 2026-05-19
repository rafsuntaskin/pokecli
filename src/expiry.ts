export function parseExpiryTime(captured: string, now: Date): Date | null {
  const trimmed = captured.trim().toLowerCase().replace(/^at\s+/, "");

  const relative = trimmed.match(/^in\s+(\d+)\s*(minutes?|hours?|mins?|hrs?|h|m)\b/);
  if (relative) {
    const value = Number(relative[1]);
    const unit = relative[2]!;
    const isHours = unit.startsWith("h");
    const ms = value * (isHours ? 3_600_000 : 60_000);
    return new Date(now.getTime() + ms);
  }

  const clock = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (clock) {
    let hour = Number(clock[1]);
    const minute = clock[2] ? Number(clock[2]) : 0;
    const meridiem = clock[3];

    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;

    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  return null;
}
