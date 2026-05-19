# PokeCLI MVP Specification

## Purpose

PokeCLI is a CLI-first wrapper for one long-running AI agent session in the current project directory.

The MVP starts either `claude` or `codex` inside `tmux`, watches the terminal output, detects configured prompts, and sends predefined responses immediately or after a delay.

The first use case is auto-resuming when an agent hits a usage limit and asks the user to continue later.

## MVP Scope

The MVP supports exactly one managed session per project directory.

PokeCLI is intended to be distributed as an open-source local CLI tool that users install and run on their own machines. It must not require a hosted service.

The user flow is:

```bash
cd /path/to/project
poke
```

PokeCLI then walks the user through:

1. Choosing the agent command.
2. Starting or attaching to the single managed session for this directory.
3. Enabling default automation templates.
4. Customizing rule delay, match text, and response text.
5. Running the watcher.

## Non-Goals

- No multi-session management.
- No named session list.
- No desktop app.
- No web dashboard.
- No custom PTY implementation.
- No multi-agent orchestration.
- No automatic answers to arbitrary prompts.
- No semantic AI interpretation of prompts.
- No remote machine support.
- No cloud sync.
- No hosted backend.
- No telemetry in the MVP.

Multi-session management can be added after the single-session workflow is reliable.

## Distribution Goals

- Publish as an npm package with a `poke` binary.
- Keep all runtime data local to the project in `.poke/`.
- Require `tmux` to be installed locally.
- Support macOS and Linux for the MVP.
- Treat native Windows support as out of scope unless the user runs inside WSL with `tmux`.
- Provide clear install, quickstart, and uninstall documentation.
- Use an open-source license.
- Avoid any required account, API key, hosted service, or phone-home behavior.

## Installation

Primary install path:

```bash
npm install -g pokecli
```

Expected usage after install:

```bash
cd /path/to/project
poke
```

For local development from the repository:

```bash
npm install
npm run build
npm link
poke
```

The package name can be finalized before publishing. If `pokecli` is unavailable on npm, use a scoped package such as:

```text
@pokecli/cli
```

## Core Architecture

```text
poke CLI
  -> local project config
  -> local SQLite database
  -> tmux session for current directory
  -> claude/codex/other CLI agent

poke watcher
  -> tmux capture-pane
  -> rule matcher
  -> scheduled action queue
  -> tmux send-keys
```

`tmux` owns the real terminal session. PokeCLI controls it and automates allowlisted responses. The MVP uses a project-local tmux socket so each project is isolated from the user's default tmux server.

## Naming

- Project name: `PokeCLI`
- Executable: `poke`
- Config directory: `.poke`
- Local database: `.poke/poke.db`
- Local tmux socket: `.poke/tmux.sock`
- Project config file: `.poke/config.json`

The MVP stores state per project directory so running `poke` from a project naturally controls that project's single session.

## First-Run Behavior

When the user runs:

```bash
poke
```

and no `.poke/config.json` exists, PokeCLI starts an interactive setup.

Example:

```text
Welcome to PokeCLI

Use this directory?
  /path/to/project
> Yes

Which agent do you want to run?
> Claude
  Codex
  Custom command

Command:
  claude

Enable auto-resume when a usage limit is hit?
> Yes

Resume delay:
> 1h

Response to send:
> continue

Start the agent now?
> Yes

Attach to the session after starting?
> Yes
```

If the user chooses `Claude` or `Codex`, PokeCLI preloads default auto-resume rule templates for that agent.

## Existing Project Behavior

When the user runs:

```bash
poke
```

and `.poke/config.json` already exists, PokeCLI opens a simple interactive menu.

Example:

```text
PokeCLI

Project: /path/to/project
Agent: claude
Session: running
Automation: on
Pending actions: 1

What do you want to do?
> Attach to session
  Send message
  Start watcher
  View rules
  Edit auto-resume rule
  View pending actions
  Pause automation
  Exit
```

The menu can be implemented with simple prompts. A full TUI is not required.

## Default Templates

Templates are starter rules created during interactive setup. The user can accept, edit, or disable them.

### Claude Auto-Resume Template

Purpose:

Detect when Claude CLI indicates a usage or rate limit and asks the user to try again later.

Default settings:

