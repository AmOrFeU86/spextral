Generate a SPEC.md artifact for a feature. Includes context, decisions, and requirements with REQ-IDs.

---

# sddkit-spec — Specification Creation

## Protocol

1. Read `.sdd/config.json` to confirm chain order.
2. Create `{slug}/SPEC.md` with the sections below.
3. Transition through states: `draft` → `clarify` → `ready` → `validated`.
4. Run sddkit-validate after creation.
5. After validation, suggest next action from config.json chain.

## SPEC.md Structure

```markdown
## Context
[Project background, technical constraints, integration points]

## Decisions
- [LOCKED] {constraint set by human — agent MUST NOT deviate}
- [DISCRETION] {agent chooses approach and documents rationale}
- [DEFERRED] {explicitly out of scope for this feature}

## Requirements
- REQ-1: {requirement}
- REQ-2: ...
```

### Decision Tags

| Tag | Meaning | Agent Behavior |
|-----|---------|----------------|
| `[LOCKED]` | Immovable constraint | Must NOT deviate |
| `[DISCRETION]` | Agent decides | Choose and document rationale |
| `[DEFERRED]` | Out of scope | Must NOT implement or plan |

If an implementation choice isn't covered by any tag, treat as `[DISCRETION]` and document in PROGRESS.md.

### EARS Requirement Format (Recommended)

| Pattern | Template |
|---------|----------|
| **Ubiquitous** | The system shall `<action>`. |
| **Event-driven** | When `<trigger>`, the system shall `<action>`. |
| **State-driven** | While `<state>`, the system shall `<action>`. |
| **Unwanted** | If `<condition>`, the system shall `<action>`. |
| **Optional** | Where `<feature>`, the system shall `<action>`. |

`REQ-N` IDs are **mandatory**. EARS style is recommended.

## Clarify Protocol

Before transitioning to `ready`, the agent MUST:
1. Identify ambiguous or underspecified requirements.
2. Check for contradictions between requirements.
3. List missing edge cases or error scenarios.
4. Present findings as numbered questions to the human.
5. Wait for approval (natural language OK) before transitioning to `ready`.

## Validation (sddkit-validate)

After creating the SPEC:
1. Verify YAML frontmatter syntax. Verify `status` is a valid state.
2. Check chain integrity (E602): all artifacts in config.json exist on disk.
3. Calculate fingerprint: post-frontmatter body, normalize CRLF to LF, count non-blank chars.
4. Verify every requirement has a `REQ-N` identifier.
5. Check context budget: SPEC should be <=~300 lines. Warn if >450 lines and suggest splitting.
6. Generate `{slug}/VALIDATION.md`.

## Context Budget

SPEC.md: ~300 lines max recommended. If >50% over, suggest splitting the feature into smaller slugs.
