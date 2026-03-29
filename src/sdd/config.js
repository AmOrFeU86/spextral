const fs = require("fs");
const path = require("path");

function loadSddConfig(sddDir) {
  const configPath = path.join(sddDir, "config.json");
  if (!fs.existsSync(configPath)) {
    return { chain: ["SPEC", "PLAN", "PROGRESS", "VALIDATION", "CHECKPOINT", "REVIEW", "TEST", "SECURITY"] };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

module.exports = { loadSddConfig };
