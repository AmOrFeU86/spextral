# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.9.3] - 2026-03-31

### Fixed
- **YAML single quotes**: Remove unnecessary escaping of single quotes in double-quoted YAML strings (single quotes are literal in YAML double-quoted strings)

## [2.9.2] - 2026-03-31

### Fixed
- **YAML escape sequence**: Properly escape single quotes in description field (fixes `\'` invalid escape error)

## [2.9.1] - 2026-03-31

### Fixed
- **YAML frontmatter escaping**: Properly quote description field in SKILL.md files to handle colons correctly (fixes pi skill loading errors)

## [2.9.0] - 2026-03-31

### Added
- **Pi Coding Agent support**: Added native support for pi coding agent with skills in `.pi/skills/` directory

## [2.8.0] - 2026-03-31

### Added
- **Modular Skills System**: Each SDD skill (`sdd-wake`, `sdd-spec`, `sdd-plan`, `sdd-implement`, `sdd-review`, `sdd-test`, `sdd-security`, `sdd-next`, `sdd-status`) now lives in its own template file (`templates/skills/`) instead of being embedded in `constants.js`
- **Enhanced bootstrap.md**: Added comprehensive documentation including:
  - Full artifact state machine diagram
  - Required frontmatter schema
  - Fingerprint calculation format
  - Directory structure reference
  - Human response commands table
  - Error codes reference
- **CHANGELOG.md**: This file to track notable changes

### Changed
- **Platform Focus**: Streamlined support to focus on Claude Code, GitHub Copilot, and Kiro (removed: Cursor, Windsurf, Roo Code, Gemini CLI, Cline, Codex CLI, Trae, Manual mode)
- **Skills Architecture**: Skills now load from template files for better maintainability and reduced bundle size
- **Protocol Loading**: Protocol is lazy-loaded per-skill instead of embedded in `sdd-wake`, reducing context overhead

### Removed
- Platform support for: Cursor, Windsurf, Roo Code, Gemini CLI, Cline, Codex CLI, Trae
- Manual mode from agent registry

### Fixed
- Refactored `init.js` to use template-based skill generation
- Updated E2E tests to create all skills dynamically from templates
