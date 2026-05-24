import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRule, listActions, listDueActions, markActionExecuted, openDb } from "../src/db.js";
import { evaluateRule } from "../src/rules.js";

function withTempProject<T>(fn: (projectRoot: string) => T): T {
  const projectRoot = mkdtempSync(join(tmpdir(), "pokecli-test-"));
  try {
    return fn(projectRoot);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

describe("scheduled actions", () => {
  it("schedules a matching trigger, executes the due run, and clears pending actions", () => {
    withTempProject((projectRoot) => {
      const db = openDb(projectRoot);
      try {
        const rule = createRule(db, {
          name: "test-trigger",
          matchType: "contains",
          matchValue: "usage limit",
          response: "continue",
          delaySeconds: 0,
          dedupeSeconds: 600,
          requireStillVisible: true,
          enabled: true,
        });

        const scheduled = evaluateRule(db, rule, "usage limit reached");

        assert.ok(scheduled, "matching output should schedule an action");
        assert.equal(listActions(db, true).length, 1, "scheduled action should be pending");

        db.prepare("update scheduled_actions set run_at = ? where id = ?").run(new Date(Date.now() - 1_000).toISOString(), scheduled.id);

        const dueActions = listDueActions(db);
        assert.equal(dueActions.length, 1, "scheduled action should become due");
        assert.equal(dueActions[0]?.id, scheduled.id);

        markActionExecuted(db, dueActions[0]!.id);

        assert.equal(listActions(db, true).length, 0, "executed action should no longer be pending");
        assert.equal(listDueActions(db).length, 0, "executed action should not be returned as due again");
      } finally {
        db.close();
      }
    });
  });

  it("does not schedule the same trigger again after its action executed within the dedupe window", () => {
    withTempProject((projectRoot) => {
      const db = openDb(projectRoot);
      try {
        const rule = createRule(db, {
          name: "test-executed-dedupe",
          matchType: "contains",
          matchValue: "usage limit",
          response: "continue",
          delaySeconds: 0,
          dedupeSeconds: 600,
          requireStillVisible: true,
          enabled: true,
        });

        const scheduled = evaluateRule(db, rule, "usage limit reached");
        assert.ok(scheduled, "matching output should schedule an action");

        db.prepare("update scheduled_actions set run_at = ? where id = ?").run(new Date(Date.now() - 1_000).toISOString(), scheduled.id);
        const dueActions = listDueActions(db);
        assert.equal(dueActions.length, 1);
        markActionExecuted(db, dueActions[0]!.id);

        const repeated = evaluateRule(db, rule, "usage limit reached");

        assert.equal(repeated, null, "executed action should suppress the same trigger during the dedupe window");
        assert.equal(listActions(db, true).length, 0, "same trigger should not create another pending action");
      } finally {
        db.close();
      }
    });
  });

  it("replaces an existing pending action when a newer matching trigger changes the schedule", () => {
    withTempProject((projectRoot) => {
      const db = openDb(projectRoot);
      try {
        const rule = createRule(db, {
          name: "test-reschedule",
          matchType: "regex",
          matchValue: "(?i)usage limit.*try again",
          response: "continue",
          delaySeconds: 1800,
          dedupeSeconds: 600,
          requireStillVisible: true,
          expiryPattern: "(?i)try again at (?<time>\\d{1,2}:\\d{2}\\s*(?:am|pm))",
          enabled: true,
        });

        const first = evaluateRule(db, rule, "Usage limit reached. Try again at 3:00 PM.");
        const second = evaluateRule(db, rule, "Usage limit reached. Try again at 4:00 PM.");

        assert.ok(first, "first matching output should schedule an action");
        assert.ok(second, "newer matching output should reschedule the pending action");
        assert.notEqual(second.id, first.id);

        const pending = listActions(db, true);
        assert.equal(pending.length, 1, "only the newest action should remain pending");
        assert.equal(pending[0]?.id, second.id);

        const superseded = listActions(db).find((action) => action.id === first.id);
        assert.equal(superseded?.status, "cancelled");
        assert.equal(superseded?.skip_reason, "superseded by newer matching output");
      } finally {
        db.close();
      }
    });
  });

  it("does not replace an existing pending action for the same matching trigger", () => {
    withTempProject((projectRoot) => {
      const db = openDb(projectRoot);
      try {
        const rule = createRule(db, {
          name: "test-no-duplicate",
          matchType: "regex",
          matchValue: "(?i)usage limit.*try again",
          response: "continue",
          delaySeconds: 1800,
          dedupeSeconds: 600,
          requireStillVisible: true,
          expiryPattern: "(?i)try again at (?<time>\\d{1,2}:\\d{2}\\s*(?:am|pm))",
          enabled: true,
        });

        const first = evaluateRule(db, rule, "Usage limit reached. Try again at 3:00 PM.");
        const second = evaluateRule(db, rule, "Usage limit reached. Try again at 3:00 PM.");

        assert.ok(first, "first matching output should schedule an action");
        assert.equal(second, null, "same matching output should not reschedule");

        const pending = listActions(db, true);
        assert.equal(pending.length, 1, "only the original action should remain pending");
        assert.equal(pending[0]?.id, first.id);
      } finally {
        db.close();
      }
    });
  });
});
