# PokeCLI

**Stop babysitting AI coding agents when they hit usage limits.**

You start `claude` (or `codex`), it works for a while, then prints:

> *You've reached the usage limit. Please try again at 3:00 PM.*

…and just sits there. If you're not at your desk at 3pm to type `continue`, you've lost hours of momentum. The agent doesn't resume itself.

PokeCLI runs the agent inside a project-local `tmux` session, watches the pane for that limit message, **reads the reset time directly out of it**, and types `continue` at exactly that moment so the work picks up the second the limit lifts.

```
14:00  agent hits limit  → "try again at 3:00 PM"
14:00  poke parses "3:00 PM", schedules "continue" for 15:00
15:00  poke verifies the prompt is still on screen, sends "continue"
15:00  agent resumes
```

That's the whole thing.

## Why not just an AI in a loop?

PokeCLI does **not** use an AI to decide what to send back. It matches the limit message with a regex, extracts the time string, parses it into a local timestamp, and types a single allowlisted response (`"continue"`). No model in the loop means no surprise instructions sent to your agent, no token cost to babysit a token-limited agent, and a behavior you can read off in 100 lines of code.

Before sending, it re-checks that the limit prompt is still on screen — so if you came back and resumed manually, the scheduled send is silently skipped instead of clobbering your in-progress work.

## Requirements

- Node.js 22.5 or newer
- `tmux`
- macOS or Linux (Windows via WSL only)

## Install

```bash
npm install -g https://github.com/rafsuntaskin/pokecli/releases/download/v0.1.4/pokecli-0.1.4.tgz
```

Replace `v0.1.4` and `0.1.4` with the latest release version.

Git-based installs also work, but the release tarball is preferred because it installs the already-built package without npm's git clone and link step:

```bash
npm install -g github:rafsuntaskin/pokecli
npm install -g git+ssh://git@github.com/rafsuntaskin/pokecli.git
```

For local development:

```bash
git clone git@github.com:rafsuntaskin/pokecli.git
cd pokecli
npm install
npm run build
npm link
```

## Release

To ship a GitHub release tarball:

```bash
npm version patch
git push --follow-tags
```

Pushing a `v*` tag runs the release workflow. It installs dependencies, typechecks, tests, builds `dist/`, creates `pokecli-<version>.tgz` with `npm pack`, and attaches the tarball to the matching GitHub release.

To create a tarball locally without publishing a release:

```bash
npm run pack:release
```

## Quickstart

```bash
cd /path/to/your/project
poke
```

One question on first run: Claude or Codex. PokeCLI starts the agent inside a project-local tmux session, auto-starts a hidden watcher in the same session, and attaches you to the agent. When the agent hits a limit, the watcher parses the reset time from the message and types `continue` at exactly that moment.

To detach without ending the session, press `Ctrl-b d`. To come back, run `poke` again from the same directory.

## Commands

```bash
poke                       # First-run wizard, or open the project menu
poke start                 # Start the configured agent in tmux
poke attach                # Attach to the tmux session
poke run                   # Run the watcher loop (use in a second terminal)
poke -m=resume             # Set the auto-resume message for this project
poke send "continue"       # Manually send text to the session
poke capture               # Print the last 200 lines of the pane
poke rules                 # List configured rules
poke actions --pending     # List scheduled responses
poke pause / poke resume   # Halt or resume automation without killing the session
```

## Scope

The MVP solves exactly one problem: auto-resume after a usage-limit prompt for Claude or Codex. Everything else (custom rules, custom agents, alternate responses) is supported through `poke rule add` but not part of the first-run experience. State lives in `.poke/` next to your project. No backend, no telemetry, no hosted anything.

The tmux server runs on a project-local socket at `.poke/tmux.sock`, separate from your default tmux — so PokeCLI sessions can't collide with whatever else you have running.
