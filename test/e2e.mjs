import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

// ── Helpers ───────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL  ${message}`);
    failed++;
    return false;
  }
  console.log(`  PASS  ${message}`);
  passed++;
  return true;
}

function setupTestProject() {
  const tmpBase = path.join(__dirname, "tmp");
  fs.mkdirSync(tmpBase, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(tmpBase, "e2e-"));

  // Use bootstrap for CLAUDE.md (protocol lives in the skill)
  const bootstrapContent = fs.readFileSync(path.join(TEMPLATES_DIR, "bootstrap.md"), "utf-8");
  fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), bootstrapContent);

  // Create sdd-wake skill with full protocol embedded
  const specContent = fs.readFileSync(path.join(TEMPLATES_DIR, "spextral.md"), "utf-8");
  const skillDir = path.join(tmpDir, ".claude", "skills", "sdd-wake");
  fs.mkdirSync(skillDir, { recursive: true });
  const skillBody = `Run the SDD_WAKE protocol. Discover the .sdd/ directory, read artifact frontmatters, check chain integrity using .sdd/config.json, perform capabilities handshake, and report status with a suggested next action.

IMPORTANT — Auto-Continuation Rule: After completing implementation, you MUST continue through the ENTIRE artifact chain without stopping. Run \`spextral next\` after each artifact and execute the suggested action until STATUS is \`all_complete\`. This includes custom artifacts — read their description from config.custom_artifacts and execute them (applying code changes if needed, then generating the artifact .md file). Do NOT consider a feature done until every artifact in the chain is generated and validated.

---

${specContent}`;
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: sdd-wake\ndescription: Activates the SDD spec-driven development protocol and discovers project state.\n---\n\n${skillBody}\n`
  );

  // Create .sdd/ structure
  fs.mkdirSync(path.join(tmpDir, ".sdd", "archive"), { recursive: true });

  return tmpDir;
}

function findSlugDirs(sddDir) {
  if (!fs.existsSync(sddDir)) return [];
  return fs.readdirSync(sddDir).filter((f) => {
    const full = path.join(sddDir, f);
    return fs.statSync(full).isDirectory() && f !== "archive";
  });
}

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

async function runQuery(prompt, cwd, maxTurns = 15) {
  let lastText = "";
  const session = query({
    prompt,
    options: {
      cwd,
      permissionMode: "bypassPermissions",
      settingSources: ["project"],
      maxTurns,
      model: MODEL,
    },
  });

  for await (const msg of session) {
    // Log progress in real-time
    // Show tool results
    if (msg.type === "user" && msg.message?.content) {
      const content = Array.isArray(msg.message.content) ? msg.message.content : [];
      for (const block of content) {
        if (block.type === "tool_result") {
          const text = typeof block.content === "string"
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c) => (c.type === "text" ? c.text : "")).join("")
              : "";
          if (text) {
            const status = block.is_error ? "ERR" : "OK";
            const preview = text.replace(/\n/g, " ").slice(0, 150);
            console.log(`   ${status}  ${preview}`);
          }
        }
      }
    }

    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === "text") {
          lastText = block.text;
          // Show a short preview
          const preview = block.text.replace(/\n/g, " ").slice(0, 100);
          console.log(`  ...  ${preview}`);
        }
        if (block.type === "tool_use") {
          const input = block.input || {};
          let detail = "";
          if (block.name === "Bash" && input.command) {
            detail = input.command.replace(/\n/g, " ").slice(0, 120);
          } else if (block.name === "Read" && input.file_path) {
            detail = input.file_path;
          } else if (block.name === "Write" && input.file_path) {
            detail = input.file_path;
          } else if (block.name === "Edit" && input.file_path) {
            detail = input.file_path;
          } else if (block.name === "Glob" && input.pattern) {
            detail = input.pattern;
          } else if (block.name === "Grep" && input.pattern) {
            detail = input.pattern;
          } else {
            detail = JSON.stringify(input).slice(0, 120);
          }
          console.log(`  ...  [${block.name}] ${detail}`);
        }
      }
    }
  }

  return lastText;
}

// ── Test ──────────────────────────────────────────────

async function run() {
  console.log("\n  Spextral E2E Test\n");

  const testDir = setupTestProject();
  console.log(`  Test project: ${testDir}\n`);

  try {
    // Step 1: SDD_WAKE
    console.log("  Step 1: SDD_WAKE\n");
    const wakeText = await runQuery("SDD_WAKE", testDir, 10);
    assert(wakeText.length > 0, "SDD_WAKE returned a response");
    assert(
      wakeText.toLowerCase().includes("activat") || wakeText.toLowerCase().includes("sdd") || wakeText.toLowerCase().includes("spextral"),
      "Response mentions SDD/Spextral activation"
    );

    // Step 2: Request a simple feature
    console.log("\n  Step 2: Request feature (this may take a few minutes)\n");
    const featureText = await runQuery(
      'slug: calculator. Description: a Python script calculator.py with a function add(a, b) that returns a + b, and prints add(2, 3) when run directly. Apply SDD_APPROVE_ALL to skip all reviews. Execute the full SDD flow: SPEC, PLAN, IMPLEMENT. Put all artifacts in .sdd/calculator/ folder.',
      testDir,
      30
    );
    assert(featureText.length > 0, "Feature request returned a response");

    // Step 3: Verify artifacts in folder structure
    console.log("\n  Step 3: Verify artifacts\n");

    const sddDir = path.join(testDir, ".sdd");
    const slugDirs = findSlugDirs(sddDir);
    assert(slugDirs.length > 0, `Found slug folder(s): ${slugDirs.join(", ")}`);

    // Find the calculator slug
    const calcSlug = slugDirs.find((s) => s.includes("calc"));
    if (!assert(calcSlug, `Found calculator slug folder: ${calcSlug}`)) {
      // Fallback: check for any artifacts in any slug dir
      console.log(`  INFO  Available slugs: ${slugDirs.join(", ")}`);
      // Also check flat files as fallback
      const flatFiles = fs.readdirSync(sddDir).filter((f) => f.endsWith(".md"));
      console.log(`  INFO  Flat files in .sdd/: ${flatFiles.join(", ")}`);
    }

    if (calcSlug) {
      const slugPath = path.join(sddDir, calcSlug);
      const artifacts = fs.readdirSync(slugPath);
      console.log(`  INFO  Artifacts: ${artifacts.join(", ")}\n`);

      assert(artifacts.some((a) => a === "SPEC.md"), "SPEC.md exists");
      assert(artifacts.some((a) => a === "PLAN.md"), "PLAN.md exists");

      // Check fingerprint in SPEC
      const specPath = path.join(slugPath, "SPEC.md");
      if (fs.existsSync(specPath)) {
        const specContent = fs.readFileSync(specPath, "utf-8");
        assert(specContent.includes("fingerprint:"), "SPEC.md has fingerprint field");
      }
    }

    // Step 4: Verify code was generated
    console.log("\n  Step 4: Verify code\n");

    const calcFile = path.join(testDir, "calculator.py");
    assert(fs.existsSync(calcFile), "calculator.py was created");

    if (fs.existsSync(calcFile)) {
      const calcContent = fs.readFileSync(calcFile, "utf-8");
      assert(calcContent.includes("def add"), "calculator.py contains add function");
    }

    // Summary
    console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error(`\n  ERROR: ${err.message}\n`);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
      console.log("  Cleaned up test project.\n");
    } catch {
      console.log(`  WARN  Could not clean up ${testDir}\n`);
    }
  }
}

run();
