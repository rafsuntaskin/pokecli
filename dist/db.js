import { DatabaseSync } from "node:sqlite";
import { getDbPath, ensurePokeDir } from "./paths.js";
export function openDb(projectRoot) {
    ensurePokeDir(projectRoot);
    const db = new DatabaseSync(getDbPath(projectRoot));
    migrate(db);
    return db;
}
function migrate(db) {
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
    const ruleColumns = db.prepare("pragma table_info(rules)").all();
    if (!ruleColumns.some((col) => col.name === "expiry_pattern")) {
        db.exec("alter table rules add column expiry_pattern text");
    }
}
export function nowIso() {
    return new Date().toISOString();
}
export function createRule(db, input) {
    const rule = {
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
  `).run(rule.id, rule.name, rule.match_type, rule.match_value, rule.response, rule.delay_seconds, rule.dedupe_seconds, rule.require_still_visible, rule.expiry_pattern, rule.enabled, rule.created_at);
    return rule;
}
export function listRules(db, enabledOnly = false) {
    const sql = enabledOnly ? "select * from rules where enabled = 1 order by created_at" : "select * from rules order by created_at";
    return db.prepare(sql).all();
}
export function getRule(db, id) {
    return db.prepare("select * from rules where id = ? or name = ?").get(id, id);
}
export function setRuleEnabled(db, id, enabled) {
    db.prepare("update rules set enabled = ? where id = ? or name = ?").run(enabled ? 1 : 0, id, id);
}
export function createScheduledAction(db, input) {
    const action = {
        id: crypto.randomUUID(),
        rule_id: input.ruleId,
        response: input.response,
        run_at: input.runAt,
        status: "pending",
        matched_output: input.matchedOutput,
        dedupe_key: "",
        created_at: nowIso(),
        executed_at: null,
        skip_reason: null,
    };
    db.prepare(`
    insert into scheduled_actions (
      id, rule_id, response, run_at, status, matched_output, dedupe_key,
      created_at, executed_at, skip_reason
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(action.id, action.rule_id, action.response, action.run_at, action.status, action.matched_output, action.dedupe_key, action.created_at, action.executed_at, action.skip_reason);
    return action;
}
export function listActions(db, pendingOnly = false) {
    const sql = pendingOnly
        ? "select * from scheduled_actions where status = 'pending' order by run_at"
        : "select * from scheduled_actions order by created_at desc";
    return db.prepare(sql).all();
}
export function listDueActions(db) {
    return db.prepare("select * from scheduled_actions where status = 'pending' and run_at <= ? order by run_at").all(nowIso());
}
export function cancelAction(db, id) {
    db.prepare("update scheduled_actions set status = 'cancelled', skip_reason = 'cancelled by user' where id = ? and status = 'pending'").run(id);
}
export function markActionExecuted(db, id) {
    db.prepare("update scheduled_actions set status = 'executed', executed_at = ? where id = ?").run(nowIso(), id);
}
export function markActionSkipped(db, id, reason) {
    db.prepare("update scheduled_actions set status = 'skipped', executed_at = ?, skip_reason = ? where id = ?").run(nowIso(), reason, id);
}
export function markActionFailed(db, id, reason) {
    db.prepare("update scheduled_actions set status = 'failed', executed_at = ?, skip_reason = ? where id = ?").run(nowIso(), reason, id);
}
export function hasPendingActionForRule(db, ruleId) {
    const row = db.prepare(`
    select id from scheduled_actions
    where rule_id = ? and status = 'pending'
    limit 1
  `).get(ruleId);
    return Boolean(row);
}
export function logEvent(db, type, message, metadata) {
    db.prepare("insert into events (id, type, message, metadata_json, created_at) values (?, ?, ?, ?, ?)").run(crypto.randomUUID(), type, message, metadata ? JSON.stringify(metadata) : null, nowIso());
}
//# sourceMappingURL=db.js.map