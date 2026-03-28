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
  "ready",
  "validated",
  "blocking_review",
  "fingerprint_mismatch",
  "checkpointed",
  "archived",
];

const IDE_TARGETS = {
  "claude-code": {
    name: "Claude Code",
    dest: "CLAUDE.md",
    isFile: true,
  },
  cursor: {
    name: "Cursor",
    dest: ".cursorrules",
    isFile: true,
  },
  copilot: {
    name: "GitHub Copilot",
    dest: path.join(".github", "copilot", SPEC_FILENAME),
  },
  "roo-code": {
    name: "Roo Code",
    dest: ".clinerules",
    isFile: true,
  },
  manual: {
    name: "Manual (copy to templates/ only)",
    dest: null,
  },
};

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

// ── init ──────────────────────────────────────────────

async function cmdInit() {
  console.log("\n  Spextral — Spec-Driven Development Protocol\n");

  const choices = Object.entries(IDE_TARGETS);
  console.log("  Which IDE/agent platform are you using?\n");
  choices.forEach(([key, val], i) => {
    console.log(`    ${i + 1}) ${val.name}`);
  });

  const answer = await ask("\n  Select (1-5): ");
  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= choices.length) {
    console.error("  Invalid selection. Aborting.");
    process.exit(1);
  }

  const [ideKey, ide] = choices[idx];
  const specContent = fs.readFileSync(SPEC_SOURCE, "utf-8");

  // Copy spec to IDE-specific location
  if (ide.dest) {
    const destPath = path.resolve(ide.dest);
    if (ide.isFile) {
      // For Cursor/Roo Code, the destination IS the file
      ensureDir(path.dirname(destPath));
      if (fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, "utf-8");
        if (!existing.includes("sdd_version")) {
          fs.writeFileSync(destPath, existing + "\n\n" + specContent);
          console.log(`  Appended to ${ide.dest}`);
        } else {
          fs.writeFileSync(destPath, specContent);
          console.log(`  Updated ${ide.dest}`);
        }
      } else {
        fs.writeFileSync(destPath, specContent);
        console.log(`  Created ${ide.dest}`);
      }
    } else {
      ensureDir(path.dirname(destPath));
      fs.writeFileSync(destPath, specContent);
      console.log(`  Created ${ide.dest}`);
    }
  } else {
    console.log("  Manual mode — spec available at templates/spextral.md in the package.");
  }

  // Create .sdd/ structure
  ensureDir(path.join(".sdd", "archive"));
  console.log("  Created .sdd/ and .sdd/archive/");

  // Create IDE exclusion files (only for relevant IDEs)
  const exclusions = [];
  if (ideKey === "cursor") {
    appendIfMissing(".cursorignore", ".sdd/archive/**");
    exclusions.push(".cursorignore");
  }
  if (ideKey === "copilot") {
    appendIfMissing(".copilotignore", ".sdd/archive/**");
    exclusions.push(".copilotignore");
  }
  if (exclusions.length > 0) {
    console.log(`  Updated ${exclusions.join(" and ")}`);
  }

  console.log(`\n  Done! Spextral initialized for ${ide.name}.`);
  console.log('  Type SDD_WAKE in your AI chat to get started.\n');
}

// ── doctor ────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: null, body: "" };

  const raw = match[1];
  const fm = {};
  for (const line of raw.split("\n")) {
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

  // Build set of all known artifact filenames for chain validation
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

    // Validate artifact chain
    if (frontmatter.previous_artifact && !allFiles.has(frontmatter.previous_artifact)) {
      console.log(`  FAIL  ${display} — previous_artifact "${frontmatter.previous_artifact}" not found`);
      issues++;
    }
    if (frontmatter.next_artifact && !allFiles.has(frontmatter.next_artifact)) {
      console.log(`  FAIL  ${display} — next_artifact "${frontmatter.next_artifact}" not found`);
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
  default:
    console.log(`
  Spextral — Spec-Driven Development Protocol for AI Agents

  Usage:
    spextral init      Set up Spextral for your IDE/agent
    spextral doctor    Validate .sdd/ structure and artifacts
    spextral update    Fetch the latest spec from GitHub
`);
    break;
}
