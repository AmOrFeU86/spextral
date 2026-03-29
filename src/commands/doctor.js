const fs = require("fs");
const path = require("path");
const { VALID_STATES } = require("../constants");
const { parseFrontmatter, computeFingerprint } = require("../utils");
const { loadSddConfig } = require("../sdd/config");

function cmdDoctor() {
  console.log("\n  Spextral Doctor\n");

  const sddDir = path.resolve(".sdd");
  if (!fs.existsSync(sddDir)) {
    console.error("  No .sdd/ directory found. Run `spextral init` first.");
    process.exit(1);
  }

  const slugDirs = fs.readdirSync(sddDir).filter((f) => {
    const full = path.join(sddDir, f);
    return fs.statSync(full).isDirectory() && f !== "archive";
  });

  const legacyFiles = fs.readdirSync(sddDir).filter((f) => f.endsWith(".md") && f.startsWith("sdd-"));

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

  const config = loadSddConfig(sddDir);
  const archiveDir = path.join(sddDir, "archive");
  const archiveFiles = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir).filter((f) => f.endsWith(".md"))
    : [];

  if (artifacts.length === 0) {
    console.log("  No artifacts found in .sdd/. Nothing to check.\n");
    return;
  }

  let issues = 0;
  let checked = 0;

  for (const artifact of artifacts) {
    const { display, filePath: artifactPath } = artifact;
    const content = fs.readFileSync(artifactPath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);

    if (!frontmatter) {
      console.log(`  WARN  ${display} — no valid frontmatter found`);
      issues++;
      continue;
    }

    checked++;

    if (frontmatter.status && !VALID_STATES.includes(frontmatter.status)) {
      console.log(`  FAIL  ${display} — invalid status "${frontmatter.status}"`);
      issues++;
    }

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

  if (config.chain && slugDirs.length > 0) {
    console.log(`\n  Chain: ${config.chain.join(" → ")}`);
    for (const slug of slugDirs) {
      const slugPath = path.join(sddDir, slug);
      const slugFiles = fs.readdirSync(slugPath).filter((f) => f.endsWith(".md"));
      const slugArtifacts = new Set(slugFiles.map((f) => f.replace(".md", "").replace(/^CHECKPOINT-.*/, "CHECKPOINT")));

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

module.exports = { cmdDoctor };
