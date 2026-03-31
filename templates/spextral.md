# Spextral — Spec-Driven Development Protocol (Version 2.5)

## 1. Vision and Philosophy

### Concept

Framework SDD agnostico basado en instrucciones portables con artefactos versionados, fingerprints verificables, lazy loading de contexto, mecanismos de continuidad entre sesiones, soporte para subagentes y autonomia configurable.

### Philosophy

1. **Todo es una Instruction:** Sin dependencias de codigo, solo logica en Markdown.
2. **Contratos Inmutables:** Los artefactos (`{slug}/{TYPE}.md`) son la base de la verdad.
3. **Zero Lock-in:** Funciona en cualquier IDE o chat.
4. **Eficiencia de Tokens (Lazy Loading + Archiving):** La IA solo lee el artefacto actual y sus vecinos inmediatos. Artefactos antiguos se archivan automaticamente.
5. **Validacion Ligera:** Fingerprints normalizados para verificacion portable en cualquier entorno y SO.
6. **Continuidad Garantizada:** Checkpoints y recuperacion ante limites de contexto o interrupciones.
7. **Autonomia Configurable:** El usuario define el nivel de supervision mediante parametros de granularidad.
8. **Concurrencia Ligera:** Reserva de tareas por sesion para soporte de subagentes sin locks pesados.
9. **Gobernanza Explicita:** CHANGELOG.md y reglas de migracion entre versiones del kit.

### Compatibility

| Platform | FileWrite | SubagentSpawn | CommandExec | ContextMemory | Native Skills |
|----------|-----------|---------------|-------------|---------------|---------------|
| Claude Code | Yes | Yes | Yes | Yes | Yes |
| GitHub Copilot | Yes | No | No | Partial | Yes |
| Kiro | Yes | No | No | Partial | Yes |

### Installation

Run `npx spextral init` to auto-install for one or more agents, or copy this file manually:
- **Claude Code:** `CLAUDE.md` (+ skills in `.claude/skills/`)
- **GitHub Copilot:** `.github/copilot-instructions.md` (+ skills in `.github/skills/`)
- **Kiro:** `.kiro/steering/spextral.md` (+ skills in `.kiro/skills/`)
- Or set `SDD_ROOT` environment variable for monorepos.

Multiple agents can coexist in the same project — each reads the protocol from its own path while sharing the `.sdd/` directory as the single source of truth.

Quick start: type `SDD_WAKE` (case-insensitive) in your AI chat.

---

## 2. Agent Behavior and Activation (AGENT)

### Cold Start Protocol (`SDD_WAKE`)

Many platforms (Copilot, web chats) don't proactively scan the project. The user activates the system by typing `SDD_WAKE`, `SDD_WAKE()`, `sdd_wake`, or any case-insensitive variant.

The agent must also recognize **natural-language equivalents** as implicit `SDD_WAKE` triggers. Examples include (but are not limited to):
- "nueva feature", "new feature", "empiezo feature nueva"
- "quiero añadir...", "I want to add..."
- "nuevo desarrollo", "let's build..."
- "siguiente tarea", "next task"

When any of these are detected and a `.sdd/` folder exists, the agent MUST execute the full `SDD_WAKE` discovery protocol before proceeding, ensuring the SDD workflow is always active.

On receiving this command:

1. Find the `.sdd/` folder (or the path defined in `SDD_ROOT`).
2. If it doesn't exist, suggest `sddkit-init`.
3. If it exists, run the **Discovery Algorithm**:
   - Group artifacts by `project_slug`.
   - Within each group, find the most recent by timestamp.
   - Apply **Lazy Loading**: Read only the frontmatter of the most recent file, ignoring the rest.
   - Verify chain integrity using `.sdd/config.json`.
4. **Capabilities Handshake:** The agent declares its active capabilities to adapt the flow:

```yaml
capabilities_detected:
  FileWrite: true
  FileRead: true
  CommandExec: false    # e.g. Cursor can't execute commands
  SubagentSpawn: true   # e.g. Claude Code can spawn subagents
  YAMLParse: true
```

