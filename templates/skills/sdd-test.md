Run sddkit-test: generate and execute unit tests based on SPEC requirements and implemented code.

---

# sddkit-test — Unit Testing

## Protocol

1. Read `{slug}/SPEC.md` and `{slug}/PROGRESS.md`.
2. Detect project language and test framework:
   - Python: `pytest`
   - JavaScript/TypeScript: `vitest` or `jest` (prefer vitest)
   - Go: `go test`
   - Rust: `cargo test`
   - If unclear, ask the user.
3. Generate unit tests for each implemented task:
   - One test file per source module.
   - Cover: happy path, edge cases, error handling per requirement.
   - Minimum: one test per REQ in SPEC.
4. Execute tests and capture results.
5. Generate `{slug}/TEST.md`.

## TEST.md Content

- Test matrix: requirement -> test -> pass/fail
- Coverage summary (if tool available)
- Failed tests with error output

```yaml
# TEST.md frontmatter (additional fields)
test_summary:
  total: 5
  passed: 5
  failed: 0
  coverage: "87%"
```

- All pass: status `validated`.
- Any fail: status `blocking_review` with failure details.

> If `CommandExec` unavailable, generate test files but skip execution. Mark as `draft` with note to run manually.

## Context Budget

TEST.md: ~100 lines max. Summary + failures only; full logs stay external.
