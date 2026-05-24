import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { extractAgentResponseOutput } from "../src/pane.js";

describe("extractAgentResponseOutput", () => {
  it("keeps Claude agent limit output and drops typed prompt input", () => {
    const pane = [
      "│ user typed: You've hit your limit · resets 6:00am │",
      "⎿  You've hit your limit · resets 5:50am (Asia/Dhaka)",
      "╭────────────────────────────────────────────────────╮",
      "│ You've hit your limit · resets 6:00am              │",
      "╰────────────────────────────────────────────────────╯",
    ].join("\n");

    const output = extractAgentResponseOutput("claude", pane);

    assert.match(output, /resets 5:50am/);
    assert.doesNotMatch(output, /resets 6:00am/);
  });

  it("keeps wrapped Codex agent output and drops typed prompt input", () => {
    const pane = [
      "■ You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage",
      "to purchase more credits or try again at 8:59 PM.",
      "",
      "› You've hit your usage limit, try again at 9:30 PM",
    ].join("\n");

    const output = extractAgentResponseOutput("codex", pane);

    assert.match(output, /try again at 8:59 PM/);
    assert.doesNotMatch(output, /9:30 PM/);
  });
});
