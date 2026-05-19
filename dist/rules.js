import { createScheduledAction, hasRecentAction, logEvent } from "./db.js";
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
export function evaluateRule(db, rule, output) {
    const matched = findMatch(rule, output);
    if (!matched)
        return;
    const key = dedupeKey(rule, matched);
    const since = new Date(Date.now() - rule.dedupe_seconds * 1000).toISOString();
    if (hasRecentAction(db, key, since)) {
        return;
    }
    const runAt = new Date(Date.now() + rule.delay_seconds * 1000).toISOString();
    logEvent(db, "rule_matched", `Rule matched: ${rule.name}`, { ruleId: rule.id, matched });
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
    });
}
export function claudeAutoResumeRule(delaySeconds, response, dedupeSeconds) {
    return {
        name: "auto-resume-limit",
        matchType: "regex",
        matchValue: "(?i)(limit|usage|rate).*(try again|resume|continue|later)",
        response,
        delaySeconds,
        dedupeSeconds,
        requireStillVisible: true,
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
    };
}
//# sourceMappingURL=rules.js.map