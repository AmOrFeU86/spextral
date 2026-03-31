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
init → SDD_WAKE → spec → clarify → validate → review → plan → clarify → validate → implement → test → security → archive
```

1. **`npx spextral init`** — Sets up `.sdd/` and installs the protocol spec for your IDE
2. **`SDD_WAKE`** — Type this in your AI chat to activate the protocol
3. The agent takes over: creates the spec, validates it, builds a plan, implements it task by task

## Compatibility

| Platform | FileWrite | SubagentSpawn | CommandExec | ContextMemory | Native Skills |
|----------|-----------|---------------|-------------|---------------|---------------|
| Claude Code | Yes | Yes | Yes | Yes | Yes |
| GitHub Copilot | Yes | No | No | Partial | Yes |
| Kiro | Yes | No | No | Partial | Yes |

## CLI Commands

### `spextral init`

Interactive setup. Asks which IDE you use and copies the protocol spec to the right location:

| IDE | Destination |
|-----|-------------|
| Claude Code | `.claude/skills/spextral.md` |
| GitHub Copilot | `.github/copilot/spextral.md` |
| Kiro | `.kiro/skills/spextral.md` |

Also creates `.sdd/` and `.sdd/archive/`.

### `spextral doctor`

Validates your `.sdd/` structure:

- Checks fingerprints (non-blank char count, LF-normalized, post-frontmatter)
- Verifies artifact chain integrity against `.sdd/config.json`
- Validates statuses against the SDD state machine (`draft`, `clarify`, `ready`, `validated`, `blocking_review`, `fingerprint_mismatch`, `checkpointed`, `archived`)

### `spextral next`

Determines the next logical step in the SDD workflow by reading artifact state from `.sdd/`. Outputs routing instructions to `stdout` — no temporary files created.

- Reads frontmatters from all artifacts in the active slug
- Routes based on artifact progression: CONTEXT → SPEC → PLAN → IMPLEMENT → TEST → SECURITY → ARCHIVE
- Validates the dependency graph using **topological sort** (Kahn's algorithm, O(V+E))
- Emits `E-603` and exits with code 1 if circular dependencies are detected

```bash
spextral next
# SLUG: my-feature
# STATUS: spec_validated
# NEXT: Generate PLAN.md with task-to-REQ mapping, depends_on, and (P) parallelism markers.
```

#### `spextral next --quick`

Fast-path mode for experienced users. Emits instructions for the agent to generate condensed artifacts (SPEC+PLAN) in a single pass with full autonomy.

- Implicitly sets `autonomy_level: full` — the `clarify` state and `blocking_review` pauses are auto-approved
- Preserves physical artifact files for the fingerprint chain (no shortcuts on immutability)
- Validates the dependency graph before routing to implementation

```bash
spextral next --quick
# MODE: quick (autonomy_level: full — clarify and blocking_review auto-approved)
# SLUG: my-feature
# TASK_ORDER: T1.1 → T1.2 → T2.1 → T2.2
# NEXT: Execute sddkit-implement with autonomy_level: full, review_frequency: end_only. Atomic commits per task.
```

### `spextral update`

Fetches the latest `spextral.md` from the GitHub repo and replaces your local copy, showing the version diff.

## License

MIT