If a feature requires an unavailable capability, the agent skips or adapts automatically (e.g. if `CommandExec: false`, don't attempt manual validation scripts).

### Welcome Protocol (Standardized Response)

The agent must respond in structured format for interoperability with extensions:

```yaml
---
sdd_response_type: "wake_confirmation"
project_slug: "{slug}"
last_artifact: "{file}"
progress: "{Completed}/{Total}"
status: "{status}"
suggested_next: "{next_suggested_feature}"
capabilities: { FileWrite: true, CommandExec: false, SubagentSpawn: true }
---
```

```markdown
## Spextral Activated ✓

**Project:** {slug}
**Status:** {status}
**Progress:** {Percentage}% ({Completed}/{Total})
**Last artifact:** {file}
**Capabilities:** FileWrite ✓ | CommandExec ✗ | SubagentSpawn ✓

Do you want me to run {next_suggested_feature}?
```

*Agent note:* The Agent MUST evaluate the math formula internally and display the final rounded value (e.g. `67%`). The internal calculation is:
$$ \text{Percentage} = \left( \frac{\text{Completed Tasks}}{\text{Total Tasks}} \right) \times 100 $$

---

## 3. Bridge — Triggers and Human Commands (BRIDGE)

### Universal Trigger Dictionary (Agent → System)

| Platform | Trigger Type | Command / Text |
|----------|-------------|----------------|
| Claude Code | Skill | `sdd-wake`, `sdd-spec`, `sdd-plan`, etc. |
| GitHub Copilot | Skill | `sdd-wake`, `sdd-spec`, `sdd-plan`, etc. |
| Kiro | Skill | `sdd-wake`, `sdd-spec`, `sdd-plan`, etc. |
| Any platform | Handshake | `SDD_WAKE` / `SDD_STATUS` / `SDD_RESTORE` |

### Standardized Human Response Commands (Human → Agent)

When the agent emits `blocking_review`, the human responds with one of these commands for unambiguous parsing:

| Command | Meaning |
|---------|---------|
| `SDD_APPROVE` | Approves the work done. The agent continues with the next block. |
| `SDD_APPROVE_ALL` | Approves and temporarily switches to `review_frequency: end_only` for this session. |
| `SDD_MODIFY {instruction}` | Partial approval. The agent applies the indicated correction before continuing. |
| `SDD_REJECT` | Rejects the block. The agent reverts to the last checkpoint and awaits instructions. |
| `SDD_SKIP {task_id}` | Skips the indicated task and continues with the next available one. |

> **Note:** The agent must accept natural-language approval responses (e.g. "sí", "ok", "procede", "continue", "approved", "go ahead") as equivalents to `SDD_APPROVE`. When requesting approval, phrase questions naturally — never require the user to type exact commands like `SDD_APPROVE`.

### Artifact State Machine

Valid transitions between states are strictly the following. The AI must not invent states outside this set:

```
draft → clarify → ready → validated → blocking_review → validated → archived
                              ↓
                        fingerprint_mismatch → (fix) → ready
                              ↓
                        checkpointed → (restore) → draft|ready
```

| Status | Meaning / Action |
|--------|-----------------|
| `draft` | In development. Requires confirmation. |
| `clarify` | **Adversarial Review**: The Agent executes an internal review searching for ambiguities, missing edge cases, and contradictions. It proposes clarification questions to the human. Transition to `ready` occurs when the human approves (natural language accepted). |
| `ready` | Complete. `sddkit-validate` must run. |
| `validated` | Verified. Subsequent features may proceed. |
| `blocking_review` | **Configurable Pause**: The Agent stops according to `review_frequency`. Awaits human command. |
| `fingerprint_mismatch` | **Discrepancy detected**: The fingerprint doesn't match. Requires review. |
| `checkpointed` | State saved after interruption. |
| `archived` | Moved to `.sdd/archive/`. Only accessible via index. |

> **Clarify Protocol:** When an artifact transitions to `clarify`, the Agent MUST:
> 1. Identify ambiguous or underspecified requirements.
> 2. Check for contradictions between stated requirements.
> 3. List missing edge cases or error scenarios.
> 4. Present all findings as numbered questions to the human.
> 5. Wait for approval (natural language like "sí", "ok" is fine; or formal commands like `SDD_APPROVE`) before transitioning to `ready`.
> This ensures no artifact reaches implementation with unresolved ambiguities.

> **Artifact Immutability Rule vs. Tasks:**
> The states in the machine above apply **exclusively at the file/artifact level**. Once static artifacts like `{slug}/SPEC.md` or `{slug}/PLAN.md` reach `validated` status, **they are frozen immutably**.
> During `sddkit-implement` execution, code progress must NOT alter the states or contents of the SPEC or PLAN (to avoid constantly invalidating their fingerprints). All execution state updates (`pending`, `in_progress`, `done`) must occur **strictly within `{slug}/PROGRESS.md`**.

---

## 4. Artifact Directory Structure

Artifacts are organized in subdirectories per feature slug:

```
.sdd/
├── archive/                      # Archived artifacts (>7 days or >2 hops)
│   └── INDEX.md                  # Index of archived artifacts with fingerprints
├── {slug}/
│   ├── SPEC.md                   # Context + Decisions + Requirements (required)
│   ├── PLAN.md                   # Task roadmap (required)
│   ├── PROGRESS.md               # Execution tracking (optional)
│   ├── VALIDATION.md
│   ├── CHECKPOINT-{id}.md
│   ├── REVIEW.md
│   ├── TEST.md
│   └── SECURITY.md
└── {another-slug}/
    └── ...
```

Each slug gets its own folder under `.sdd/`. This keeps features isolated and the directory clean. The artifact chain order is defined centrally in `.sdd/config.json` (see §3.1 Chain Configuration).

### Chain Configuration (§3.1)

The artifact chain is defined in `.sdd/config.json` as the single source of truth for artifact ordering and routing. This file is generated during `spextral init` based on the user's feature selection.

```json
{
  "chain": ["SPEC", "PLAN", "PROGRESS", "GDPR", "TEST", "SECURITY"],
  "custom_artifacts": {
    "GDPR": {
      "description": "GDPR compliance analysis and data processing inventory",
      "prompt": "Analyze all data flows in the implemented code. For each personal data field: identify source, processing purpose, legal basis, retention period, and third-party transfers. Flag any processing without explicit consent."
    }
  }
}
```

- **Required artifacts** (SPEC, PLAN) are always present and cannot be removed.
- **Optional artifacts** (PROGRESS, VALIDATION, CHECKPOINT, REVIEW, TEST, SECURITY) are included based on user selection during init.
- **Custom artifacts** can be added during init for domain-specific needs (e.g. GDPR, DEPLOYMENT, MIGRATION). Each custom artifact has a `description` (what it is) and an optional `prompt` (specific instructions the agent MUST follow when generating it). If `prompt` is present, the agent uses it as the primary directive; otherwise, it generates based on the description alone.
- The chain order determines the routing logic for `spextral next` and the handoff sequence between artifacts.
- Agents MUST read `.sdd/config.json` to determine the next artifact in the chain instead of relying on frontmatter fields.

### Decision Fidelity

Every `SPEC.md` MUST include a `## Decisions` section. Each decision is tagged with one of these labels:

| Tag | Meaning | Agent Behavior |
|-----|---------|----------------|
| `[LOCKED]` | Immovable constraint set by the human. | The Agent must NOT deviate under any circumstance. |
| `[DISCRETION]` | The Agent is free to decide the approach. | The Agent chooses and documents the rationale. |
| `[DEFERRED]` | Explicitly out of scope for this feature. | The Agent must NOT implement or plan for it. |

```markdown
## Decisions
- [LOCKED] Authentication must use OAuth 2.0 with PKCE flow.
- [DISCRETION] Choice of HTTP client library.
- [DEFERRED] Admin dashboard — will be a separate feature.
```

> **Rule:** If the Agent encounters an implementation choice not covered by any decision tag, it MUST treat it as `[DISCRETION]` and document its choice in PROGRESS.md.

---

## 5. Features

### sddkit-init

- **Required Capabilities:** `FileWrite`
- **Initialization Protocol:**
  1. Create `.sdd/` and `.sdd/archive/` structure.
  2. Generate seed artifacts: `{slug}/SPEC.md` (empty template with Context, Decisions, and Requirements sections).
  3. **Create exclusion rules for IDEs** that auto-vectorize or index the workspace:
     - `.copilotignore`: add `.sdd/archive/**` (GitHub Copilot)
     - If these files already exist, append the rule without overwriting.
  4. **Generate native skills** for agents that support them (Claude Code, Copilot, Kiro):
     - `sdd-wake`: Activates the SDD protocol and runs discovery.
     - `sdd-spec`: Creates SPEC.md with context, decisions, and requirements.
     - `sdd-plan`: Creates PLAN.md with task mapping and dependencies.
     - `sdd-implement`: Executes tasks with autonomy and checkpointing.
     - `sdd-review`: Devil-advocate analysis of SPEC and PLAN.
     - `sdd-test`: Generates and executes unit tests.
     - `sdd-security`: Static security audit with OWASP mapping.
     - `sdd-next`: Determines the next workflow step.
     - `sdd-status`: Reports current project progress.
  5. This ensures lazy loading is respected — only the relevant skill is loaded into context when needed, instead of the entire protocol.

### Frontmatter (Required vs Optional Fields)

**Required (Minimalist):**
```yaml
---
sdd_version: "2.5.0"
project_slug: "myapp"
artifact_type: "SPEC"
timestamp: "2024-01-15T10:30:00Z"
status: "draft"
generated_by: "sddkit-spec"
---
```

**Optional (Extended):**
```yaml
---
# ... required fields ...
fingerprint: "myapp:SPEC:2024-01-15:chars_2450"  # Non-blank char count of body
session_id: "uuid-v4"
depends_on: []        # For tasks in PLAN
claimed_by: null      # format: "{session_id}::{timestamp_unix}" or null
capabilities_required: ["FileWrite", "YAMLParse"]
autonomy_config:
  batch_size: 3
  review_frequency: "per_module"  # per_task | per_module | end_only
  autonomy_level: "moderate"      # strict | moderate | full
  max_lines_threshold: 50         # Diff lines before E601 (default: 50)
handoff:
  next_action: "sddkit-plan"
  prompt_hint: "Generate PLAN.md with task-to-REQ mapping"
---
```

### Handoff Metadata

Each artifact type declares its natural successor in the SDD chain. Agents MUST use this table to determine the recommended next action after completing an artifact. This enables automated workflow routing without hardcoding flow logic in the agent.

| Current Artifact | handoff.next_action | handoff.prompt_hint |
|------------------|---------------------|---------------------|
| SPEC.md | sddkit-plan | Generate PLAN.md with task-to-REQ mapping and depends_on |
| PLAN.md | sddkit-implement | Begin implementation following dependency order |
| PROGRESS.md (all done) | sddkit-test | Generate and execute unit tests |
| TEST.md | sddkit-security | Run static security analysis |
| SECURITY.md | sddkit-archive | Archive validated artifacts |

Agents MAY include handoff metadata in artifact frontmatter for explicit routing (see `handoff` field in the Optional example above). When the agent completes an artifact and transitions it to `validated`, it SHOULD read the handoff table to suggest or automatically execute the next action (depending on `autonomy_level`).

### Normalized Fingerprints

The fingerprint is calculated exclusively on the **artifact body** (post-frontmatter content), with the following normalization rules:

1. **Extract body:** Remove the entire frontmatter block (between `---` delimiters).
2. **Normalize line endings:** Convert all `\r\n` (CRLF) to `\n` (LF).
3. **Count non-blank characters:** Sum only characters that are not spaces, tabs, or newlines (`\S` in regex).
4. **Format:** `{slug}:{type}:{timestamp}:chars_{count}`

```
# Example:
fingerprint: "myapp:SPEC:2024-01-15:chars_2450"
```

This guarantees the fingerprint is identical regardless of operating system, and that metadata changes (like `status`) don't trigger false `fingerprint_mismatch`.

> **Intentional trade-off:** Non-blank character counting doesn't detect changes that only affect indentation (e.g. a reindented Python code block). This is a deliberate concession in favor of cross-OS portability. The fingerprint is designed to detect accidental corruption and content manipulation, not to be a cryptographic hash.

### SPEC.md Conventions — Requirements Format

**Mandatory Requirement IDs:** Every requirement in `SPEC.md` MUST have a unique numeric identifier with the format `REQ-N` (e.g. `REQ-1`, `REQ-2`). Requirements without IDs are invalid and `sddkit-validate` must flag them.

**Recommended: EARS Format (Easy Approach to Requirements Syntax).** Use these sentence templates to write unambiguous requirements:

| EARS Pattern | Template | Example |
|-------------|----------|---------|
| **Ubiquitous** | The system shall `<action>`. | `REQ-1` The system shall hash passwords with bcrypt. |
| **Event-driven** | When `<trigger>`, the system shall `<action>`. | `REQ-2` When a login fails 5 times, the system shall lock the account for 15 min. |
| **State-driven** | While `<state>`, the system shall `<action>`. | `REQ-3` While in offline mode, the system shall queue mutations locally. |
| **Unwanted** | If `<condition>`, the system shall `<action>`. | `REQ-4` If the JWT is expired, the system shall return HTTP 401. |
| **Optional** | Where `<feature>`, the system shall `<action>`. | `REQ-5` Where 2FA is enabled, the system shall require a TOTP code. |

> **Note:** EARS is *recommended* (not mandatory) for writing style, but `REQ-N` IDs are *mandatory*. The IDs enable traceability across PLAN tasks, tests, and commits.

### sddkit-validate (Lightweight and Universal)

- **Required Capabilities:** `FileRead`, `YAMLParse`
- **Validation Protocol:**
  1. **Structural Validation:** Verify YAML syntax strictly. Verify that `status` is one of the valid states defined in the state machine (including `clarify`).
  2. **Chain Validation (E602):** Check that all artifacts in `.sdd/config.json` chain exist physically on disk (search both `.sdd/{slug}/` and `.sdd/archive/`). Emit error E602 if any are missing.
  3. **Fingerprint Validation:** Extract post-frontmatter body, normalize to LF, count non-blank characters, and compare against stored fingerprint. If discrepancy, set `status: fingerprint_mismatch`.
  4. **REQ-ID Validation (SPEC only):** If the artifact is a SPEC, verify every requirement has a `REQ-N` identifier. Flag any requirement without an ID as a warning.
  5. **Context Budget Check:** Count the artifact's total lines. If it exceeds the recommended limit by >50% (see §9 Context Budgets), emit a warning suggesting the feature be split.
  6. Emit the report `.sdd/{slug}/VALIDATION.md`.

### sddkit-checkpoint

- **Required Capabilities:** `FileWrite`, `FileRead`
- **Creation Protocol:**
  1. Capture snapshot of current state of all artifacts.
  2. List code files modified since the last checkpoint.
  3. Generate `{slug}/CHECKPOINT-{timestamp}.md`.
  4. Update references in active artifacts.
- **Retention Policy:** Keep maximum 5 checkpoints per session. The oldest is automatically deleted.

### sddkit-restore

- **Trigger:** Command `SDD_RESTORE` or `SDD_RESTORE {checkpoint_id}`
- **Protocol:**
  1. If no checkpoint is specified, list the 5 most recent.
  2. Restore artifact state to the selected checkpoint moment.
  3. Request confirmation before overwriting current artifacts.
  4. Update `status` to `checkpointed`.
  5. **Mandatory post-restoration message:** The Agent MUST display: *"⚠️ SDD context restored to Checkpoint {id}. Remember to sync your source code with this state using `git restore .` or reverting the corresponding commits."*

> **Note:** Restoration operates on SDD artifacts (`.sdd/` files), not source code. To revert code, use the project's version control system (git).

### sddkit-repair

- **Required Capabilities:** `FileRead`, `FileWrite`
- **Chain Repair Protocol:**
  1. Scan all artifacts in `.sdd/` and `.sdd/archive/`.
  2. Detect artifacts missing from the chain defined in `.sdd/config.json`.
  3. Reconstruct chain in config based on timestamps and `artifact_type`.
  4. Recalculate fingerprints with normalized format if legacy format is detected.
  5. Release tasks with `claimed_by` from inactive sessions (>1 hour without activity).
  6. Generate repair report with changes made.
  7. If ambiguous, request human intervention.

### PLAN.md Conventions — Task Mapping and Parallelism Markers

**Mandatory Task-to-REQ Mapping:** Every task in `PLAN.md` MUST reference the `REQ-N` identifier(s) it satisfies from `SPEC.md`. This enables traceability and Goal-Backward Verification.

**Parallelism Markers `(P)`:** If a task has NO blocking dependencies (`depends_on` is empty or all dependencies are already `done`), the Agent MUST append the suffix `(P)` to the task ID, indicating it is parallelizable. This enables subagents or the user to identify tasks that can be executed concurrently.

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

> **Rule:** `(P)` markers are recalculated dynamically. When a dependency is completed, the Agent must re-evaluate and add `(P)` to newly unblocked tasks in PROGRESS.md.

### sddkit-review (Devil-Advocate)

- **Required Capabilities:** `FileRead`, `YAMLParse`
- **Review Protocol:**
  1. Load `{slug}/SPEC.md` and `{slug}/PLAN.md`.
  2. **Contradiction Analysis:** Identify discrepancies between specification and plan.
  3. **Task Coverage:** Verify that each SPEC requirement has associated tasks.
  4. **Goal-Backward Verification (mandatory):** The Agent MUST verify coverage **backward** — iterating every `REQ-N` in the SPEC and confirming it has explicit coverage in at least one PLAN task's `covers` field. Any uncovered REQ is a **blocking** finding. The verification output must be a checklist:
     ```
     ✅ REQ-1 → T1.1, T1.2
     ✅ REQ-2 → T2.1
     ❌ REQ-5 → NO COVERAGE — blocking
     ```
  5. **Edge Cases:** List unconsidered scenarios.
  6. **Dependency Graph:** To validate cycles, the AI MUST write the **Topological Sort** (linear ordering) of all tasks. If linear ordering is impossible, emit E603 indicating the tasks involved in the cycle.
  7. Generate `{slug}/REVIEW.md` with findings classified by severity (blocking / warning / informational).

### sddkit-implement (With Configurable Autonomy)

- **Required Capabilities:** `FileWrite`, `FileRead`
- **Enhanced Atomic Execution Protocol:**
  1. Read autonomy configuration (`batch_size`, `review_frequency`, `autonomy_level`).
  2. Identify `pending` tasks respecting `depends_on` (dependency graph).
  3. **Task Reservation (Subagents and Tie-breaking):** Before executing a task, verify that `claimed_by` in `{slug}/PROGRESS.md` is empty (`null`) or matches the current `session_id`.
     - To take a task, write: `claimed_by: "{session_id}::{timestamp_unix}"`.
     - **Deterministic verification:** After writing, re-read the file ~1 second later. If another subagent also claimed the task simultaneously, the one with the **oldest (lowest) `timestamp_unix`** wins. The losing subagent must rollback its claim and find the next `pending` task.
  4. **Execute according to `review_frequency`:**
     - `per_task`: Stop after each task (strict behavior).
     - `per_module`: Stop after completing a group of related tasks.
     - `end_only`: Execute up to `batch_size` tasks or end of plan.
  5. **Safety Threshold (E601):** If the diff exceeds **`max_lines_threshold` lines (default: 50) or >10% of the file**, auto-generate a CHECKPOINT. Post-checkpoint behavior depends on `autonomy_level`:
     - `full`: Generates checkpoint and **continues** automatically.
     - `moderate` or `strict`: Generates checkpoint and switches to `blocking_review`. The human decides if the massive refactoring is desired.
  6. **Atomic Commits:** After completing each task, the Agent MUST create an atomic git commit using the requirement and task IDs. Format:
     ```
     feat(REQ-{n}/T{x.y}): <short description>
     ```
     Examples:
     - `feat(REQ-1/T1.1): add user model with validation`
     - `fix(REQ-4/T2.3): handle expired JWT with 401 response`
     - `refactor(REQ-2/T1.5): extract auth middleware to separate module`
     This ensures every commit is traceable to a requirement, enables granular rollback, and prevents monolithic "implement everything" commits that are impossible to review or revert.
     > **Note:** If `CommandExec` is not available, the Agent documents the suggested commit message in PROGRESS.md for the user to execute manually.
  7. Show diff or summary to the user.
  8. Update `{slug}/PROGRESS.md`.

### sddkit-test (Unit Testing)

- **Required Capabilities:** `FileWrite`, `FileRead`, `CommandExec`
- **Trigger:** Runs automatically after `sddkit-implement` completes all tasks, or manually via `SDD_TEST`.
- **Protocol:**
  1. Read `{slug}/SPEC.md` and `{slug}/PROGRESS.md` to understand requirements and implemented tasks.
  2. **Detect project language and test framework:**
     - Python → `pytest`
     - JavaScript/TypeScript → `vitest` or `jest` (prefer vitest)
     - Go → `go test`
     - Rust → `cargo test`
     - If unclear, ask the user.
  3. **Generate unit tests** for each implemented task:
     - One test file per source module (e.g. `test_main.py` for `main.py`).
     - Cover: happy path, edge cases, and error handling per requirement in SPEC.
     - Minimum: one test per REQ in the SPEC.
  4. **Execute tests** and capture results.
  5. **Generate `{slug}/TEST.md`** with:
     - Test matrix: requirement → test → pass/fail
     - Coverage summary (if tool available)
     - Failed tests with error output
  6. If all tests pass → status `validated`. If any fail → status `blocking_review` with failure details.

```yaml
# TEST.md frontmatter
---
sdd_version: "2.5.0"
project_slug: "{slug}"
artifact_type: "TEST"
timestamp: "2026-01-15T10:30:00Z"
status: "validated"
generated_by: "sddkit-test"
fingerprint: "{slug}:TEST:{date}:chars_{count}"
test_summary:
  total: 5
  passed: 5
  failed: 0
  coverage: "87%"
---
```

> **Note:** If `CommandExec` is not available (e.g. Cursor), the agent generates the test files but skips execution, marking the TEST artifact as `draft` with a note to run manually.

### sddkit-security (Security Audit)

- **Required Capabilities:** `FileRead`
- **Trigger:** Runs after `sddkit-test` (if available) or after `sddkit-implement`, or manually via `SDD_SECURITY`.
- **Protocol:**
  1. Read all source files referenced in `{slug}/PROGRESS.md`.
  2. **Static Analysis** — Scan for:
     - **Secrets & Credentials:** Hardcoded API keys, tokens, passwords, connection strings. Patterns: high-entropy strings, common variable names (`secret`, `password`, `api_key`, `token`).
     - **Injection Vulnerabilities:** SQL injection, command injection, XSS, path traversal. Check for unsanitized user inputs in queries, shell commands, HTML output, and file paths.
     - **Authentication & Authorization:** Missing auth checks, weak session handling, insecure token storage.
     - **Dependency Risks:** Known vulnerable packages (check against version if `CommandExec` available), overly permissive dependencies.
     - **Data Exposure:** Sensitive data in logs, verbose error messages, debug mode in production config.
     - **Configuration:** Insecure defaults (DEBUG=true, CORS=*, permissive file permissions).
  3. **Classify findings by severity:**
     - **Critical:** Exploitable vulnerabilities (injection, hardcoded secrets, auth bypass). Blocks deployment.
     - **High:** Likely exploitable with effort (weak crypto, missing rate limiting). Should fix before production.
     - **Medium:** Best-practice violations (missing input validation, verbose errors). Fix when possible.
     - **Low:** Informational (outdated patterns, missing security headers). Nice to have.
  4. **Generate `{slug}/SECURITY.md`** with:
     - Summary table: severity → count
     - Detailed findings: file, line, description, remediation
     - OWASP category mapping where applicable
  5. If any **Critical** finding → status `blocking_review`. Otherwise → status `validated` with warnings listed.

```yaml
# SECURITY.md frontmatter
---
sdd_version: "2.5.0"
project_slug: "{slug}"
artifact_type: "SECURITY"
timestamp: "2026-01-15T10:30:00Z"
status: "validated"
generated_by: "sddkit-security"
fingerprint: "{slug}:SECURITY:{date}:chars_{count}"
security_summary:
  critical: 0
  high: 1
  medium: 2
  low: 3
---
```

> **Note:** This is a best-effort static analysis by the AI agent, not a replacement for dedicated security tools (SAST/DAST). For production systems, complement with tools like `semgrep`, `bandit` (Python), `npm audit` (Node.js), or `gosec` (Go).

### sddkit-archive (Automatic Pruning)

- **Required Capabilities:** `FileWrite`, `FileRead`
- **Archival Criteria:**
  - Artifacts with `status: validated` AND
  - Distance >2 hops from active artifact OR age >7 days.
- **Protocol:**
  1. Move eligible artifacts to `.sdd/archive/`.
  2. Update `INDEX.md` with fingerprints of archived files.
  3. Update `.sdd/config.json` chain if needed for traceability.

---

## 6. PROGRESS.md Format (With History Collapse)

To prevent completed task history from consuming unnecessary context, PROGRESS.md applies **automatic collapse**:

- **Active tasks** (`pending`, `in_progress`, `claimed`): Shown complete with description, dependencies, and notes.
- **Completed tasks** (>5 tasks done): Collapsed to a one-line summary each:

```markdown
## Completed Tasks (summary)
- ✅ T1.1 Auth Router — done 2024-01-15
- ✅ T1.2 User Model — done 2024-01-15
- ✅ T1.3 Session Manager — done 2024-01-16

## Active Tasks
### T2.1 Payment Gateway
- status: pending
- depends_on: [T1.3]
- claimed_by: null
- description: Implement Stripe integration...
```

This maintains full traceability without wasting tokens on already-finished tasks.

---

## 7. Error Handling

| Code | Description | Action |
|------|-------------|--------|
| E601 | Safety threshold exceeded (>`max_lines_threshold` lines or >10%) | Create CHECKPOINT. Continue or stop depending on `autonomy_level`. |
| E602 | Referenced artifact doesn't exist | Run `sddkit-repair`. Also search in `archive/`. |
| E603 | Cycle detected in `depends_on` | Write failed topological sort. Alert with involved tasks. |

---

## 8. Autonomy Configuration

```yaml
# Example configuration in {slug}/PLAN.md
autonomy_config:
  batch_size: 5              # Max tasks before mandatory pause
  review_frequency: "per_module"  # per_task | per_module | end_only
  autonomy_level: "moderate"      # strict | moderate | full
  max_lines_threshold: 50         # Diff lines before E601 (default: 50)
```

| autonomy_level | review_frequency | batch_size | E601 post-checkpoint | Description |
|----------------|------------------|------------|----------------------|-------------|
| `strict` | `per_task` | 1 | `blocking_review` | Manual approval of each task |
| `moderate` | `per_module` | 3-5 | `blocking_review` | Approval per functional group |
| `full` | `end_only` | 10+ | Continues | Approval only at end of PLAN |

### Flexible Paths and Monorepos

```bash
# Environment variable for custom path
export SDD_ROOT="/path/to/monorepo/packages/auth/.sdd"

# Automatic monorepo search
# Spextral searches for .sdd/ in: ./ → ../ → ../../ until found
```

---

## 9. How It Works

### Lazy Loading + Archiving

Spextral is designed to not overwhelm the AI's context window. Features are strictly forbidden from using `cat .sdd/*` globally. Context navigation must follow the artifact chain defined in `.sdd/config.json`, which serves as the single source of truth for artifact ordering. Old artifacts are automatically archived, keeping only the index in memory.

### Context Budgets (Artifact Size Limits)

To prevent LLM context degradation ("lost in the middle" effect), artifacts SHOULD respect these recommended size limits:

| Artifact | Max Lines | Rationale |
|----------|-----------|-----------|
| `SPEC.md` | ~300 | Context + Decisions + Requirements combined. Forces modularization into smaller features. |
| `PLAN.md` | ~200 | Tasks should be granular, not encyclopedic. |
| `PROGRESS.md` | ~150 | Completed tasks auto-collapse (see §6). |
| `REVIEW.md` | ~150 | Focus on blocking/warning findings only. |
| `TEST.md` | ~100 | Summary + failures only; full logs stay external. |
| `SECURITY.md` | ~100 | Summary + critical/high findings. |

> **Enforcement:** These are *soft limits*, not hard errors. If `sddkit-validate` detects an artifact exceeding its budget by >50%, it emits a **warning** (not an error) suggesting the feature be split into smaller slugs. The Agent should proactively suggest splitting when drafting a SPEC that approaches the limit.

### Context Leak Protection in IDEs

IDEs like Cursor and Copilot automatically vectorize and index all workspace files in background, injecting archived content into context without the agent requesting it. To prevent this, `sddkit-init` creates exclusion files (`.cursorignore`, `.copilotignore`) that exclude `.sdd/archive/**` from indexing. This guarantees the efficiency formula $C_{\text{active}} \ll C_{\text{total}}$ holds regardless of IDE.

### Normalized Fingerprints

All platforms use the same verification mechanism: a lightweight fingerprint calculated on the post-frontmatter body, with line ending normalization and non-blank character counting. Format: `{slug}:{type}:{timestamp}:chars_{count}`. This guarantees total portability across Windows, macOS, and Linux, without depending on `CommandExec` or external tools. If the fingerprint doesn't match, the artifact is marked as `fingerprint_mismatch` and requires review before continuing.

### Dependency Graph

Tasks in PLAN can include `depends_on: [task_id]`. This enables:
- Identifying tasks executable in parallel.
- Detecting truly blocked tasks.
- Preventing execution of tasks with unfulfilled prerequisites.
- Cycle detection uses written topological sort to guarantee reliability.

### Lightweight Concurrency (Subagents)

In environments supporting subagents (like Claude Code), multiple instances can work on the same `.sdd/` simultaneously. Coordination is based on task reservation with deterministic tie-breaking: each PLAN task has a `claimed_by` field with format `"{session_id}::{timestamp_unix}"`. Before executing, the subagent verifies the task isn't reserved, claims it with its timestamp, and re-reads ~1 second later to confirm. In case of a tie, the oldest timestamp wins. `sddkit-repair` releases reservations from inactive sessions (>1 hour). This model is intentionally simple — it uses no file-level locks or complex coordination, making it compatible with any platform.

### Accessing Archived Knowledge

Since `.cursorignore` and `.copilotignore` exclude `.sdd/archive/` from automatic indexing, the Agent won't have context of old artifacts by default. If the user makes an explicit historical query (e.g. "what did we decide about authentication 3 weeks ago?"), the Agent MUST first consult `INDEX.md` (located in `.sdd/archive/`, but always accessible via `FileRead`) to locate the specific artifact and load it on demand. This preserves lazy loading without sacrificing traceability.

```bash
# Manual fingerprint validation script (optional)
# macOS/Linux — count non-blank characters of the body
sed '/^---$/,/^---$/d' .sdd/myapp/SPEC.md | tr -d '[:space:]' | wc -c
# Compare the result with the chars_nnn field in the fingerprint
```

---

## 10. End-to-End Example

Practical case: "REST API":

1. User runs `SDD_WAKE`. Agent responds with structured YAML including detected capabilities.
2. The Agent creates the SPEC. `sddkit-validate` verifies the structure and generates a normalized fingerprint.
3. **Devil-Advocate Phase:** `sddkit-review` writes the topological sort of tasks and detects that the logout endpoint isn't covered in the PLAN.
4. The Agent creates the PLAN with `depends_on` for tasks with dependencies.
5. Configure `autonomy_level: moderate` with `review_frequency: per_module`.
6. In `sddkit-implement`, the AI completes *T1.1 (Auth Router)*, *T1.2 (User Model)*, *T1.3 (Session Manager)* and emits `blocking_review`.
7. The human responds `SDD_APPROVE`.
8. While implementing *T2.1*, the diff exceeds 50 lines → E601 → automatic checkpoint → `blocking_review` (because `autonomy_level: moderate`).
9. The human responds `SDD_APPROVE`. The AI continues.
10. Upon finishing implementation, `sddkit-test` auto-generates unit tests for each module, runs them, and produces `restapi/TEST.md`. All 12 tests pass → `validated`.
11. `sddkit-security` scans the codebase: finds a hardcoded DB password (Critical) and missing rate limiting (High) → `blocking_review`. The human fixes the password, responds `SDD_APPROVE`.
12. `sddkit-archive` moves validated artifacts to `.sdd/archive/`.

---

## CHANGELOG

### v2.5.0
- **Artifact Fatigue Reduction:** Simplified entry barrier from 4 required artifacts to 2 (SPEC, PLAN)
- **CONTEXT absorbed into SPEC:** All project context, decisions, and requirements now live in a single file
- **PROGRESS is now optional:** Optimized for one-shot tasks; recommended for long sessions or autonomous agent workflows
- **No separate DECISIONS.md:** Technical decisions live as rules within SPEC.md's `## Decisions` section
- Updated artifact chain: SPEC → PLAN → [optional: PROGRESS, VALIDATION, CHECKPOINT, REVIEW, TEST, SECURITY]
- Increased SPEC.md context budget from ~250 to ~300 lines to accommodate merged content

### v2.3.0
- **Decision Fidelity:** `CONTEXT.md` now requires a `## Decisions` section with `[LOCKED]`, `[DISCRETION]`, `[DEFERRED]` tags
- **EARS + REQ IDs:** Requirements in `SPEC.md` must have `REQ-N` identifiers. EARS sentence templates recommended
- **Parallelism Markers:** Tasks in `PLAN.md` with no blocking dependencies get `(P)` suffix
- **Clarify State:** New `clarify` state in Artifact State Machine (`draft → clarify → ready`). Agent performs adversarial review before `ready`
- **Goal-Backward Verification:** `sddkit-review` must verify every REQ has explicit PLAN coverage (backward check)
- **Context Budgets:** Recommended size limits per artifact to prevent LLM context degradation
- **Atomic Commits:** `sddkit-implement` creates granular commits per task using `feat(REQ-n/Tx.y):` format
- `sddkit-validate` now checks REQ-ID presence and Context Budget compliance

### v2.1.0
- Adds `sddkit-test` (automatic unit testing post-implementation)
- Adds `sddkit-security` (security audit with OWASP mapping)
- New artifacts: TEST.md, SECURITY.md
- Updated flow: IMPLEMENT → TEST → SECURITY → archive

### v2.0.0
- Adds `sddkit-checkpoint`, `sddkit-review`, `sddkit-repair`
- Automatic archiving
- Normalized fingerprints
- Capabilities handshake
- Task reservation for subagents
- Explicit state machine

### v1.1.0
- Adds lazy loading, conditional checksums, blocking_review

### v1.0.0
- Initial version with SPEC → PLAN → IMPLEMENT flow

### Migration Rules (v1.x → v2.0)
1. Run `sddkit-repair` to detect and fix artifacts missing new fields.
2. Fields `session_id`, `depends_on` are optional in v2.0 but recommended.
3. Artifacts with `validated` status and >7 days old will be moved to `.sdd/archive/` on first run.
4. Old fingerprints based on total bytes will be automatically recalculated with the new `chars_nnn` format.
