Run SDD_STATUS. For each project slug in .sdd/, report: artifact states, progress percentage (completed/total tasks), any blocking issues, and current capabilities.

## Protocol

1. Read `.sdd/config.json` for the artifact chain.
2. For each slug directory in `.sdd/`, read all artifact frontmatters.
3. Calculate progress: (completed artifacts / total in chain) x 100.
4. If PROGRESS.md exists, report task-level progress: (done tasks / total tasks) x 100.
5. Flag any artifacts in `blocking_review` or `fingerprint_mismatch` status.
6. Report capabilities detected for the current platform.
