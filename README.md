# Spextral

**Spec-Driven Development protocol for AI agents. One command to govern them all.**

```bash
npx spextral init
```

## What is Spextral?

Spextral is an IDE-agnostic protocol for Spec-Driven Development (SDD). It gives AI agents a structured workflow — from specification to implementation — using pure Markdown files with YAML frontmatter. No dependencies, no lock-in, no runtime.

- **Pure Markdown** — Instructions live in `.md` files your AI reads natively
- **Zero lock-in** — Works with any AI agent that reads project files
- **Versioned artifacts** — Every spec, plan, and checkpoint is traceable with fingerprints
- **Lazy loading** — Only the active artifact is loaded into context, preserving token budgets
- **Configurable autonomy** — Control how much the AI does before asking for review

## Workflow

```
init → SDD_WAKE → spec → validate → review → plan → validate → implement → checkpoint → done
```

1. **`npx spextral init`** — Sets up `.sdd/` and installs the protocol spec for your IDE
2. **`SDD_WAKE`** — Type this in your AI chat to activate the protocol
3. The agent takes over: creates the spec, validates it, builds a plan, implements it task by task

## Compatibility

| Platform | FileWrite | SubagentSpawn | CommandExec | ContextMemory |
|----------|-----------|---------------|-------------|---------------|
| Claude Code | Yes | Yes | Yes | Yes |
| Cursor | Yes | No | No | Partial |
| GitHub Copilot | Yes | No | No | Partial |
| Roo Code | Yes | No | Yes | Partial |
| Kiro | Yes | No | No | Partial |

## CLI Commands

### `spextral init`

Interactive setup. Asks which IDE you use and copies the protocol spec to the right location:

| IDE | Destination |
|-----|-------------|
| Claude Code | `.claude/skills/spextral.md` |
| Cursor | `.cursorrules` |
| GitHub Copilot | `.github/copilot/spextral.md` |
| Roo Code | `.clinerules` |
| Manual | Copy from `templates/` yourself |

Also creates `.sdd/`, `.sdd/archive/`, and IDE exclusion files (`.cursorignore`, `.copilotignore`).

### `spextral doctor`

Validates your `.sdd/` structure:

- Checks fingerprints (non-blank char count, LF-normalized, post-frontmatter)
- Verifies artifact chains (`previous_artifact` / `next_artifact` exist)
- Validates statuses against the SDD state machine (`draft`, `ready`, `validated`, `blocking_review`, `fingerprint_mismatch`, `checkpointed`, `archived`)

### `spextral update`

Fetches the latest `spextral.md` from the GitHub repo and replaces your local copy, showing the version diff.

## License

MIT
