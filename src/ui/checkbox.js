const c = require("./colors");

/**
 * Generic interactive checkbox UI.
 * @param {object} opts
 * @param {string} opts.title - Header text
 * @param {Array<{key: string, label: string, locked?: boolean, verified?: boolean}>} opts.items
 * @param {Set<string>} opts.preselected - Keys selected by default
 * @param {function} [opts.footerFn] - Receives selected Set, returns string
 * @param {string} [opts.subtitle] - Plain text line below the title
 * @param {string} [opts.hint] - Controls hint line
 * @returns {Promise<string[]>} Selected keys in display order
 */
function interactiveCheckbox({ title, subtitle, items, preselected, footerFn, hint }) {
  const selected = new Set(preselected);
  let cursor = 0;
  let lastLineCount = 0;

  function render() {
    const lines = [];
    lines.push("");
    lines.push(`  ${c.title}${title}${c.reset}`);
    lines.push("");
    if (subtitle) lines.push(`  ${subtitle}`);
    if (subtitle) lines.push("");
    items.forEach((item, i) => {
      const isCurrentRow = i === cursor;
      const isSelected = selected.has(item.key);
      const checkColor = isSelected ? c.selected : c.unselected;
      const checked = isSelected ? "x" : " ";
      const tag = item.locked ? `${c.locked} (required)${c.reset}` : item.verified ? `${c.verified} — verified${c.reset}` : "";
      const pointer = isCurrentRow ? `${c.cursor}>${c.reset}` : " ";
      const labelColor = isSelected ? c.selected : c.reset;
      lines.push(`  ${pointer} ${i + 1}. [${checkColor}${checked}${c.reset}] ${labelColor}${item.label}${c.reset}${tag}`);
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

module.exports = { interactiveCheckbox };
