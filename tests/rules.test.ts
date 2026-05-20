import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { claudeAutoResumeRule, codexAutoResumeRule } from "../src/rules.js";

function compile(pattern: string): RegExp {
  if (pattern.startsWith("(?i)")) return new RegExp(pattern.slice(4), "is");
  return new RegExp(pattern, "s");
}

function hits(matchValue: string, text: string): boolean {
  return compile(matchValue).test(text);
}

function extractTime(expiryPattern: string | undefined | null, text: string): string | null {
  if (!expiryPattern) return null;
  const m = compile(expiryPattern).exec(text);
  return m?.groups?.time ?? null;
}

const claude = claudeAutoResumeRule(1800, "continue", 5400);
const codex = codexAutoResumeRule(1800, "continue", 5400);

describe("claude auto-resume rule — match pattern", () => {
  it("hits the real Claude fixture: 'resets 5:50am (Asia/Dhaka)'", () => {
    const fixture = "⎿  You've hit your limit · resets 5:50am (Asia/Dhaka)";
    assert.equal(hits(claude.matchValue, fixture), true);
  });

  it("hits 'usage limit reached. Try again at 3:00 PM'", () => {
    assert.equal(hits(claude.matchValue, "Usage limit reached. Try again at 3:00 PM."), true);
  });

  it("hits 'rate limit hit, try again later'", () => {
    assert.equal(hits(claude.matchValue, "Rate limit hit, try again later"), true);
  });

  it("does not hit unrelated text", () => {
    assert.equal(hits(claude.matchValue, "Everything is fine, no limit here"), false);
  });
});

describe("claude auto-resume rule — expiry extraction", () => {
  it("extracts '5:50am' from the real fixture", () => {
    const fixture = "⎿  You've hit your limit · resets 5:50am (Asia/Dhaka)";
    assert.equal(extractTime(claude.expiryPattern, fixture), "5:50am");
  });

  it("extracts '3:00 PM' from 'try again at 3:00 PM'", () => {
    assert.equal(extractTime(claude.expiryPattern, "Try again at 3:00 PM."), "3:00 PM");
  });

  it("extracts 'in 47 minutes' from 'retry in 47 minutes'", () => {
    assert.equal(extractTime(claude.expiryPattern, "Retry in 47 minutes."), "in 47 minutes");
  });

  it("returns null when no expiry phrase is present", () => {
    assert.equal(extractTime(claude.expiryPattern, "Something went wrong with no time mentioned"), null);
  });
});

describe("codex auto-resume rule", () => {
  it("hits 'quota exceeded, retry later'", () => {
    assert.equal(hits(codex.matchValue, "Quota exceeded, retry later."), true);
  });

  it("hits 'rate limit · resets 5pm' (same shape as Claude)", () => {
    assert.equal(hits(codex.matchValue, "Rate limit · resets 5pm"), true);
  });

  it("extracts time from 'resets 5pm'", () => {
    assert.equal(extractTime(codex.expiryPattern, "Rate limit · resets 5pm"), "5pm");
  });

  it("hits the real Codex fixture (line-wrapped 'try again at 8:59 PM')", () => {
    const fixture = "■ You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage\nto purchase more credits or try again at 8:59 PM.";
    assert.equal(hits(codex.matchValue, fixture), true);
  });

  it("extracts time from the real Codex fixture", () => {
    const fixture = "■ You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage\nto purchase more credits or try again at 8:59 PM.";
    assert.equal(extractTime(codex.expiryPattern, fixture), "8:59 PM");
  });
});
