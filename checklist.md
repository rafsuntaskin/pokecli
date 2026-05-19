# PokeCLI Implementation Checklist

## Project Setup

- [x] Choose package manager and initialize the Node.js project for distribution.
- [ ] Choose npm package name:
  - [x] `pokecli`
  - [ ] `@pokecli/cli`
  - [ ] another available package name
- [x] Add TypeScript configuration.
- [x] Add CLI entrypoint for the `poke` executable.
- [x] Configure `package.json`:
  - [x] `name`
  - [x] `version`
  - [x] `description`
  - [x] `bin.poke`
  - [x] `files`
  - [x] `license`
  - [ ] `repository`
  - [x] `engines.node`
- [x] Add dependencies:
  - [x] `commander`
  - [x] `@inquirer/prompts`
  - [x] Node built-in `node:sqlite`
  - [x] `execa` or use Node `child_process`
- [x] Add development dependencies:
  - [x] `typescript`
  - [x] `tsx`
  - [x] `@types/node`
- [x] Add scripts:
  - [x] `dev`
  - [x] `build`
  - [x] `typecheck`
  - [x] `prepack`
  - [ ] `lint` if linting is introduced
- [x] Add `.gitignore`.
- [x] Add `LICENSE`.
- [x] Ensure `.poke/` runtime state is ignored.
- [x] Add README skeleton with install and quickstart sections.

## Core Utilities

- [x] Implement project root detection using the current working directory.
- [x] Validate supported platform:
  - [x] macOS
  - [x] Linux
  - [x] WSL caveat for Windows
- [x] Implement `.poke/` directory creation.
- [x] Implement `.poke/config.json` read/write helpers.
- [x] Implement deterministic `tmuxTarget` generation from the absolute project path.
- [x] Implement simple duration parser:
  - [x] `10s`
  - [x] `5m`
  - [x] `1h`
  - [x] `90m`
- [x] Implement timestamp helpers using ISO strings.
- [x] Implement structured error messages for missing config, missing `tmux`, and missing sessions.
- [x] Implement first-run dependency check for `tmux`.

## SQLite Persistence

- [x] Create `.poke/poke.db` automatically.
- [x] Add schema migration/bootstrap logic.
- [x] Create `rules` table.
- [x] Create `scheduled_actions` table.
- [x] Create `events` table.
- [x] Implement event logging helper.
- [x] Implement rule repository helpers:
  - [x] create
  - [x] list
  - [x] update enabled state
  - [x] find by id/name
- [x] Implement scheduled action repository helpers:
  - [x] create pending action
  - [x] list actions
  - [x] list due actions
  - [x] cancel action
  - [x] mark executed
  - [x] mark skipped
  - [x] mark failed
  - [x] find recent action by dedupe key

## Interactive First-Run Setup

- [x] Make bare `poke` detect missing `.poke/config.json`.
- [x] Prompt to confirm current directory.
- [x] Prompt for agent:
  - [x] Claude
  - [x] Codex
  - [x] Custom command
- [x] Set default command:
  - [x] `claude` for Claude
  - [x] `codex` for Codex
  - [x] prompt text input for custom command
- [x] Prompt to enable auto-resume-on-limit.
- [x] For Claude, preload Claude auto-resume template.
- [x] For Codex, preload Codex auto-resume template.
- [x] For custom command, prompt for match text or regex.
- [x] Prompt for resume delay, default `1h`.
- [x] Prompt for response text, default `continue`.
- [x] Prompt for dedupe window, default `90m`.
- [x] Write `.poke/config.json`.
- [x] Initialize `.poke/poke.db`.
- [x] Insert accepted rule template.
- [x] Ask whether to start the session now.
- [x] Ask whether to attach after starting.

## Existing Project Menu

- [x] Make bare `poke` detect existing config.
- [x] Show project summary:
  - [x] project root
  - [x] agent command
  - [x] tmux session status
  - [x] automation status
  - [x] pending action count
- [x] Add menu option: Attach to session.
- [x] Add menu option: Start session.
- [x] Add menu option: Send message.
- [x] Add menu option: Start watcher.
- [x] Add menu option: View rules.
- [ ] Add menu option: Edit auto-resume rule.
- [x] Add menu option: View pending actions.
- [x] Add menu option: Pause automation.
- [x] Add menu option: Resume automation.
- [x] Add menu option: Exit.

## tmux Integration