```text
name: auto-resume-limit
match_type: regex
match_value: (?i)(limit|usage|rate).*(try again|resume|continue|later)
response: continue
delay: 1h
dedupe: 90m
require_still_visible: true
enabled: true
```

### Codex Auto-Resume Template

Purpose:

Detect when Codex CLI indicates a usage or rate limit and asks the user to continue or retry later.

Default settings:

```text
name: auto-resume-limit
match_type: regex
match_value: (?i)(limit|usage|rate|quota).*(try again|retry|continue|later)
response: continue
delay: 1h
dedupe: 90m
require_still_visible: true
enabled: true
```

### Custom Agent Template

If the user chooses a custom command, PokeCLI asks whether to create an auto-resume rule from scratch.

Prompts:

```text
Text or regex to watch for:
Response to send:
Delay before sending:
Dedupe window:
Require prompt to still be visible before sending?
```

## CLI Commands

The interactive `poke` command is the primary MVP interface. Direct commands exist for scripting and testing.

### `poke`

Open setup or the project menu.

```bash
poke
```

Behavior:

- If `.poke/config.json` does not exist, run first-time setup.
- If config exists, show the project menu.

### `poke start`

Start the configured single session.

```bash
poke start
```

Behavior:

- Creates a detached `tmux` session for the current project.
- Starts the configured agent command.
- Fails if the session is already running.

### `poke attach`

Attach to the configured session.

```bash
poke attach
```

Runs:

```bash
tmux attach -t <configured-target>
```

### `poke send`

Send text to the configured session.

```bash
poke send "continue"
```

Behavior:

- Sends text using `tmux send-keys`.
- Sends `Enter` after the text by default.
- Logs the manual send event.

### `poke capture`

Print recent terminal output.

```bash
poke capture [--lines 200]
```

Behavior:

- Uses `tmux capture-pane`.
- Defaults to the last 200 lines.

### `poke run`

Run the watcher and scheduler loop.

```bash
poke run
```

Behavior:

- Watches only the configured single session.
- Captures recent output.
- Applies enabled rules.
- Creates scheduled actions for matches.
- Executes due scheduled actions.
- Logs matches, schedules, skips, sends, and errors.

### `poke rules`

List configured rules.

```bash
poke rules
```

### `poke rule add`

Add a rule without using the interactive menu.

```bash
poke rule add <rule-name> \
  (--contains <text> | --regex <pattern>) \
  --response <text> \
  [--delay <duration>] \
  [--dedupe <duration>] \
  [--require-still-visible true|false]
```

### `poke actions`

List scheduled actions.

```bash
poke actions [--pending]
```

### `poke cancel`

Cancel a scheduled action.

```bash
poke cancel <action-id>
```

### `poke pause`

Pause automation for the project.

```bash
poke pause
```

### `poke resume`

Resume automation for the project.

```bash
poke resume
```

## Project Config

`.poke/config.json` stores project-level configuration.

Example:

```json
{
  "version": 1,
  "projectRoot": "/path/to/project",
  "agent": "claude",
  "command": "claude",
  "tmuxTarget": "poke-7f3a91",
  "automationPaused": false,
  "pollIntervalSeconds": 5
}
```

The `tmuxTarget` should be deterministic enough to reuse for the project, but unique enough to avoid collisions. A hash of the absolute project path is acceptable.

## Matching Behavior

The MVP supports two match types:

- `contains`: simple case-sensitive substring match.
- `regex`: JavaScript-style regular expression if implemented in Node.js.

When a rule matches:

1. Compute a dedupe key from:

   ```text
   rule id + normalized matched text
   ```

2. If the same dedupe key was scheduled or executed within the rule's dedupe window, skip.

3. Otherwise, create a scheduled action with:

   ```text
   run_at = now + delay
   ```

## Scheduled Action Behavior

When an action becomes due:

1. Confirm project automation is not paused.
2. Confirm the configured `tmux` session still exists.
3. If `require_still_visible` is true, capture the pane and confirm the rule still matches.
4. Send the configured response using `tmux send-keys`.
5. Mark action as `executed`.
6. Log the send event.

If any check fails, mark the action as `skipped` with a reason.

## Duration Format

Support simple duration strings:

```text
10s
5m
1h
90m
```

No compound durations are required for the MVP.

## Persistence

Use SQLite stored at:

```text
.poke/poke.db
```

The database must be created automatically during setup.

## Data Model

### `rules`

