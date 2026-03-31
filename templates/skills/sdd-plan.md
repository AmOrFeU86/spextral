Generate a PLAN.md artifact for a feature. Maps tasks to requirements with dependency tracking and parallelism markers.

---

# sddkit-plan — Plan Creation

## Protocol

1. Read `{slug}/SPEC.md` to understand requirements.
2. Create `{slug}/PLAN.md` with task-to-REQ mapping.
3. Run sddkit-validate, then suggest next action from config.json chain.

## PLAN.md Structure

### Task Format

```markdown
## Tasks
### T1.1 (P) — Set up project structure
- covers: [REQ-1]
- depends_on: []

### T1.2 (P) — Implement user model
- covers: [REQ-1, REQ-3]
- depends_on: []

### T2.1 — Implement auth middleware
- covers: [REQ-2, REQ-4]
- depends_on: [T1.2]
```

### Rules

- **Task-to-REQ mapping is mandatory:** Every task MUST reference the `REQ-N` ID(s) it satisfies.
- **Parallelism markers `(P)`:** If a task has NO blocking dependencies (`depends_on` is empty or all deps are `done`), append `(P)` to the task ID.
- `(P)` markers are recalculated dynamically as dependencies complete.

### Autonomy Configuration

Include in PLAN.md frontmatter:

```yaml
autonomy_config:
  batch_size: 5              # Max tasks before mandatory pause
  review_frequency: "per_module"  # per_task | per_module | end_only
  autonomy_level: "moderate"      # strict | moderate | full
  max_lines_threshold: 50         # Diff lines before E601
```

| Level | review_frequency | batch_size | E601 behavior |
|-------|------------------|------------|---------------|
| `strict` | `per_task` | 1 | blocking_review |
| `moderate` | `per_module` | 3-5 | blocking_review |
| `full` | `end_only` | 10+ | continues |

### Handoff Metadata

| Current Artifact | Next Action | Hint |
|------------------|-------------|------|
| SPEC.md | sddkit-plan | Generate PLAN.md with task-to-REQ mapping |
| PLAN.md | sddkit-implement | Begin implementation following dependency order |
| PROGRESS.md (all done) | sddkit-test | Generate and execute unit tests |
| TEST.md | sddkit-security | Run static security analysis |
| SECURITY.md | sddkit-archive | Archive validated artifacts |

## Context Budget

PLAN.md: ~200 lines max recommended. Tasks should be granular, not encyclopedic.
