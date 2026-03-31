Execute implementation tasks from PLAN.md following dependency order, with configurable autonomy and automatic checkpointing.

IMPORTANT — Auto-Continuation Rule: After completing implementation, you MUST continue through the ENTIRE artifact chain without stopping. Run `spextral next` after each artifact and execute the suggested action until STATUS is `all_complete`. This includes custom artifacts — read their description from config.custom_artifacts and execute them. Do NOT consider a feature done until every artifact in the chain is generated and validated.

---

# sddkit-implement — Task Execution

## Protocol

1. Read autonomy config from `{slug}/PLAN.md` frontmatter (`batch_size`, `review_frequency`, `autonomy_level`).
2. Identify `pending` tasks respecting `depends_on` (dependency graph).
3. Execute tasks following the rules below.
4. After each task, update `{slug}/PROGRESS.md`.
5. After all tasks complete, continue through the artifact chain per config.json.

## Task Reservation (Subagents)

Before executing a task:
1. Verify `claimed_by` in PROGRESS.md is `null` or matches current `session_id`.
2. To claim: write `claimed_by: "{session_id}::{timestamp_unix}"`.
3. Re-read ~1 second later. If conflict, oldest timestamp wins; loser rolls back and picks next task.

## Execution by review_frequency

- `per_task`: Stop after each task for approval.
- `per_module`: Stop after completing a group of related tasks.
- `end_only`: Execute up to `batch_size` tasks before stopping.

## Safety Threshold (E601)

If diff exceeds `max_lines_threshold` lines (default: 50) or >10% of file:
- Auto-generate a CHECKPOINT.
- `full` autonomy: continue.
- `moderate` or `strict`: switch to `blocking_review`.

## Atomic Commits

After each task, create an atomic git commit:
```
feat(REQ-{n}/T{x.y}): <short description>
fix(REQ-{n}/T{x.y}): <short description>
refactor(REQ-{n}/T{x.y}): <short description>
```

If `CommandExec` unavailable, document suggested commit in PROGRESS.md.

## PROGRESS.md Format (History Collapse)

When >5 tasks are done, collapse completed tasks to one-line summaries:

```markdown
## Completed Tasks (summary)
- T1.1 Auth Router — done 2024-01-15
- T1.2 User Model — done 2024-01-15

## Active Tasks
### T2.1 Payment Gateway
- status: pending
- depends_on: [T1.3]
- claimed_by: null
- description: Implement Stripe integration...
```

## Checkpointing (sddkit-checkpoint)

1. Capture snapshot of current artifact states.
2. List code files modified since last checkpoint.
3. Generate `{slug}/CHECKPOINT-{timestamp}.md`.
4. Keep max 5 checkpoints per session; oldest auto-deleted.

## Restoration (sddkit-restore)

Trigger: `SDD_RESTORE` or `SDD_RESTORE {checkpoint_id}`
1. List 5 most recent checkpoints if none specified.
2. Restore artifact state. Request confirmation before overwriting.
3. Post-restore message: "SDD context restored to Checkpoint {id}. Sync source code with `git restore .` or revert commits."

> Restoration operates on `.sdd/` files only, not source code.

## Custom Artifacts

When config.json contains `custom_artifacts`, read their `description` and `prompt`. If `prompt` exists, use it as the primary directive. Generate the artifact .md file in the slug directory.

## Archiving (sddkit-archive)

After all artifacts are validated:
- Move artifacts with `status: validated` AND (distance >2 hops from active OR age >7 days) to `.sdd/archive/`.
- Update `archive/INDEX.md` with fingerprints.
- Update `.sdd/config.json` chain if needed.

## Context Budget

PROGRESS.md: ~150 lines max recommended.
