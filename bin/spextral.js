#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const https = require("https");

const SPEC_FILENAME = "spextral.md";
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const SPEC_SOURCE = path.join(TEMPLATES_DIR, SPEC_FILENAME);

const VALID_STATES = [
  "draft",
  "clarify",
  "ready",
  "validated",
  "blocking_review",
  "fingerprint_mismatch",
  "checkpointed",
  "archived",
];

const AGENT_REGISTRY = {
  "claude-code": {
    name: "Claude Code",
    dest: "CLAUDE.md",
    isFile: true,
    skills: { dir: path.join(".claude", "skills"), format: "skill" },
    exclusionFile: null,
  },
  cursor: {
    name: "Cursor",
    dest: path.join(".cursor", "rules", "spextral.mdc"),
    isFile: true,
    mdcFormat: true,
    skills: null,
    exclusionFile: ".cursorignore",
  },
  copilot: {
    name: "GitHub Copilot",
    dest: path.join(".github", "copilot-instructions.md"),
    isFile: false,
    skills: { dir: path.join(".github", "skills"), format: "copilot" },
    exclusionFile: ".copilotignore",
  },
  kiro: {
    name: "Kiro",
    dest: path.join(".kiro", "steering", "spextral.md"),
    isFile: false,
    kiroSteering: true,
    skills: { dir: path.join(".kiro", "skills"), format: "skill-dir" },
    exclusionFile: null,
  },
  "roo-code": {
    name: "Roo Code",
    dest: ".clinerules",
    isFile: true,
    skills: null,
    exclusionFile: null,
  },
  windsurf: {
    name: "Windsurf",
    dest: path.join(".windsurf", "rules", "spextral.md"),
    isFile: false,
    skills: null,
    exclusionFile: null,
  },
  "gemini-cli": {
    name: "Gemini CLI",
    dest: "GEMINI.md",
    isFile: true,
    skills: null,
    exclusionFile: null,
  },
  cline: {
    name: "Cline",
    dest: path.join(".cline", "rules", "spextral.md"),
    isFile: false,
    skills: null,
    exclusionFile: null,
  },
  codex: {
    name: "Codex CLI",
    dest: "AGENTS.md",
    isFile: true,
    skills: null,
    exclusionFile: null,
  },
  trae: {
    name: "Trae",
    dest: path.join(".trae", "rules", "spextral.md"),
    isFile: false,
    skills: null,
    exclusionFile: null,
  },
  manual: {
    name: "Manual (copy to templates/ only)",
    dest: null,
    skills: null,
    exclusionFile: null,
  },
};

const SDD_ARTIFACTS = [
  { name: "CONTEXT",    required: true,  description: "Project context and decisions" },
  { name: "SPEC",       required: true,  description: "Requirements (EARS format, REQ-N IDs)" },
  { name: "PLAN",       required: true,  description: "Tasks with dependency graph" },
  { name: "PROGRESS",   required: true,  description: "Execution status tracking" },
  { name: "VALIDATION", required: false, description: "Validation report" },
  { name: "CHECKPOINT", required: false, description: "Recovery points" },
  { name: "REVIEW",     required: false, description: "Review notes (Devil-Advocate)" },
  { name: "TEST",       required: false, description: "Test artifacts and results" },
  { name: "SECURITY",   required: false, description: "Security analysis" },
];

const SDD_SKILLS = {
  "sdd-wake": {
    description: "Activate the SDD protocol and discover current project state",
    prompt:
      "Run the SDD_WAKE protocol. Discover the .sdd/ directory, read artifact frontmatters, check chain integrity, perform capabilities handshake, and report status with a suggested next action.",
  },
  "sdd-next": {
    description: "Determine the next step in the SDD workflow",
    prompt:
      "Analyze the current .sdd/ artifacts and their statuses to determine the next logical step in the SDD workflow. Report the current state, dependency order if applicable, and the recommended action.",
  },
  "sdd-status": {
    description: "Show current SDD project status and progress",
    prompt:
      "Run SDD_STATUS. For each project slug in .sdd/, report: artifact states, progress percentage (completed/total tasks), any blocking issues, and current capabilities.",
  },
};

function wrapMdc(content) {
  return `---
description: Spextral SDD Protocol
globs:
alwaysApply: true
---

${content}`;
}

function wrapKiroSteering(content) {
  return `---
inclusion: always
---

${content}`;
}

