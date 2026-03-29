const fs = require("fs");
const https = require("https");
const readline = require("readline");

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

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: null, body: "" };

  const raw = match[1];
  const fm = {};
  for (const line of raw.split("\n")) {
    const arrMatch = line.match(/^(\w[\w_]*):\s*\[([^\]]*)\]\s*$/);
    if (arrMatch) {
      const items = arrMatch[2]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      fm[arrMatch[1]] = items;
      continue;
    }
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

// Count display width using Intl.Segmenter for proper grapheme handling
function displayWidth(str) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    let w = 0;
    for (const s of seg.segment(str)) {
      const cp = s.segment.codePointAt(0);
      if (
        (cp >= 0x1100 && cp <= 0x115F) ||
        (cp >= 0x2329 && cp <= 0x232A) ||
        (cp >= 0x2E80 && cp <= 0x303E) ||
        (cp >= 0x3040 && cp <= 0x33BF) ||
        (cp >= 0x3400 && cp <= 0x4DBF) ||
        (cp >= 0x4E00 && cp <= 0xA4CF) ||
        (cp >= 0xAC00 && cp <= 0xD7AF) ||
        (cp >= 0xF900 && cp <= 0xFAFF) ||
        (cp >= 0xFE30 && cp <= 0xFE6F) ||
        (cp >= 0xFF01 && cp <= 0xFF60) ||
        (cp >= 0xFFE0 && cp <= 0xFFE6) ||
        (cp >= 0x1F000 && cp <= 0x1FBFF)
      ) {
        w += 2;
      } else {
        w += 1;
      }
    }
    return w;
  }
  return str.length;
}

function wrapText(text, maxLen) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (displayWidth(test) > maxLen) {
      if (current) lines.push(current);
      if (displayWidth(word) > maxLen) {
        let chunk = "";
        for (const ch of word) {
          if (displayWidth(chunk + ch) > maxLen) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function padLine(line, maxLen) {
  const diff = maxLen - displayWidth(line);
  return diff > 0 ? " ".repeat(diff) : "";
}

module.exports = {
  ensureDir,
  appendIfMissing,
  ask,
  parseFrontmatter,
  computeFingerprint,
  httpsGet,
  displayWidth,
  wrapText,
  padLine,
};
