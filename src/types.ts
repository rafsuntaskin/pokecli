export type AgentKind = "claude" | "codex" | "custom";

export type ProjectConfig = {
  version: 1;
  projectRoot: string;
  agent: AgentKind;
  command: string;
  tmuxTarget: string;
  automationPaused: boolean;
  pollIntervalSeconds: number;
};

export type MatchType = "contains" | "regex";

export type Rule = {
  id: string;
  name: string;
  match_type: MatchType;
  match_value: string;
  response: string;
  delay_seconds: number;
  dedupe_seconds: number;
  require_still_visible: number;
  expiry_pattern: string | null;
  enabled: number;
  created_at: string;
};

export type ScheduledAction = {
  id: string;
  rule_id: string;
  response: string;
  run_at: string;
  status: "pending" | "executed" | "cancelled" | "skipped" | "failed";
  matched_output: string | null;
  dedupe_key: string;
  created_at: string;
  executed_at: string | null;
  skip_reason: string | null;
};

export type RuleInput = {
  name: string;
  matchType: MatchType;
  matchValue: string;
  response: string;
  delaySeconds: number;
  dedupeSeconds: number;
  requireStillVisible: boolean;
  expiryPattern?: string | null;
  enabled?: boolean;
};
