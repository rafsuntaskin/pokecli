# PokeCLI

PokeCLI is a local CLI wrapper for one long-running AI agent session in a project directory. It starts `claude`, `codex`, or a custom command inside `tmux`, watches the terminal output, and can send allowlisted responses after a configured delay.

The first MVP use case is auto-resuming an agent after a usage limit prompt.

## Requirements

- Node.js 22.5 or newer
- `tmux`
- macOS or Linux
- Windows through WSL only

## Install

From GitHub:

```bash
npm install -g git+ssh://git@github.com/rafsuntaskin/pokecli.git
```

Or with HTTPS:

```bash
npm install -g github:rafsuntaskin/pokecli
```

After npm publishing:

```bash
npm install -g pokecli
```

For local development:

```bash
git clone git@github.com:rafsuntaskin/pokecli.git
cd pokecli
npm install
npm run build
npm link
```

## Quickstart

```bash
cd /path/to/project
poke
```

On first run, PokeCLI asks which agent to start and whether to enable the auto-resume-on-limit template.

## Common Commands

```bash
poke
poke start
poke attach
poke send "continue"
poke capture
poke run
poke rules
poke actions --pending
poke pause
poke resume
```

## Safety

PokeCLI does not use AI to decide what to answer. It only sends responses from rules that you explicitly enable. Delayed actions re-check the terminal output before sending by default.

PokeCLI stores project-local state in `.poke/` and has no hosted backend or telemetry in the MVP.

The MVP uses a project-local tmux socket at `.poke/tmux.sock`, separate from your default tmux server.
