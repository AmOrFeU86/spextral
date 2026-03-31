# Spextral — Spec-Driven Development Protocol (v2.5)

This project uses the **Spextral SDD** workflow. Artifacts live in `.sdd/`.

## Skills

| Skill | Purpose |
|-------|---------|
| `sdd-wake` | Activate protocol, discover project state |
| `sdd-spec` | Create SPEC.md (context, decisions, requirements) |
| `sdd-plan` | Create PLAN.md (tasks, dependencies, autonomy) |
| `sdd-implement` | Execute tasks, checkpointing, atomic commits |
| `sdd-review` | Devil-advocate analysis of SPEC/PLAN |
| `sdd-test` | Generate and run unit tests |
| `sdd-security` | Static security audit |
| `sdd-next` | Determine next workflow step |
| `sdd-status` | Report current progress |

## Rules (always active)

- Do NOT read `.sdd/archive/` unless the user explicitly asks for historical context.
- Artifacts are immutable once `validated` — never modify a validated SPEC or PLAN.
- All execution state updates go in `PROGRESS.md`, not in SPEC or PLAN.
- Follow the artifact chain defined in `.sdd/config.json`.
- Lazy Loading: only read the artifact you need, not all of `.sdd/`.

## Artifact State Machine

```
draft -> clarify -> ready -> validated -> blocking_review -> validated -> archived
                               |
                         fingerprint_mismatch -> (fix) -> ready
                               |
                         checkpointed -> (restore) -> draft|ready
```

| Status | Meaning |
|--------|---------|
| `draft` | In development, requires confirmation |
| `clarify` | Agent reviews for ambiguities, proposes questions to human |
| `ready` | Complete, sddkit-validate must run |
| `validated` | Verified, subsequent features may proceed |
| `blocking_review` | Paused per review_frequency, awaits human command |
| `fingerprint_mismatch` | Content changed unexpectedly, requires review |
| `checkpointed` | State saved after interruption |
| `archived` | Moved to `.sdd/archive/` |

## Required Frontmatter

```yaml
---
sdd_version: "2.5.0"
project_slug: "{slug}"
artifact_type: "{TYPE}"
timestamp: "{ISO-8601}"
status: "draft"
generated_by: "sddkit-{type}"
fingerprint: "{slug}:{type}:{date}:chars_{count}"
---
```

## Fingerprints

Calculated on post-frontmatter body: remove frontmatter (`---` delimiters), normalize CRLF to LF, count non-blank chars (`\S` regex). Format: `{slug}:{type}:{timestamp}:chars_{count}`

## Directory Structure

```
.sdd/
  archive/
    INDEX.md
  config.json        # Chain definition (source of truth for artifact order)
  {slug}/
    SPEC.md          # (required)
    PLAN.md          # (required)
    PROGRESS.md      # (optional)
    ...other artifacts per config.json chain
```

## Human Response Commands

Natural language approval accepted ("si", "ok", "go ahead"). Formal commands:

| Command | Meaning |
|---------|---------|
| `SDD_APPROVE` | Approve, continue with next block |
| `SDD_APPROVE_ALL` | Approve, switch to `review_frequency: end_only` for this session |
| `SDD_MODIFY {instruction}` | Apply correction, then continue |
| `SDD_REJECT` | Revert to last checkpoint, await instructions |
| `SDD_SKIP {task_id}` | Skip task, continue with next |

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| E601 | Safety threshold exceeded (>max_lines_threshold or >10%) | Create CHECKPOINT |
| E602 | Referenced artifact doesn't exist | Run repair, check archive/ |
| E603 | Cycle detected in depends_on | Write failed topological sort |