function generateNativeSkills(agentKey, agent) {
  if (!agent.skills) return;

  for (const [name, skill] of Object.entries(SDD_SKILLS)) {
    if (agent.skills.format === "copilot" || agent.skills.format === "skill-dir") {
      // SKILL.md format (Copilot, Kiro): dir/X/SKILL.md
      const skillDir = path.join(agent.skills.dir, name);
      const skillPath = path.join(skillDir, "SKILL.md");
      ensureDir(skillDir);
      fs.writeFileSync(
        skillPath,
        `---\nname: ${name}\ndescription: ${skill.description}\n---\n\n${skill.prompt}\n`
      );
      console.log(`    Skill: ${skillPath}`);
    } else {
      // skill format (Claude Code): .claude/skills/X/SKILL.md
      const skillDir = path.join(agent.skills.dir, name);
      const skillPath = path.join(skillDir, "SKILL.md");
      ensureDir(skillDir);
      fs.writeFileSync(
        skillPath,
        `---\nname: ${name}\ndescription: ${skill.description}\n---\n\n${skill.prompt}\n`
      );
      console.log(`    Skill: ${skillPath}`);
    }
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function appendIfMissing(filePath, line) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  }
  if (!content.includes(line)) {
    fs.writeFileSync(filePath, content + (content && !content.endsWith("\n") ? "\n" : "") + line + "\n");
  }
}

/**
 * Generic interactive checkbox UI.
 * @param {object} opts
 * @param {string} opts.title - Header text
 * @param {Array<{key: string, label: string, locked?: boolean}>} opts.items - Selectable items
 * @param {Set<string>} opts.preselected - Keys selected by default
 * @param {string} [opts.footer] - Extra info line (e.g. chain preview). Receives selected Set, returns string.
 * @param {string} [opts.hint] - Controls hint line
 * @returns {Promise<string[]>} Selected keys in display order
 */
function interactiveCheckbox({ title, items, preselected, footerFn, hint }) {
  const selected = new Set(preselected);
  let cursor = 0;
  let lastLineCount = 0;

  function render() {
    const lines = [];
    lines.push("");
    lines.push(`  ${title}`);
    lines.push("");
    items.forEach((item, i) => {
      const checked = selected.has(item.key) ? "x" : " ";
      const tag = item.locked ? " (required)" : "";
      const pointer = i === cursor ? ">" : " ";
      lines.push(`  ${pointer} ${i + 1}. [${checked}] ${item.label}${tag}`);
    });
    if (footerFn) {
      lines.push("");
      lines.push(`  ${footerFn(selected)}`);
    }
    lines.push("");
    lines.push(`  ${hint || "\u2191/\u2193: navigate | Space: toggle | Enter: confirm"}`);
    return lines.join("\n");
  }

  const output = render();
  lastLineCount = output.split("\n").length;
  process.stdout.write(output);

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    function repaint() {
      process.stdout.write(`\x1b[${lastLineCount - 1}A\x1b[J`);
      const text = render();
      lastLineCount = text.split("\n").length;
      process.stdout.write(text);
    }

    function cleanup() {
      stdin.setRawMode(wasRaw || false);
      stdin.pause();
      stdin.removeListener("data", onKey);
    }

    function onKey(key) {
      if (key === "\x03") { cleanup(); process.exit(0); }
      if (key === "\x1b[A") { if (cursor > 0) cursor--; repaint(); return; }
      if (key === "\x1b[B") { if (cursor < items.length - 1) cursor++; repaint(); return; }
      if (key === " ") {
        const item = items[cursor];
        if (item.locked) return;
        if (selected.has(item.key)) selected.delete(item.key);
        else selected.add(item.key);
        repaint();
        return;
      }
      if (key === "\r") {
        cleanup();
        process.stdout.write("\n");
        resolve(items.filter((item) => selected.has(item.key)).map((item) => item.key));
        return;
      }
    }

    stdin.on("data", onKey);
  });
}

