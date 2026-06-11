import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

function runStep(label, command, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runOptionalScript(label, scriptName) {
  if (!pkg.scripts?.[scriptName]) {
    console.log(`\n==> ${label} skipped (no "${scriptName}" script in package.json)`);
    return;
  }
  runStep(label, "npm", ["run", scriptName]);
}

console.log("FFmpeg Studio regression check\n");

runStep("typecheck", "npm", ["run", "typecheck"]);
runStep("build", "npm", ["run", "build:bundle"]);
runOptionalScript("lint", "lint");
runOptionalScript("unit tests", "test");

console.log("\n==> All required checks passed.\n");
