Analyze the current .sdd/ artifacts and their statuses to determine the next logical step in the SDD workflow. Report the current state, dependency order if applicable, and the recommended action.

## Protocol

1. Read `.sdd/config.json` for the artifact chain.
2. For each project slug, read frontmatters to find current status.
3. Determine the next artifact in the chain that needs work.
4. Report current state and recommended action.

## Routing Table

| Next Artifact | Skill to Run |
|---------------|-------------|
| SPEC.md needed | `sdd-spec` |
| PLAN.md needed | `sdd-plan` |
| Implementation needed | `sdd-implement` |
| Review needed | `sdd-review` |
| Tests needed | `sdd-test` |
| Security audit needed | `sdd-security` |
| Custom artifact | Read description from config.custom_artifacts |
| All complete | Suggest archiving |
