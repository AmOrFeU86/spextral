const { SDD_CATEGORIES, SDD_ARTIFACTS } = require("../constants");
const { wrapText, padLine } = require("../utils");
const c = require("./colors");

// Build category label lookup
const CATEGORY_LABELS = {};
for (const cat of SDD_CATEGORIES) {
  CATEGORY_LABELS[cat.id] = cat.label;
}

/**
 * Interactive artifact selection UI with details panel, custom artifacts, and reordering.
 * Artifacts are displayed as a flat list — reordering works freely across categories.
 * @returns {Promise<{chain: string[], customArtifacts: object}>}
 */
function askArtifacts() {
  const customArtifacts = {};
  let lastLineCount = 0;
  const selected = new Set(SDD_ARTIFACTS.filter((a) => a.required).map((a) => a.name));
  let cursor = 0;

  function render(mode) {
    const lines = [];
    lines.push("");
    lines.push(`  ${c.title}Spextral \u2014 Spec-Driven Development Protocol${c.reset}`);
    lines.push("");
    lines.push("  Select SDD artifacts to initialize:");
    lines.push("");

    SDD_ARTIFACTS.forEach((a, i) => {
      const isSelected = selected.has(a.name);
      const isCurrentRow = i === cursor;
      const checkColor = isSelected ? c.selected : c.unselected;
      const checked = isSelected ? "x" : " ";
      const pointer = isCurrentRow ? `${c.cursor}>${c.reset}` : " ";
      const nameColor = isSelected ? c.selected : c.reset;
      const shortDesc = a.shortDesc || a.description;

      // Tag: required, custom, or category
      let tag = "";
      if (a.required) {
        tag = `${c.required} (required)${c.reset}`;
      } else if (a.custom) {
        tag = `${c.optional} (custom)${c.reset}`;
      } else {
        const catLabel = CATEGORY_LABELS[a.category] || "";
        if (catLabel) tag = `${c.optional} [${catLabel}]${c.reset}`;
      }

      lines.push(
        `  ${pointer} ${i + 1}. [${checkColor}${checked}${c.reset}] ${nameColor}${a.name}.md${c.reset}${tag}  \u2014 ${shortDesc}`
      );
    });

    const chain = SDD_ARTIFACTS.filter((a) => selected.has(a.name))
      .map((a) => a.name)
      .join(` ${c.chain}\u2192${c.reset} `);
    lines.push("");
    lines.push(`  Chain: ${c.chain}${chain}${c.reset}`);

    // Details panel for currently hovered artifact
    const hoveredArtifact = SDD_ARTIFACTS[cursor];
    if (mode === "select" && hoveredArtifact && hoveredArtifact.details) {
      const artifact = hoveredArtifact;
      const innerWidth = 60;
      const h = "\u2500".repeat(innerWidth);
      const v = `${c.border}\u2502${c.reset}`;
      const tl = `${c.border}\u256d${c.reset}`;
      const tr = `${c.border}\u256e${c.reset}`;
      const bl = `${c.border}\u2570${c.reset}`;
      const br = `${c.border}\u256f${c.reset}`;
      lines.push("");
      lines.push(`  ${tl}${h}${tr}`);
      lines.push(`  ${v} ${c.label}Details:${c.reset} ${artifact.name}.md${padLine(" Details: " + artifact.name + ".md", innerWidth)}${v}`);

      lines.push(`  ${v}${" ".repeat(innerWidth)}${v}`);

      const beginnerLabel = "\ud83d\udc68\u200d\ud83d\udcbb For beginners:";
      lines.push(`  ${v} ${c.label}${beginnerLabel}${c.reset}${padLine(" " + beginnerLabel, innerWidth)}${v}`);
      const beginnerLines = wrapText(artifact.details.beginner, innerWidth - 2);
      beginnerLines.forEach(line => {
        lines.push(`  ${v} ${line}${padLine(" " + line, innerWidth)}${v}`);
      });

      lines.push(`  ${v}${" ".repeat(innerWidth)}${v}`);

      const expertLabel = "\ud83e\udde0 For experts:";
      lines.push(`  ${v} ${c.label}${expertLabel}${c.reset}${padLine(" " + expertLabel, innerWidth)}${v}`);
      const expertLines = wrapText(artifact.details.expert, innerWidth - 2);
      expertLines.forEach(line => {
        lines.push(`  ${v} ${line}${padLine(" " + line, innerWidth)}${v}`);
      });

      lines.push(`  ${bl}${h}${br}`);
    }

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

module.exports = { askArtifacts };