async function askArtifacts() {
  const items = SDD_ARTIFACTS.map((a) => ({
    key: a.name,
    label: `${a.name}.md  \u2014 ${a.description}`,
    locked: a.required,
  }));
  const preselected = new Set(SDD_ARTIFACTS.filter((a) => a.required).map((a) => a.name));
  const customArtifacts = {};
  let lastLineCount = 0;

  // Use custom rendering for artifact-specific features (add custom, move, chain preview)
  const selected = new Set(preselected);
  let cursor = 0;

  function render(mode) {
    const lines = [];
    lines.push("");
    lines.push("  Select SDD artifacts:");
    lines.push("");
    SDD_ARTIFACTS.forEach((a, i) => {
      const checked = selected.has(a.name) ? "x" : " ";
      const tag = a.required ? " (required)" : a.custom ? " (custom)" : "";
      const pointer = i === cursor ? ">" : " ";
      lines.push(
        `  ${pointer} ${i + 1}. [${checked}] ${a.name}.md${tag}  \u2014 ${a.description}`
      );
    });
    const chain = SDD_ARTIFACTS.filter((a) => selected.has(a.name))
      .map((a) => a.name)
      .join(" \u2192 ");
    lines.push("");
    lines.push(`  Chain: ${chain}`);
    lines.push("");
    if (mode === "reorder") {
      lines.push("  \u2191/\u2193: move item | Enter: confirm position | Esc: cancel");
    } else {
      lines.push("  \u2191/\u2193: navigate | Space: toggle | A: add custom | M: move | Enter: confirm");
    }
    return lines.join("\n");
  }

  const output = render("select");
  lastLineCount = output.split("\n").length;
  process.stdout.write(output);

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    let mode = "select";
    let addBuffer = "";
    let addName = "";

    function repaint() {
      process.stdout.write(`\x1b[${lastLineCount - 1}A\x1b[J`);
      const text = render(mode);
      lastLineCount = text.split("\n").length;
      process.stdout.write(text);
    }

    function cleanup() {
      stdin.setRawMode(wasRaw || false);
      stdin.pause();
      stdin.removeListener("data", onKey);
    }

    function finish() {
      cleanup();
      process.stdout.write("\n");
      const chain = SDD_ARTIFACTS.filter((a) => selected.has(a.name)).map((a) => a.name);
      resolve({ chain, customArtifacts });
    }

    function onKey(key) {
      if (key === "\x03") { cleanup(); process.exit(0); }

      // ── Add custom artifact: name input ──
      if (mode === "add-name") {
        if (key === "\x1b") { mode = "select"; repaint(); return; }
        if (key === "\r") {
          const upper = addBuffer.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
          if (!upper || SDD_ARTIFACTS.some((a) => a.name === upper)) {
            addBuffer = ""; mode = "select"; repaint(); return;
          }
          addName = upper; addBuffer = ""; mode = "add-desc";
          process.stdout.write(`\x1b[2K\r  Description: `);
          return;
        }
        if (key === "\x7f" || key === "\b") {
          addBuffer = addBuffer.slice(0, -1);
          process.stdout.write(`\x1b[2K\r  Artifact name: ${addBuffer}`);
          return;
        }
        if (key.length === 1 && key >= " ") { addBuffer += key; process.stdout.write(key); }
        return;
      }

      // ── Add custom artifact: description input ──
      if (mode === "add-desc") {
        if (key === "\x1b") { mode = "select"; repaint(); return; }
        if (key === "\r") {
          const desc = addBuffer || "Custom artifact";
          const artifact = { name: addName, required: false, description: desc, custom: true };
          SDD_ARTIFACTS.push(artifact);
          selected.add(addName);
          customArtifacts[addName] = { description: desc };
          cursor = SDD_ARTIFACTS.length - 1;
          addBuffer = ""; mode = "select";
          process.stdout.write(`\x1b[2A\x1b[J`);
          const text = render(mode);
          lastLineCount = text.split("\n").length;
          process.stdout.write(text);
          return;
        }
        if (key === "\x7f" || key === "\b") {
          addBuffer = addBuffer.slice(0, -1);
          process.stdout.write(`\x1b[2K\r  Description: ${addBuffer}`);
          return;
        }
        if (key.length === 1 && key >= " ") { addBuffer += key; process.stdout.write(key); }
        return;
      }

      // ── Reorder mode ──
      if (mode === "reorder") {
        if (key === "\x1b[A" && cursor > 0) {
          const target = cursor - 1;
          if (SDD_ARTIFACTS[target].required) return;
          [SDD_ARTIFACTS[cursor], SDD_ARTIFACTS[target]] = [SDD_ARTIFACTS[target], SDD_ARTIFACTS[cursor]];
          cursor = target; repaint(); return;
        }
        if (key === "\x1b[B" && cursor < SDD_ARTIFACTS.length - 1) {
          const target = cursor + 1;
          [SDD_ARTIFACTS[cursor], SDD_ARTIFACTS[target]] = [SDD_ARTIFACTS[target], SDD_ARTIFACTS[cursor]];
          cursor = target; repaint(); return;
        }
        if (key === "\r" || key === "\x1b") { mode = "select"; repaint(); return; }
        return;
      }

      // ── Select mode ──
      if (key === "\x1b[A") { if (cursor > 0) cursor--; repaint(); return; }
      if (key === "\x1b[B") { if (cursor < SDD_ARTIFACTS.length - 1) cursor++; repaint(); return; }
      if (key === " ") {
        const artifact = SDD_ARTIFACTS[cursor];
        if (artifact.required) return;
        if (selected.has(artifact.name)) selected.delete(artifact.name);
        else selected.add(artifact.name);
        repaint(); return;
      }
      if (key === "\r") { finish(); return; }
      if (key === "a" || key === "A") {
        process.stdout.write(`\n  Artifact name: `);
        addBuffer = ""; mode = "add-name"; return;
      }
      if (key === "m" || key === "M") {
        if (SDD_ARTIFACTS[cursor].required) return;
        mode = "reorder"; repaint(); return;
      }
    }

    stdin.on("data", onKey);
  });
}

