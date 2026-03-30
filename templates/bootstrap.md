# Spextral — Spec-Driven Development Protocol (v2.5)

This project uses the **Spextral SDD** workflow. Artifacts live in `.sdd/`.

## Quick Reference

- **Activate:** Run the `sdd-wake` skill (or type `SDD_WAKE`) to load the full protocol, discover project state, and get a suggested next action.
- **Next step:** Run `sdd-next` to determine the next action in the workflow.
- **Status:** Run `sdd-status` to see current progress across all features.

## Rules (always active)

- Do NOT read `.sdd/archive/` unless the user explicitly asks for historical context.
- Artifacts are immutable once `validated` — never modify a validated SPEC or PLAN.
- All execution state updates go in `PROGRESS.md`, not in SPEC or PLAN.
- Follow the artifact chain defined in `.sdd/config.json`.