- [x] Implement `tmux` availability check.
- [x] Implement session exists check.
- [x] Implement start session:
  - [x] `tmux new-session -d -s <target> -c <projectRoot> <command>`
- [x] Implement attach session:
  - [x] `tmux attach -t <target>`
- [x] Implement send keys:
  - [x] `tmux send-keys -t <target> <text> Enter`
- [x] Implement capture pane:
  - [x] `tmux capture-pane -t <target> -p -S -<lines>`
- [x] Handle missing tmux session gracefully.
- [x] Log manual and automated sends.

## Direct CLI Commands

- [x] Implement `poke start`.
- [x] Implement `poke attach`.
- [x] Implement `poke send "text"`.
- [x] Implement `poke capture --lines 200`.
- [x] Implement `poke run`.
- [x] Implement `poke rules`.
- [x] Implement `poke rule add`.
- [x] Implement `poke actions`.
- [x] Implement `poke cancel <action-id>`.
- [x] Implement `poke pause`.
- [x] Implement `poke resume`.

## Rule Matching

- [x] Implement `contains` matcher.
- [x] Implement `regex` matcher.
- [x] Support case-insensitive regex patterns for default templates.
- [x] Normalize matched output for dedupe keys.
- [x] Compute dedupe key from rule id and normalized match.
- [x] Skip scheduling when a recent pending or executed action exists within dedupe window.
- [x] Log `rule_matched`.
- [x] Log `action_scheduled`.

## Watcher and Scheduler

- [x] Implement polling loop with default 5 second interval.
- [x] Capture configured tmux pane output each loop.
- [x] Evaluate enabled rules.
- [x] Create scheduled actions for new matches.
- [x] Load due scheduled actions each loop.
- [x] Before sending due action, confirm automation is not paused.
- [x] Before sending due action, confirm tmux session still exists.
- [x] If `require_still_visible` is enabled, re-capture pane and re-match rule.
- [x] Send response with Enter.
- [x] Mark action as executed.
- [x] Mark action as skipped with reason when checks fail.
- [x] Mark action as failed on unexpected errors.
- [x] Support graceful shutdown on Ctrl-C.

## Safety Controls

- [x] Automation is opt-in during setup.
- [x] `poke pause` blocks automated sends.
- [x] `poke resume` re-enables automated sends.
- [x] `poke actions --pending` shows scheduled sends before execution.
- [x] `poke cancel <action-id>` cancels pending sends.
- [x] Every automated send is logged with rule id and response.
- [x] Delayed actions re-check prompt visibility by default.
- [x] No semantic AI interpretation is used for matching.

## End-to-End Validation

- [ ] Create a temporary test project.
- [ ] Run `poke` setup with custom command `zsh`.
- [ ] Configure match text `limit over, try again later`.
- [ ] Configure response `continue`.
- [ ] Configure delay `10s`.
- [ ] Start the session.
- [ ] Start `poke run`.
- [ ] Send test output:
  - [ ] `poke send "echo 'limit over, try again later?'"`.
- [ ] Confirm pending action appears.
- [ ] Confirm response is sent after 10 seconds.
- [ ] Confirm duplicate scheduling is prevented within dedupe window.
- [ ] Confirm pending action cancellation works.
- [ ] Confirm pause prevents due action execution.

## Documentation

- [x] Update `README.md` with MVP purpose.
- [x] Document npm global install.
- [x] Document local development install with `npm link`.
- [x] Document first-run flow.
- [ ] Document default Claude and Codex auto-resume templates.
- [x] Document direct CLI commands.
- [x] Document safety behavior and limitations.
- [x] Document `tmux` prerequisite.
- [x] Document supported platforms:
  - [x] macOS
  - [x] Linux
  - [x] Windows through WSL only
- [ ] Document uninstall steps.
- [x] Document that PokeCLI is local-only and has no hosted backend.
- [x] Document that telemetry is not included in the MVP.

## Distribution Validation

- [x] Run `npm run build`.
- [x] Run `npm pack`.
- [x] Inspect package tarball contents.
- [x] Confirm package excludes:
  - [x] `.poke/`
  - [x] local databases
  - [x] logs
  - [x] test temp directories
- [ ] Install packed tarball globally.
- [ ] Confirm `poke --help` works globally.
- [ ] Confirm `poke` setup works in a fresh test directory.
- [ ] Confirm `poke start` works after global install.
- [ ] Confirm `poke run` works after global install.
- [ ] Prepare initial release notes.
