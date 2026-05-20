import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version = pkg.version;
if (!version) {
  console.error("bump-readme: no version in package.json");
  process.exit(1);
}

const readmePath = new URL("../README.md", import.meta.url);
const before = readFileSync(readmePath, "utf8");
const after = before
  .replace(/releases\/download\/v\d+\.\d+\.\d+\/pokecli-\d+\.\d+\.\d+\.tgz/g, `releases/download/v${version}/pokecli-${version}.tgz`)
  .replace(/Replace `v\d+\.\d+\.\d+` and `\d+\.\d+\.\d+`/g, `Replace \`v${version}\` and \`${version}\``);

if (after === before) {
  console.log("bump-readme: no URL changes needed");
  process.exit(0);
}

writeFileSync(readmePath, after);
execSync("git add README.md", { stdio: "inherit" });
console.log(`bump-readme: README updated to v${version}`);
