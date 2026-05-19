import { createScheduledAction, hasRecentAction, logEvent } from "./db.js";
import { parseExpiryTime } from "./expiry.js";
const MIN_SCHEDULE_MS = 60_000;
export function findMatch(rule, output) {
    if (rule.match_type === "contains") {
        return output.includes(rule.match_value) ? rule.match_value : null;
    }
    const { pattern, flags } = parseRegex(rule.match_value);
    const regex = new RegExp(pattern, flags);
    const match = regex.exec(output);
    return match?.[0] ?? null;
}
function parseRegex(value) {
    if (value.startsWith("(?i)")) {
        return { pattern: value.slice(4), flags: "i" };
    }
    return { pattern: value, flags: "" };
}
export function normalizeMatch(value) {
    return value.replace(/\s+/g, " ").trim().toLowerCase();
}
export function dedupeKey(rule, matched) {
    return `${rule.id}:${normalizeMatch(matched)}`;
}
function extractExpiry(rule, output, now) {
    if (!rule.expiry_pattern)
        return null;
    const { pattern, flags } = parseRegex(rule.expiry_pattern);
    const regex = new RegExp(pattern, flags);
    const match = regex.exec(output);
    const captured = match?.groups?.time;
    if (!captured)
        return null;
    const parsed = parseExpiryTime(captured, now);
    if (!parsed)
        return null;
    return { captured, parsed };
}
export function evaluateRule(db, rule, output) {
    const matched = findMatch(rule, output);
    if (!matched)
        return;
    const key = dedupeKey(rule, matched);
    const since = new Date(Date.now() - rule.dedupe_seconds * 1000).toISOString();
    if (hasRecentAction(db, key, since)) {
        return;
    }
    const now = new Date();
    const expiry = extractExpiry(rule, output, now);
    const minMs = now.getTime() + MIN_SCHEDULE_MS;
    const runAtMs = expiry
        ? Math.max(expiry.parsed.getTime(), minMs)
        : Math.max(now.getTime() + rule.delay_seconds * 1000, minMs);
    const runAt = new Date(runAtMs).toISOString();
    logEvent(db, "rule_matched", `Rule matched: ${rule.name}`, {
        ruleId: rule.id,
        matched,
        expiryCaptured: expiry?.captured ?? null,
        expiryParsed: expiry?.parsed.toISOString() ?? null,
    });
    const action = createScheduledAction(db, {
        ruleId: rule.id,
        response: rule.response,
        runAt,
        matchedOutput: matched,
        dedupeKey: key,
    });
    logEvent(db, "action_scheduled", `Scheduled response for rule: ${rule.name}`, {
        actionId: action.id,
        ruleId: rule.id,
        runAt,
        source: expiry ? "expiry" : "delay",
    });
}
const CLAUDE_EXPIRY_PATTERN = "(?i)(?:try again|retry|resume|reset(?:s|ting)?)\\s+(?:at\\s+)?(?<time>(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)|(?:in\\s+\\d+\\s*(?:minutes?|hours?|mins?|hrs?)))";
const CODEX_EXPIRY_PATTERN = CLAUDE_EXPIRY_PATTERN;
export function claudeAutoResumeRule(delaySeconds, response, dedupeSeconds) {
    return {
        name: "auto-resume-limit",
        matchType: "regex",
        matchValue: "(?i)(limit|usage|rate).*(try again|resume|continue|later)",
        response,
        delaySeconds,
        dedupeSeconds,
        requireStillVisible: true,
        expiryPattern: CLAUDE_EXPIRY_PATTERN,
    };
}
export function codexAutoResumeRule(delaySeconds, response, dedupeSeconds) {
    return {
        name: "auto-resume-limit",
        matchType: "regex",
        matchValue: "(?i)(limit|usage|rate|quota).*(try again|retry|continue|later)",
        response,
        delaySeconds,
        dedupeSeconds,
        requireStillVisible: true,
        expiryPattern: CODEX_EXPIRY_PATTERN,
    };
}
//# sourceMappingURL=rules.js.map