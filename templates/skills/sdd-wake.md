Run the SDD_WAKE protocol. Discover the .sdd/ directory, read artifact frontmatters, check chain integrity using .sdd/config.json, perform capabilities handshake, and report status with a suggested next action.

IMPORTANT — Auto-Continuation Rule: After completing implementation, you MUST continue through the ENTIRE artifact chain without stopping. Run `spextral next` after each artifact and execute the suggested action until STATUS is `all_complete`. This includes custom artifacts — read their description from config.custom_artifacts and execute them (applying code changes if needed, then generating the artifact .md file). Do NOT consider a feature done until every artifact in the chain is generated and validated.

---

# SDD_WAKE — Discovery and Activation

## Trigger Recognition

The agent must recognize natural-language equivalents as implicit SDD_WAKE triggers:
- "nueva feature", "new feature", "empiezo feature nueva"
- "quiero añadir...", "I want to add..."
- "nuevo desarrollo", "let's build..."
- "siguiente tarea", "next task"

When detected and a `.sdd/` folder exists, execute the full discovery protocol.

## Discovery Algorithm

1. Find `.sdd/` folder (or path in `SDD_ROOT` env var).
2. If it doesn't exist, suggest running `spextral init`.
3. If it exists:
   a. Read `.sdd/config.json` for chain definition.
   b. Group artifacts by `project_slug`.
   c. Find the most recent by timestamp per group.
   d. **Lazy Loading:** Read ONLY the frontmatter of the most recent file, not the body.
   e. Verify chain integrity: check all artifacts in config.json chain exist on disk (in `.sdd/{slug}/` or `.sdd/archive/`).

## Capabilities Handshake

Declare active capabilities to adapt the flow:

```yaml
capabilities_detected:
  FileWrite: true
  FileRead: true
  CommandExec: true/false
  SubagentSpawn: true/false
  YAMLParse: true
```

If a feature requires an unavailable capability, skip or adapt automatically.

| Platform | FileWrite | SubagentSpawn | CommandExec | ContextMemory | Native Skills |
|----------|-----------|---------------|-------------|---------------|---------------|
| Claude Code | Yes | Yes | Yes | Yes | Yes |
| GitHub Copilot | Yes | No | No | Partial | Yes |
| Kiro | Yes | No | No | Partial | Yes |

## Welcome Response (Standardized)

```yaml
---
sdd_response_type: "wake_confirmation"
project_slug: "{slug}"
last_artifact: "{file}"
progress: "{Completed}/{Total}"
status: "{status}"
suggested_next: "{next action}"
capabilities: { FileWrite: true, CommandExec: true/false, SubagentSpawn: true/false }
---
```

```markdown
## Spextral Activated

**Project:** {slug}
**Status:** {status}
**Progress:** {Percentage}% ({Completed}/{Total})
**Last artifact:** {file}
**Capabilities:** FileWrite | CommandExec | SubagentSpawn

Do you want me to run {next action}?
```

Percentage = (Completed / Total) x 100, rounded.

## Chain Repair (sddkit-repair)

If chain integrity check fails during discovery:
1. Scan all artifacts in `.sdd/` and `.sdd/archive/`.
2. Detect artifacts missing from chain in config.json.
3. Reconstruct chain based on timestamps and `artifact_type`.
4. Recalculate fingerprints if legacy format detected.
5. Release tasks with `claimed_by` from inactive sessions (>1 hour).
6. Generate repair report. If ambiguous, ask the human.
