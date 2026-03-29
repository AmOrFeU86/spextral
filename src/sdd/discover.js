const fs = require("fs");
const path = require("path");
const { parseFrontmatter } = require("../utils");

/**
 * Discovers .sdd/ state: slugs, their artifacts, frontmatters, and tasks.
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

module.exports = { discoverSddState };
