import type { AgentKind } from "./types.js";

const AGENT_LINE_MARKERS = ["⎿", "■"];
const PROMPT_LINE_PATTERN = /^\s*(?:[>›▌]|\?|╭|╰|│)/;

export function extractAgentResponseOutput(agent: AgentKind, paneOutput: string): string {
  const lines = paneOutput.split(/\r?\n/);
  const chunks: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!isAgentLine(agent, lines[index]!)) continue;

    const chunk = [lines[index]!];
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next]!;
      if (line.trim() === "" || isAgentLine(agent, line) || isPromptLine(line)) break;
      chunk.push(line);
      index = next;
    }
    chunks.push(chunk.join("\n"));
  }

  return chunks.join("\n");
}

function isAgentLine(agent: AgentKind, line: string): boolean {
  const trimmed = line.trimStart();
  if (agent === "claude") {
    return trimmed.startsWith("⎿");
  }
  if (agent === "codex") {
    return trimmed.startsWith("■");
  }
  return AGENT_LINE_MARKERS.some((marker) => trimmed.startsWith(marker));
}

function isPromptLine(line: string): boolean {
  return PROMPT_LINE_PATTERN.test(line);
}
