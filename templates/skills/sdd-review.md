Run sddkit-review: adversarial analysis of SPEC and PLAN to find contradictions, missing coverage, and dependency issues.

---

# sddkit-review — Devil-Advocate Analysis

## Protocol

1. Load `{slug}/SPEC.md` and `{slug}/PLAN.md`.
2. Run all checks below.
3. Generate `{slug}/REVIEW.md` with findings classified by severity: **blocking** / **warning** / **informational**.

## Checks

### 1. Contradiction Analysis
Identify discrepancies between specification and plan.

### 2. Task Coverage
Verify that each SPEC requirement has associated tasks.

### 3. Goal-Backward Verification (mandatory)

Iterate every `REQ-N` in the SPEC and confirm it has explicit coverage in at least one PLAN task's `covers` field. Any uncovered REQ is **blocking**.

Output format:
```
REQ-1 -> T1.1, T1.2 (covered)
REQ-2 -> T2.1 (covered)
REQ-5 -> NO COVERAGE (blocking)
```

### 4. Edge Cases
List unconsidered scenarios.

### 5. Dependency Graph Validation
Write the **Topological Sort** (linear ordering) of all tasks. If linear ordering is impossible, emit E603 with the tasks involved in the cycle.

## Context Budget

REVIEW.md: ~150 lines max recommended. Focus on blocking/warning findings only.