```text
id                       text primary key
name                     text unique not null
match_type               text not null
match_value              text not null
response                 text not null
delay_seconds            integer not null default 0
dedupe_seconds           integer not null default 600
require_still_visible    integer not null default 1
enabled                  integer not null default 1
created_at               text not null
```

### `scheduled_actions`

```text
id                 text primary key
rule_id             text not null
response            text not null
run_at              text not null
status              text not null
matched_output      text
dedupe_key          text not null
created_at          text not null
executed_at         text
skip_reason         text
```

Allowed statuses:

```text
pending
executed
cancelled
skipped
failed
```

### `events`

```text
id             text primary key
type            text not null
message         text not null
metadata_json   text
created_at      text not null
```

Event types:

```text
setup_completed
session_started
manual_send
rule_matched
action_scheduled
action_executed
action_cancelled
action_skipped
action_failed
automation_paused
automation_resumed
error
```

## Polling Loop

The MVP uses polling instead of streaming.

Default interval:

```text
5 seconds
```

Basic loop:

```text
while running:
  capture configured tmux pane output
  evaluate enabled rules

  load due scheduled actions
  for each action:
    execute or skip

  sleep poll interval
```

## Safety Requirements

- Automation must be opt-in during setup or through explicit rules.
- Project pause must stop all automated sends.
- Every automated send must be logged.
- Scheduled actions must be visible and cancellable before execution.
- Delayed actions should re-check the current pane output before sending by default.
- PokeCLI must not auto-answer prompts unless a configured rule matches.
- PokeCLI must not use broad AI interpretation to decide responses.

## Initial End-to-End Test Scenario

The first end-to-end test should verify this scenario:

1. Create a temporary project directory.

2. Run setup with custom command:

   ```bash
   poke
   ```

   Choose:

   ```text
   Custom command: zsh
   Enable auto-resume: yes
   Match text: limit over, try again later
   Response: continue
   Delay: 10s
   Dedupe: 60s
   ```

3. Start the watcher:

   ```bash
   poke run
   ```

4. In another terminal, send:

   ```bash
   poke send "echo 'limit over, try again later?'"
   ```

5. Confirm an action is scheduled.

6. Confirm `continue` is sent after 10 seconds.

## Recommended Tech Stack

- Node.js
- TypeScript
- `commander` for direct commands
- `@inquirer/prompts` for interactive setup and menus
- Node built-in `node:sqlite` for SQLite
- `crypto.randomUUID()` for IDs
- Node `child_process` or `execa` for running `tmux`

## Repository Requirements

- `README.md` with install, quickstart, safety notes, and limitations.
- `LICENSE`.
- `.gitignore`.
- `package.json` with `bin.poke`.
- TypeScript source under `src/`.
- Compiled output under `dist/`.
- No committed `.poke/` runtime state.

## Implementation Milestones

### Milestone 1: Package Foundation

- npm package setup
- TypeScript build
- `poke` executable wiring
- `.gitignore`
- license
- README skeleton

### Milestone 2: Interactive Setup

- `poke` first-run setup
- current directory detection
- choose Claude, Codex, or custom command
- create `.poke/config.json`
- create `.poke/poke.db`
- create default auto-resume rule template

### Milestone 3: Single Session Control

- `poke start`
- `poke attach`
- `poke send`
- `poke capture`
- tmux target generation from project path

### Milestone 4: Watcher and Scheduler

- `poke run`
- polling loop
- match evaluator
- dedupe behavior
- scheduled action execution
- action cancellation
- event logging

### Milestone 5: Interactive Menu

- `poke` existing-project menu
- view rules
- edit auto-resume rule
- view pending actions
- pause/resume automation

### Milestone 6: Distribution Readiness

- verify `npm pack` contents
- verify global install from packed tarball
- verify `poke` works after global install
- document `tmux` prerequisite
- document macOS/Linux support and WSL caveat
- confirm no runtime state is included in package

## Success Criteria

The MVP is complete when a user can:

1. Open a terminal in a project directory.
2. Run `poke`.
3. Configure a single Claude or Codex session.
4. Accept or customize the auto-resume-on-limit template.
5. Start the agent in `tmux`.
6. Run the watcher.
7. See a scheduled response created when a matching prompt appears.
8. Cancel the scheduled response if desired.
9. Let PokeCLI send the response after the configured delay.
10. Review a log of what happened.
