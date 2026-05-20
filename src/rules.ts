import type { Db } from "./db.js";
import { createScheduledAction, hasPendingActionForRule, logEvent } from "./db.js";
import { parseExpiryTime } from "./expiry.js";
import type { Rule, ScheduledAction } from "./types.js";

const MIN_SCHEDULE_MS = 60_000;

export function findMatch(rule: Rule, output: string): string | null {
  if (rule.match_type === "contains") {
    return output.includes(rule.match_value) ? rule.match_value : null;
  }

  const { pattern, flags } = parseRegex(rule.match_value);
  const regex = new RegExp(pattern, flags);
  const match = regex.exec(output);
  return match?.[0] ?? null;
}

function parseRegex(value: string): { pattern: string; flags: string } {
  if (value.startsWith("(?i)")) {
    return { pattern: value.slice(4), flags: "is" };
  }

  return { pattern: value, flags: "s" };
}

function extractExpiry(rule: Rule, output: string, now: Date): { captured: string; parsed: Date } | null {
  if (!rule.expiry_pattern) return null;
  const { pattern, flags } = parseRegex(rule.expiry_pattern);
  const regex = new RegExp(pattern, flags);
  const match = regex.exec(output);
  const captured = match?.groups?.time;
  if (!captured) return null;
  const parsed = parseExpiryTime(captured, now);
  if (!parsed) return null;
  return { captured, parsed };
}

export function evaluateRule(db: Db, rule: Rule, output: string): ScheduledAction | null {
  const matched = findMatch(rule, output);
  if (!matched) return null;

  if (hasPendingActionForRule(db, rule.id)) {
    return null;
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
  });
  logEvent(db, "action_scheduled", `Scheduled response for rule: ${rule.name}`, {
    actionId: action.id,
    ruleId: rule.id,
    runAt,
    source: expiry ? "expiry" : "delay",
  });
  return action;
}

const CLAUDE_EXPIRY_PATTERN =
  "(?i)(?:try again|retry|resume|reset(?:s|ting)?)\\s+(?:at\\s+)?(?<time>(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)|(?:in\\s+\\d+\\s*(?:minutes?|hours?|mins?|hrs?)))";

const CODEX_EXPIRY_PATTERN = CLAUDE_EXPIRY_PATTERN;

export function claudeAutoResumeRule(delaySeconds: number, response: string, dedupeSeconds: number) {
  return {
    name: "auto-resume-limit",
    matchType: "regex" as const,
    matchValue: "(?i)(limit|usage|rate).*(try again|resume|retry|continue|later|reset(?:s|ting)?)",
    response,
    delaySeconds,
    dedupeSeconds,
    requireStillVisible: true,
    expiryPattern: CLAUDE_EXPIRY_PATTERN,
  };
}

export function codexAutoResumeRule(delaySeconds: number, response: string, dedupeSeconds: number) {
  return {
    name: "auto-resume-limit",
    matchType: "regex" as const,
    matchValue: "(?i)(limit|usage|rate|quota).*(try again|retry|resume|continue|later|reset(?:s|ting)?)",
    response,
    delaySeconds,
    dedupeSeconds,
    requireStillVisible: true,
    expiryPattern: CODEX_EXPIRY_PATTERN,
  };
}
