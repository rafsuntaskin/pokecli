import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parseExpiryTime } from "../src/expiry.js";

const NOW = new Date("2026-05-19T14:00:00");

describe("parseExpiryTime — wall-clock formats", () => {
  it("parses '3pm' as today 15:00", () => {
    const r = parseExpiryTime("3pm", NOW);
    assert.equal(r?.getHours(), 15);
    assert.equal(r?.getMinutes(), 0);
    assert.equal(r?.getDate(), 19);
  });

  it("parses '3:00 PM' identically", () => {
    const r = parseExpiryTime("3:00 PM", NOW);
    assert.equal(r?.getHours(), 15);
    assert.equal(r?.getMinutes(), 0);
  });

  it("parses 24-hour '15:00'", () => {
    const r = parseExpiryTime("15:00", NOW);
    assert.equal(r?.getHours(), 15);
  });

  it("strips a leading 'at '", () => {
    const r = parseExpiryTime("at 3pm", NOW);
    assert.equal(r?.getHours(), 15);
  });

  it("handles am/pm with minutes — '5:50am' (real Claude fixture)", () => {
    const r = parseExpiryTime("5:50am", NOW);
    assert.equal(r?.getHours(), 5);
    assert.equal(r?.getMinutes(), 50);
  });

  it("rolls to tomorrow when wall-clock time is already past", () => {
    const r = parseExpiryTime("1am", NOW);
    assert.equal(r?.getHours(), 1);
    assert.equal(r?.getDate(), 20);
  });

  it("handles 12pm (noon) correctly", () => {
    const r = parseExpiryTime("12:00 PM", NOW);
    assert.equal(r?.getHours(), 12);
  });

  it("handles 12am (midnight) correctly — rolls to next day since we're past midnight today", () => {
    const r = parseExpiryTime("12:00 AM", NOW);
    assert.equal(r?.getHours(), 0);
    assert.equal(r?.getDate(), 20);
  });

  it("rejects invalid hour", () => {
    assert.equal(parseExpiryTime("25:00", NOW), null);
  });

  it("rejects invalid minute", () => {
    assert.equal(parseExpiryTime("10:99", NOW), null);
  });
});

describe("parseExpiryTime — relative durations", () => {
  it("parses 'in 47 minutes'", () => {
    const r = parseExpiryTime("in 47 minutes", NOW);
    assert.equal(r?.getTime(), NOW.getTime() + 47 * 60_000);
  });

  it("parses 'in 2 hours'", () => {
    const r = parseExpiryTime("in 2 hours", NOW);
    assert.equal(r?.getTime(), NOW.getTime() + 2 * 3600_000);
  });

  it("parses singular 'in 1 hour'", () => {
    const r = parseExpiryTime("in 1 hour", NOW);
    assert.equal(r?.getTime(), NOW.getTime() + 3600_000);
  });

  it("parses abbreviated 'in 30 min'", () => {
    const r = parseExpiryTime("in 30 min", NOW);
    assert.equal(r?.getTime(), NOW.getTime() + 30 * 60_000);
  });

  it("parses abbreviated 'in 3 hrs'", () => {
    const r = parseExpiryTime("in 3 hrs", NOW);
    assert.equal(r?.getTime(), NOW.getTime() + 3 * 3600_000);
  });
});

describe("parseExpiryTime — non-matching inputs", () => {
  it("returns null for empty string", () => {
    assert.equal(parseExpiryTime("", NOW), null);
  });

  it("returns null for garbage", () => {
    assert.equal(parseExpiryTime("soon-ish", NOW), null);
  });

  it("returns null for missing duration unit", () => {
    assert.equal(parseExpiryTime("in 5", NOW), null);
  });
});
