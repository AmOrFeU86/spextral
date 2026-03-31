const fs = require("fs");
const path = require("path");
const { TEMPLATES_DIR, SKILLS_DIR, AGENT_REGISTRY, SDD_SKILLS } = require("../constants");
const BOOTSTRAP_SOURCE = path.join(TEMPLATES_DIR, "bootstrap.md");
const { ensureDir, appendIfMissing, ask } = require("../utils");
const { interactiveCheckbox } = require("../ui/checkbox");
const { askArtifacts } = require("../ui/artifact-picker");

function wrapKiroSteering(content) {
  return `---
inclusion: always
---

${content}`;
}

function generateNativeSkills(agent) {
  if (!agent.skills) return;

  for (const [name, skill] of Object.entries(SDD_SKILLS)) {
    const skillDir = path.join(agent.skills.dir, name);
    const skillPath = path.join(skillDir, "SKILL.md");
    ensureDir(skillDir);

    const templatePath = path.join(SKILLS_DIR, skill.templateFile);
    const body = fs.readFileSync(templatePath, "utf-8");

    fs.writeFileSync(
      skillPath,
      `---\nname: ${name}\ndescription: "${skill.description.replace(/"/g, '\\"').replace(/\\'/g, "'")}"\n---\n\n${body}\n`
    );
    console.log(`    Skill: ${skillPath}`);
  }
}

async function cmdInit() {
  const choices = Object.entries(AGENT_REGISTRY);
  const platformItems = choices.map(([key, val]) => ({
    key,
    label: val.name,
    verified: val.verified || false,
  }));

  const selectedKeys = await interactiveCheckbox({
    title: "Spextral \u2014 Spec-Driven Development Protocol",
    subtitle: "Select agent platform(s):",
    items: platformItems,
    preselected: new Set(),
    hint: "\u2191/\u2193: navigate | Space: toggle | Enter: confirm",
  });

  if (selectedKeys.length === 0) {
    console.error("  No agents selected. Aborting.");
    process.exit(1);
  }

  const selected = selectedKeys.map((key) => [key, AGENT_REGISTRY[key]]);

  const bootstrapContent = fs.readFileSync(BOOTSTRAP_SOURCE, "utf-8");
  const writtenDests = new Set();

  for (const [agentKey, agent] of selected) {
    console.log(`\n  [${agent.name}]`);

    if (agent.dest && !writtenDests.has(agent.dest)) {
      writtenDests.add(agent.dest);
      const destPath = path.resolve(agent.dest);
      let content = bootstrapContent;
      if (agent.kiroSteering) content = wrapKiroSteering(content);

      ensureDir(path.dirname(destPath));
      if (agent.isFile && fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, "utf-8");
        if (!existing.includes("sdd_version") && !existing.includes("Spextral")) {
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
    }

    if (agent.exclusionFile) {
      appendIfMissing(agent.exclusionFile, ".sdd/archive/**");
      console.log(`    Updated ${agent.exclusionFile}`);
    }

    generateNativeSkills(agent);
  }

  const { chain, customArtifacts } = await askArtifacts();

  ensureDir(path.join(".sdd", "archive"));
  const configPath = path.join(".sdd", "config.json");
  const config = { chain };
  if (Object.keys(customArtifacts).length > 0) {
    config.custom_artifacts = customArtifacts;
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("  Created .sdd/ and .sdd/archive/");
  console.log(`  Created .sdd/config.json (chain: ${chain.join(" → ")})`);

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

module.exports = { cmdInit };
