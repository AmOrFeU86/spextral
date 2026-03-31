Run sddkit-security: static security analysis of implemented code with OWASP mapping.

---

# sddkit-security — Security Audit

## Protocol

1. Read all source files referenced in `{slug}/PROGRESS.md`.
2. Perform static analysis (see scan categories below).
3. Generate `{slug}/SECURITY.md`.

## Scan Categories

- **Secrets & Credentials:** Hardcoded API keys, tokens, passwords, connection strings. High-entropy strings, common names (`secret`, `password`, `api_key`, `token`).
- **Injection Vulnerabilities:** SQL injection, command injection, XSS, path traversal. Unsanitized user inputs.
- **Authentication & Authorization:** Missing auth checks, weak sessions, insecure token storage.
- **Dependency Risks:** Known vulnerable packages, overly permissive dependencies.
- **Data Exposure:** Sensitive data in logs, verbose errors, debug mode in production.
- **Configuration:** Insecure defaults (DEBUG=true, CORS=*, permissive permissions).

## Severity Classification

| Severity | Criteria | Impact |
|----------|----------|--------|
| **Critical** | Exploitable (injection, hardcoded secrets, auth bypass) | Blocks deployment |
| **High** | Likely exploitable (weak crypto, missing rate limiting) | Fix before production |
| **Medium** | Best-practice violations (missing validation, verbose errors) | Fix when possible |
| **Low** | Informational (outdated patterns, missing headers) | Nice to have |

## SECURITY.md Content

- Summary table: severity -> count
- Detailed findings: file, line, description, remediation
- OWASP category mapping

```yaml
# SECURITY.md frontmatter (additional fields)
security_summary:
  critical: 0
  high: 1
  medium: 2
  low: 3
```

- Any **Critical** finding: status `blocking_review`.
- Otherwise: status `validated` with warnings.

> This is best-effort AI static analysis, not a replacement for SAST/DAST tools.

## Context Budget

SECURITY.md: ~100 lines max. Summary + critical/high findings.