// ── init ──────────────────────────────────────────────

async function cmdInit() {
  console.log("\n  Spextral — Spec-Driven Development Protocol");

  const choices = Object.entries(AGENT_REGISTRY).filter(([k]) => k !== "manual");
  const platformItems = choices.map(([key, val]) => ({
    key,
    label: val.name,
  }));

  const selectedKeys = await interactiveCheckbox({
    title: "Select agent platform(s):",
    items: platformItems,
    preselected: new Set(),
    hint: "\u2191/\u2193: navigate | Space: toggle | Enter: confirm",
  });

  if (selectedKeys.length === 0) {
    console.error("  No agents selected. Aborting.");
    process.exit(1);
  }

  const selected = selectedKeys.map((key) => [key, AGENT_REGISTRY[key]]);

  const specContent = fs.readFileSync(SPEC_SOURCE, "utf-8");
  const writtenDests = new Set();
  const exclusions = [];

  for (const [agentKey, agent] of selected) {
    console.log(`\n  [${agent.name}]`);

    // Deploy spec to agent destination
    if (agent.dest && !writtenDests.has(agent.dest)) {
      writtenDests.add(agent.dest);
      const destPath = path.resolve(agent.dest);
      let content = specContent;
      if (agent.mdcFormat) content = wrapMdc(specContent);
      else if (agent.kiroSteering) content = wrapKiroSteering(specContent);

      ensureDir(path.dirname(destPath));
      if (agent.isFile && fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, "utf-8");
        if (!existing.includes("sdd_version")) {
          fs.writeFileSync(destPath, existing + "\n\n" + content);
          console.log(`    Appended to ${agent.dest}`);
        } else {
          fs.writeFileSync(destPath, content);
          console.log(`    Updated ${agent.dest}`);
        }
      } else {
        fs.writeFileSync(destPath, content);
        console.log(`    Created ${agent.dest}`);
      }
    } else if (!agent.dest) {
      console.log("    Manual mode — spec available at templates/spextral.md in the package.");
    }

    // Exclusion files
    if (agent.exclusionFile) {
      appendIfMissing(agent.exclusionFile, ".sdd/archive/**");
      exclusions.push(agent.exclusionFile);
      console.log(`    Updated ${agent.exclusionFile}`);
    }

    // Native skills
    generateNativeSkills(agentKey, agent);
  }

  // Artifact selection
  const { chain, customArtifacts } = await askArtifacts();

  // Create .sdd/ structure and config.json
  ensureDir(path.join(".sdd", "archive"));
  const configPath = path.join(".sdd", "config.json");
  const config = { chain };
  if (Object.keys(customArtifacts).length > 0) {
    config.custom_artifacts = customArtifacts;
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("  Created .sdd/ and .sdd/archive/");
  console.log(`  Created .sdd/config.json (chain: ${chain.join(" → ")})`);

  // GitHub Action prompt
  const workflowPath = path.join(".github", "workflows", "sdd-validate.yml");
  if (!fs.existsSync(workflowPath)) {
    const addAction = await ask("  Add GitHub Action to auto-validate SDD artifacts on every PR? (y/N): ");
    if (addAction.toLowerCase() === "y") {
      const workflowSrc = path.join(TEMPLATES_DIR, "sdd-validate.yml");
      if (fs.existsSync(workflowSrc)) {
        ensureDir(path.dirname(workflowPath));
        fs.copyFileSync(workflowSrc, workflowPath);
        console.log("  Created .github/workflows/sdd-validate.yml");
      }
    }
  }

  const names = selected.map(([, a]) => a.name).join(", ");
  console.log(`\n  Done! Spextral initialized for ${names}.`);
  console.log('  Type SDD_WAKE in your AI chat to get started.\n');
}

