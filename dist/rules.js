import { createScheduledAction, getPendingActionForRule, getRecentActionByDedupeKey, logEvent, supersedeAction } from "./db.js";
import { parseExpiryTime } from "./expiry.js";
import { createHash } from "node:crypto";
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
        return { pattern: value.slice(4), flags: "is" };
    }
    return { pattern: value, flags: "s" };
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
        return null;
    const now = new Date();
    const expiry = extractExpiry(rule, output, now);
    const source = expiry ? "expiry" : "delay";
    const minMs = now.getTime() + MIN_SCHEDULE_MS;
    const runAtMs = expiry
        ? Math.max(expiry.parsed.getTime(), minMs)
        : Math.max(now.getTime() + rule.delay_seconds * 1000, minMs);
    const runAt = new Date(runAtMs).toISOString();
    const dedupeKey = scheduleDedupeKey({
        ruleId: rule.id,
        matched,
        source,
        expiryCaptured: expiry?.captured ?? null,
        expiryParsed: expiry?.parsed.toISOString() ?? null,
    });
    const recent = getRecentActionByDedupeKey(db, dedupeKey, new Date(now.getTime() - rule.dedupe_seconds * 1000).toISOString());
    if (recent) {
        return null;
    }
    const existing = getPendingActionForRule(db, rule.id);
    if (existing) {
        if (existing.dedupe_key === dedupeKey) {
            return null;
        }
        supersedeAction(db, existing.id, "superseded by newer matching output");
        logEvent(db, "action_superseded", `Replaced pending action for rule: ${rule.name}`, {
            supersededActionId: existing.id,
            ruleId: rule.id,
        });
    }
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
        dedupeKey,
        scheduleSource: source,
    });
    logEvent(db, "action_scheduled", `Scheduled response for rule: ${rule.name}`, {
        actionId: action.id,
        ruleId: rule.id,
        runAt,
        source,
    });
    return action;
}
function scheduleDedupeKey(input) {
    return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
const CLAUDE_EXPIRY_PATTERN = "(?i)(?:try again|retry|resume|reset(?:s|ting)?)\\s+(?:at\\s+)?(?<time>(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)|(?:in\\s+\\d+\\s*(?:minutes?|hours?|mins?|hrs?)))";
const CODEX_EXPIRY_PATTERN = CLAUDE_EXPIRY_PATTERN;
export function claudeAutoResumeRule(delaySeconds, response, dedupeSeconds) {
    return {
        name: "auto-resume-limit",
        matchType: "regex",
        matchValue: "(?i)(limit|usage|rate).*(try again|resume|retry|continue|later|reset(?:s|ting)?)",
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
        matchValue: "(?i)(limit|usage|rate|quota).*(try again|retry|resume|continue|later|reset(?:s|ting)?)",
        response,
        delaySeconds,
        dedupeSeconds,
        requireStillVisible: true,
        expiryPattern: CODEX_EXPIRY_PATTERN,
    };
}
//# sourceMappingURL=rules.js.map