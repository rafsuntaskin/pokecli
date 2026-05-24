import { DatabaseSync } from "node:sqlite";
import { getDbPath, ensurePokeDir } from "./paths.js";
import type { Rule, RuleInput, ScheduledAction } from "./types.js";

export type Db = DatabaseSync;

export function openDb(projectRoot: string): Db {
  ensurePokeDir(projectRoot);
  const db = new DatabaseSync(getDbPath(projectRoot));
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`
    create table if not exists rules (
      id text primary key,
      name text unique not null,
      match_type text not null,
      match_value text not null,
      response text not null,
      delay_seconds integer not null default 0,
      dedupe_seconds integer not null default 600,
      require_still_visible integer not null default 1,
      enabled integer not null default 1,
      created_at text not null,
      expiry_pattern text
    );

    create table if not exists scheduled_actions (
      id text primary key,
      rule_id text not null,
      response text not null,
      run_at text not null,
      status text not null,
      matched_output text,
      dedupe_key text not null,
      schedule_source text not null default 'delay',
      created_at text not null,
      executed_at text,
      skip_reason text
    );

    create table if not exists events (
      id text primary key,
      type text not null,
      message text not null,
      metadata_json text,
      created_at text not null
    );
  `);

  const ruleColumns = db.prepare("pragma table_info(rules)").all() as Array<{ name: string }>;
  if (!ruleColumns.some((col) => col.name === "expiry_pattern")) {
    db.exec("alter table rules add column expiry_pattern text");
  }

  const actionColumns = db.prepare("pragma table_info(scheduled_actions)").all() as Array<{ name: string }>;
  if (!actionColumns.some((col) => col.name === "schedule_source")) {
    db.exec("alter table scheduled_actions add column schedule_source text not null default 'delay'");
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createRule(db: Db, input: RuleInput): Rule {
  const rule: Rule = {
    id: crypto.randomUUID(),
    name: input.name,
    match_type: input.matchType,
    match_value: input.matchValue,
    response: input.response,
    delay_seconds: input.delaySeconds,
    dedupe_seconds: input.dedupeSeconds,
    require_still_visible: input.requireStillVisible ? 1 : 0,
    expiry_pattern: input.expiryPattern ?? null,
    enabled: input.enabled === false ? 0 : 1,
    created_at: nowIso(),
  };

  db.prepare(`
    insert into rules (
      id, name, match_type, match_value, response, delay_seconds, dedupe_seconds,
      require_still_visible, expiry_pattern, enabled, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rule.id,
    rule.name,
    rule.match_type,
    rule.match_value,
    rule.response,
    rule.delay_seconds,
    rule.dedupe_seconds,
    rule.require_still_visible,
    rule.expiry_pattern,
    rule.enabled,
    rule.created_at,
  );

  return rule;
}

export function listRules(db: Db, enabledOnly = false): Rule[] {
  const sql = enabledOnly ? "select * from rules where enabled = 1 order by created_at" : "select * from rules order by created_at";
  return db.prepare(sql).all() as Rule[];
}

export function getRule(db: Db, id: string): Rule | undefined {
  return db.prepare("select * from rules where id = ? or name = ?").get(id, id) as Rule | undefined;
}

export function setRuleEnabled(db: Db, id: string, enabled: boolean): void {
  db.prepare("update rules set enabled = ? where id = ? or name = ?").run(enabled ? 1 : 0, id, id);
}

export function createScheduledAction(
  db: Db,
  input: {
    ruleId: string;
    response: string;
    runAt: string;
    matchedOutput: string;
    dedupeKey: string;
    scheduleSource: "expiry" | "delay";
  },
): ScheduledAction {
  const action: ScheduledAction = {
    id: crypto.randomUUID(),
    rule_id: input.ruleId,
    response: input.response,
    run_at: input.runAt,
    status: "pending",
    matched_output: input.matchedOutput,
    dedupe_key: input.dedupeKey,
    schedule_source: input.scheduleSource,
    created_at: nowIso(),
    executed_at: null,
    skip_reason: null,
  };

  db.prepare(`
    insert into scheduled_actions (
      id, rule_id, response, run_at, status, matched_output, dedupe_key,
      schedule_source, created_at, executed_at, skip_reason
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    action.id,
    action.rule_id,
    action.response,
    action.run_at,
    action.status,
    action.matched_output,
    action.dedupe_key,
    action.schedule_source,
    action.created_at,
    action.executed_at,
    action.skip_reason,
  );

  return action;
}

export function listActions(db: Db, pendingOnly = false): ScheduledAction[] {
  const sql = pendingOnly
    ? "select * from scheduled_actions where status = 'pending' order by run_at"
    : "select * from scheduled_actions order by created_at desc";

  return db.prepare(sql).all() as ScheduledAction[];
}

export function listDueActions(db: Db): ScheduledAction[] {
  return db.prepare("select * from scheduled_actions where status = 'pending' and run_at <= ? order by run_at").all(nowIso()) as ScheduledAction[];
}

export function cancelAction(db: Db, id: string): void {
  db.prepare("update scheduled_actions set status = 'cancelled', skip_reason = 'cancelled by user' where id = ? and status = 'pending'").run(id);
}

export function markActionExecuted(db: Db, id: string): void {
  db.prepare("update scheduled_actions set status = 'executed', executed_at = ? where id = ?").run(nowIso(), id);
}

export function markActionSkipped(db: Db, id: string, reason: string): void {
  db.prepare("update scheduled_actions set status = 'skipped', executed_at = ?, skip_reason = ? where id = ?").run(nowIso(), reason, id);
}

export function markActionFailed(db: Db, id: string, reason: string): void {
  db.prepare("update scheduled_actions set status = 'failed', executed_at = ?, skip_reason = ? where id = ?").run(nowIso(), reason, id);
}

export function getPendingActionForRule(db: Db, ruleId: string): ScheduledAction | undefined {
  return db.prepare(`
    select * from scheduled_actions
    where rule_id = ? and status = 'pending'
    order by created_at desc
    limit 1
  `).get(ruleId) as ScheduledAction | undefined;
}

export function getRecentActionByDedupeKey(db: Db, dedupeKey: string, sinceIso: string): ScheduledAction | undefined {
  return db.prepare(`
    select * from scheduled_actions
    where dedupe_key = ?
      and (
        created_at >= ?
        or executed_at >= ?
      )
    order by coalesce(executed_at, created_at) desc
    limit 1
  `).get(dedupeKey, sinceIso, sinceIso) as ScheduledAction | undefined;
}

export function supersedeAction(db: Db, id: string, reason: string): void {
  db.prepare("update scheduled_actions set status = 'cancelled', skip_reason = ?, executed_at = ? where id = ? and status = 'pending'").run(reason, nowIso(), id);
}

export function logEvent(db: Db, type: string, message: string, metadata?: unknown): void {
  db.prepare("insert into events (id, type, message, metadata_json, created_at) values (?, ?, ?, ?, ?)").run(
    crypto.randomUUID(),
    type,
    message,
    metadata ? JSON.stringify(metadata) : null,
    nowIso(),
  );
}