// ── doctor ────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: null, body: "" };

  const raw = match[1];
  const fm = {};
  for (const line of raw.split("\n")) {
    // Inline YAML arrays: depends_on: [T1, T2.1, T3]
    const arrMatch = line.match(/^(\w[\w_]*):\s*\[([^\]]*)\]\s*$/);
    if (arrMatch) {
      const items = arrMatch[2]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      fm[arrMatch[1]] = items;
      continue;
    }
    // Scalar values (existing behavior)
    const m = line.match(/^(\w[\w_]*):\s*"?([^"]*)"?\s*$/);
    if (m) fm[m[1]] = m[2];
  }

  const body = content.slice(match[0].length);
  return { frontmatter: fm, body };
}

function computeFingerprint(body) {
  const normalized = body.replace(/\r\n/g, "\n");
  const nonBlank = normalized.replace(/\s/g, "").length;
  return nonBlank;
}

function cmdDoctor() {
  console.log("\n  Spextral Doctor\n");

  const sddDir = path.resolve(".sdd");
  if (!fs.existsSync(sddDir)) {
    console.error("  No .sdd/ directory found. Run `spextral init` first.");
    process.exit(1);
  }

  // Discover slug folders (directories inside .sdd/ that aren't "archive")
  const slugDirs = fs.readdirSync(sddDir).filter((f) => {
    const full = path.join(sddDir, f);
    return fs.statSync(full).isDirectory() && f !== "archive";
  });

  // Also support legacy flat files (sdd-*.md)
  const legacyFiles = fs.readdirSync(sddDir).filter((f) => f.endsWith(".md") && f.startsWith("sdd-"));

  // Collect all artifacts: { displayName, filePath }
  const artifacts = [];
  for (const slug of slugDirs) {
    const slugPath = path.join(sddDir, slug);
    const mdFiles = fs.readdirSync(slugPath).filter((f) => f.endsWith(".md"));
    for (const f of mdFiles) {
      artifacts.push({ display: `${slug}/${f}`, filePath: path.join(slugPath, f), slug, file: f });
    }
  }
  for (const f of legacyFiles) {
    artifacts.push({ display: f, filePath: path.join(sddDir, f), slug: null, file: f });
  }

  // Load config for chain validation
  const config = loadSddConfig(sddDir);
  const archiveDir = path.join(sddDir, "archive");
  const archiveFiles = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir).filter((f) => f.endsWith(".md"))
    : [];
  const allFiles = new Set([
    ...artifacts.map((a) => a.file),
    ...archiveFiles,
  ]);

  if (artifacts.length === 0) {
    console.log("  No artifacts found in .sdd/. Nothing to check.\n");
    return;
  }

  let issues = 0;
  let checked = 0;

  for (const artifact of artifacts) {
    const { display, filePath: artifactPath, file } = artifact;
    const content = fs.readFileSync(artifactPath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);

    if (!frontmatter) {
      console.log(`  WARN  ${display} — no valid frontmatter found`);
      issues++;
      continue;
    }

    checked++;

    // Validate status
    if (frontmatter.status && !VALID_STATES.includes(frontmatter.status)) {
      console.log(`  FAIL  ${display} — invalid status "${frontmatter.status}"`);
      issues++;
    }

    // Validate fingerprint
    if (frontmatter.fingerprint) {
      const match = frontmatter.fingerprint.match(/chars_(\d+)/);
      if (match) {
        const expected = parseInt(match[1], 10);
        const actual = computeFingerprint(body);
        if (expected !== actual) {
          console.log(`  FAIL  ${display} — fingerprint mismatch (expected ${expected}, got ${actual})`);
          issues++;
        } else {
          console.log(`  OK    ${display} — fingerprint valid (chars_${actual})`);
        }
      }
    } else {
      console.log(`  OK    ${display} — no fingerprint (skipped)`);
    }
  }

  // Validate chain integrity per slug (only for active slugs with artifacts)
  if (config.chain && slugDirs.length > 0) {
    console.log(`\n  Chain: ${config.chain.join(" → ")}`);
    for (const slug of slugDirs) {
      const slugPath = path.join(sddDir, slug);
      const slugFiles = fs.readdirSync(slugPath).filter((f) => f.endsWith(".md"));
      const slugArtifacts = new Set(slugFiles.map((f) => f.replace(".md", "").replace(/^CHECKPOINT-.*/, "CHECKPOINT")));

      // Only warn about missing artifacts if the slug has progressed past them in the chain
      const presentInChain = config.chain.filter((name) => slugArtifacts.has(name));
      if (presentInChain.length > 0) {
        const lastPresent = Math.max(...presentInChain.map((name) => config.chain.indexOf(name)));
        for (let i = 0; i < lastPresent; i++) {
          const expected = config.chain[i];
          if (!slugArtifacts.has(expected) && !archiveFiles.includes(`${expected}.md`)) {
            console.log(`  WARN  ${slug}/ — missing ${expected}.md (expected in chain before ${config.chain[lastPresent]}.md)`);
            issues++;
          }
        }
      }
    }
  }

  console.log(`\n  Checked ${checked} artifact(s), ${issues} issue(s) found.\n`);
  process.exit(issues > 0 ? 1 : 0);
}

