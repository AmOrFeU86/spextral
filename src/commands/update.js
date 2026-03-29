const fs = require("fs");
const path = require("path");
const { SPEC_SOURCE } = require("../constants");
const { httpsGet } = require("../utils");

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

module.exports = { cmdUpdate };
