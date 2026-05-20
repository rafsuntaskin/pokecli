import { execSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { existsSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version = pkg.version;
const tag = `v${version}`;
const tarball = `release/pokecli-${version}.tgz`;

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function which(bin) {
  try {
    execSync(`command -v ${bin}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

mkdirSync("release", { recursive: true });
run("npm ci");
run("npm run typecheck");
run("npm test");
run("npm run build");
run("npm pack --pack-destination release");

if (!existsSync(tarball)) {
  console.error(`expected ${tarball} but it is not there`);
  process.exit(1);
}

if (!which("gh")) {
  console.log("");
  console.log("Built tarball:");
  console.log(`  ${tarball}`);
  console.log("");
  console.log("gh CLI is not installed. Upload via the web UI:");
  console.log(`  https://github.com/rafsuntaskin/pokecli/releases/new?tag=${tag}`);
  console.log("Or install gh: brew install gh");
  process.exit(0);
}

try {
  execSync(`gh release view ${tag}`, { stdio: "ignore" });
  console.log(`Release ${tag} already exists. Updating asset.`);
  run(`gh release upload ${tag} ${tarball} --clobber`);
} catch {
  console.log(`Creating release ${tag}.`);
  run(`gh release create ${tag} ${tarball} --title "${tag}" --generate-notes --verify-tag`);
}

console.log("");
console.log(`Release published: https://github.com/rafsuntaskin/pokecli/releases/tag/${tag}`);