// ── update ────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const request = (u) => {
      https.get(u, { headers: { "User-Agent": "spextral-cli" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location);
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, data }));
        res.on("error", reject);
      }).on("error", reject);
    };
    request(url);
  });
}

async function cmdUpdate() {
  console.log("\n  Spextral Update\n");

  const rawUrl =
    "https://raw.githubusercontent.com/AmOrFeU86/spextral/main/templates/spextral.md";

  console.log("  Fetching latest spec from GitHub...");

  try {
    const { status, data } = await httpsGet(rawUrl);

    if (status !== 200) {
      console.error(`  Failed to fetch (HTTP ${status}). Check your connection or the repo URL.`);
      process.exit(1);
    }

    const localPath = SPEC_SOURCE;
    const localContent = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf-8") : "";

    if (localContent === data) {
      console.log("  Already up to date.\n");
      return;
    }

    // Show version diff
    const localVersion = localContent.match(/sdd_version:\s*"?([^"\n]+)/);
    const remoteVersion = data.match(/sdd_version:\s*"?([^"\n]+)/);
    if (localVersion && remoteVersion) {
      console.log(`  Local version:  ${localVersion[1]}`);
      console.log(`  Remote version: ${remoteVersion[1]}`);
    }

    const localLines = localContent.split("\n").length;
    const remoteLines = data.split("\n").length;
    console.log(`  Lines: ${localLines} → ${remoteLines} (${remoteLines - localLines >= 0 ? "+" : ""}${remoteLines - localLines})`);

    fs.writeFileSync(localPath, data);
    console.log(`\n  Updated ${path.relative(process.cwd(), localPath)}`);
    console.log("  Run `spextral init` again to propagate to your IDE config.\n");
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
}

// ── topological sort ─────────────────────────────────

/**
 * Kahn's algorithm — O(V+E) topological sort.
 * @param {Map<string, string[]>} graph  adjacency list (task → depends_on[])
 * @returns {{ order: string[], cycle: string[] | null }}
 *   order: linear execution order (empty if cycle detected)
 *   cycle: list of tasks involved in cycle, or null
 */
function topologicalSort(graph) {
  const inDegree = new Map();
  const adj = new Map(); // reverse: dependency → dependents

  for (const [node, deps] of graph) {
    if (!inDegree.has(node)) inDegree.set(node, 0);
    if (!adj.has(node)) adj.set(node, []);
    for (const dep of deps) {
      if (!inDegree.has(dep)) inDegree.set(dep, 0);
      if (!adj.has(dep)) adj.set(dep, []);
      adj.get(dep).push(node);
      inDegree.set(node, inDegree.get(node) + 1);
    }
  }

  const queue = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const neighbor of adj.get(node)) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (order.length !== inDegree.size) {
    const cycle = [];
    for (const [node, deg] of inDegree) {
      if (deg > 0) cycle.push(node);
    }
    return { order: [], cycle };
  }

  return { order, cycle: null };
}

function loadSddConfig(sddDir) {
  const configPath = path.join(sddDir, "config.json");
  if (!fs.existsSync(configPath)) {
    // Fallback: default full chain for projects initialized before config.json
    return { chain: ["CONTEXT", "SPEC", "PLAN", "PROGRESS", "VALIDATION", "CHECKPOINT", "REVIEW", "TEST", "SECURITY"] };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// ── next ─────────────────────────────────────────────

/**
 * Discovers .sdd/ state: slugs, their artifacts, frontmatters, and tasks.
 * Returns everything needed for routing decisions.
 */
function discoverSddState(sddDir) {
  const slugDirs = fs.readdirSync(sddDir).filter((f) => {
    const full = path.join(sddDir, f);
    return fs.statSync(full).isDirectory() && f !== "archive";
  });

  const slugs = [];

  for (const slug of slugDirs) {
    const slugPath = path.join(sddDir, slug);
    const mdFiles = fs.readdirSync(slugPath).filter((f) => f.endsWith(".md"));

    const artifacts = {};
    for (const file of mdFiles) {
      const content = fs.readFileSync(path.join(slugPath, file), "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);
      const type = file.replace(".md", "").replace(/^CHECKPOINT-.*/, "CHECKPOINT");
      artifacts[type] = { file, frontmatter, body, status: frontmatter ? frontmatter.status : null };
    }

    slugs.push({ slug, artifacts, path: slugPath });
  }

  return slugs;
}

/**
 * Extracts task dependency graph from PLAN.md body.
 * Parses markdown headers like ### T1.1 (P) — description
 * and depends_on lines like - depends_on: [T1.1, T1.2]
 */
function extractTaskGraph(planBody) {
  const graph = new Map();
  const lines = planBody.split("\n");
  let currentTask = null;

  for (const line of lines) {
    // Match task headers: ### T1.1 or ### T1.1 (P) — description
    const taskMatch = line.match(/^###\s+(T[\d.]+)/);
    if (taskMatch) {
      currentTask = taskMatch[1];
      if (!graph.has(currentTask)) graph.set(currentTask, []);
      continue;
    }

    // Match depends_on inside task block
    if (currentTask) {
      const depMatch = line.match(/depends_on:\s*\[([^\]]*)\]/);
      if (depMatch) {
        const deps = depMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        graph.set(currentTask, deps);
      }
    }
  }

  return graph;
}

function cmdNext() {
  const flags = process.argv.slice(3);
  const quick = flags.includes("--quick");

  const sddDir = path.resolve(".sdd");
  if (!fs.existsSync(sddDir)) {
    console.log("E-000: No .sdd/ directory found. Run `spextral init` first.");
    process.exit(1);
  }

  const config = loadSddConfig(sddDir);
  const chain = config.chain;
  const slugs = discoverSddState(sddDir);

  if (slugs.length === 0) {
    console.log("STATUS: empty");
    console.log("NEXT: Run SDD_WAKE to start a new feature.");
    return;
  }

  // Find the most active slug (most recent timestamp, or first non-archived)
  let active = null;
  for (const s of slugs) {
    const statuses = Object.values(s.artifacts).map((a) => a.status).filter(Boolean);
    if (statuses.some((st) => st !== "archived")) {
      active = s;
      break;
    }
  }

  if (!active) {
    console.log("STATUS: all_archived");
    console.log("NEXT: All features archived. Run SDD_WAKE to start a new feature.");
    return;
  }

  const a = active.artifacts;
  const slug = active.slug;

  // ── Quick mode: condensed fast-path ──
  if (quick) {
    console.log(`MODE: quick (autonomy_level: full — clarify and blocking_review auto-approved)`);
    console.log(`SLUG: ${slug}`);

    if (!a.CONTEXT) {
      console.log("NEXT: Generate CONTEXT.md, SPEC.md (with REQ-N IDs), and PLAN.md (with depends_on + (P) markers) in a single pass.");
      console.log("CONSTRAINTS: Preserve physical artifact files for fingerprint chain. Auto-approve clarify state.");
      return;
    }
    if (!a.SPEC) {
      console.log("NEXT: Generate SPEC.md (EARS format, REQ-N IDs) and PLAN.md in a single pass.");
      console.log("CONSTRAINTS: Preserve physical files. Auto-approve clarify.");
      return;
    }
    if (!a.PLAN) {
      console.log("NEXT: Generate PLAN.md with task-to-REQ mapping and (P) markers.");
      console.log("CONSTRAINTS: Run Goal-Backward Verification inline. Auto-approve.");
      return;
    }

    // PLAN exists — validate and proceed to implement
    const graph = extractTaskGraph(a.PLAN.body);
    if (graph.size > 0) {
      const { order, cycle } = topologicalSort(graph);
      if (cycle) {
        console.log(`E-603: Circular dependency detected in tasks: ${cycle.join(", ")}`);
        process.exit(1);
      }
      console.log(`TASK_ORDER: ${order.join(" → ")}`);
    }

    console.log("NEXT: Execute sddkit-implement with autonomy_level: full, review_frequency: end_only. Atomic commits per task.");
    return;
  }

  // ── Normal mode: step-by-step routing ──
  console.log(`SLUG: ${slug}`);

  // Route based on artifact state progression
  if (!a.CONTEXT) {
    console.log("STATUS: no_context");
    console.log("NEXT: Generate CONTEXT.md with ## Decisions section ([LOCKED], [DISCRETION], [DEFERRED]).");
    return;
  }

  if (!a.SPEC) {
    console.log(`STATUS: context_${a.CONTEXT.status || "unknown"}`);
    console.log("NEXT: Generate SPEC.md with EARS-format requirements and mandatory REQ-N identifiers.");
    return;
  }

  if (a.SPEC.status === "draft") {
    console.log("STATUS: spec_draft");
    console.log("NEXT: Transition SPEC.md to clarify — run Adversarial Review for ambiguities, then await SDD_APPROVE.");
    return;
  }

  if (a.SPEC.status === "clarify") {
    console.log("STATUS: spec_clarify");
    console.log("NEXT: Awaiting human response (SDD_APPROVE / SDD_MODIFY) to resolve clarification questions.");
    return;
  }

  if (a.SPEC.status === "ready") {
    console.log("STATUS: spec_ready");
    console.log("NEXT: Run sddkit-validate on SPEC.md (structural + REQ-ID + context budget checks).");
    return;
  }

  if (!a.PLAN) {
    console.log("STATUS: spec_validated");
    console.log("NEXT: Generate PLAN.md with task-to-REQ mapping, depends_on, and (P) parallelism markers.");
    return;
  }

  if (a.PLAN.status === "draft") {
    console.log("STATUS: plan_draft");
    console.log("NEXT: Transition PLAN.md to clarify — run Goal-Backward Verification (every REQ covered?).");
    return;
  }

  if (a.PLAN.status === "clarify") {
    console.log("STATUS: plan_clarify");
    console.log("NEXT: Awaiting human response (SDD_APPROVE / SDD_MODIFY) to confirm plan coverage.");
    return;
  }

  if (a.PLAN.status === "ready") {
    console.log("STATUS: plan_ready");
    // Validate dependency graph before proceeding
    const graph = extractTaskGraph(a.PLAN.body);
    if (graph.size > 0) {
      const { order, cycle } = topologicalSort(graph);
      if (cycle) {
        console.log(`E-603: Circular dependency detected in tasks: ${cycle.join(", ")}`);
        process.exit(1);
      }
      console.log(`DEPENDENCY_ORDER: ${order.join(" → ")}`);
    }
    console.log("NEXT: Run sddkit-validate on PLAN.md, then sddkit-review (Devil-Advocate).");
    return;
  }

  if (a.PLAN.status === "validated" || a.PLAN.status === "blocking_review") {
    // Check progress
    if (a.PROGRESS) {
      const progressBody = a.PROGRESS.body || "";
      const pending = (progressBody.match(/status:\s*pending/g) || []).length;
      const inProgress = (progressBody.match(/status:\s*in_progress/g) || []).length;

      if (pending === 0 && inProgress === 0) {
        // All tasks done — route to next artifact in chain after PROGRESS
        const progressIdx = chain.indexOf("PROGRESS");
        const postProgress = chain.slice(progressIdx + 1);
        for (const artName of postProgress) {
          if (!a[artName]) {
            const customDesc = config.custom_artifacts && config.custom_artifacts[artName];
            const hint = customDesc ? ` — ${customDesc.description}` : "";
            console.log(`STATUS: awaiting_${artName.toLowerCase()}`);
            console.log(`NEXT: Generate ${artName}.md${hint}.`);
            return;
          }
        }
        console.log("STATUS: all_complete");
        console.log("NEXT: Run sddkit-archive to move validated artifacts to .sdd/archive/.");
        return;
      }

      console.log(`STATUS: implementing (${pending} pending, ${inProgress} in_progress)`);
      console.log("NEXT: Continue sddkit-implement — execute next pending task with atomic commit.");
      return;
    }

    console.log("STATUS: plan_validated");
    console.log("NEXT: Begin sddkit-implement — create PROGRESS.md and start first task batch.");
    return;
  }

  // Fallback
  console.log(`STATUS: ${slug}_unknown`);
  console.log("NEXT: Run sddkit-doctor to diagnose artifact state, then resume.");
}

// ── main ──────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
  case "init":
    cmdInit();
    break;
  case "doctor":
    cmdDoctor();
    break;
  case "update":
    cmdUpdate();
    break;
  case "next":
    cmdNext();
    break;
  default:
    console.log(`
  Spextral — Spec-Driven Development Protocol for AI Agents

  Usage:
    spextral init            Set up Spextral for one or more AI agents
    spextral doctor          Validate .sdd/ structure and artifacts
    spextral update          Fetch the latest spec from GitHub
    spextral next            Determine next logical step in the SDD workflow
    spextral next --quick    Fast-path: condensed flow with full autonomy
`);
    break;
}
