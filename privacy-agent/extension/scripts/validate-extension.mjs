import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
const errors = [];
const checks = [];

function ok(condition, message) {
  checks.push({ message, ok: Boolean(condition) });
  if (!condition) errors.push(message);
}

ok(manifest.manifest_version === 3, "Manifest V3");
ok(manifest.background?.service_worker === "background.js", "Service worker declared");
ok(manifest.side_panel?.default_path === "sidepanel.html", "Side panel declared");
ok(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, "Content script declared");
ok(!JSON.stringify(manifest.host_permissions).includes("<all_urls>"), "No required wildcard host permission");
ok(manifest.permissions?.includes("sidePanel"), "sidePanel permission present");
ok(!manifest.permissions?.includes("webRequest"), "No webRequest permission");
ok(!manifest.permissions?.includes("cookies"), "No cookies permission");

for (const file of [
  "background.js",
  "content.js",
  "sidepanel.js",
  "sidepanel.html",
  "sidepanel.css",
  "manifest.json",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
]) {
  try {
    const info = await stat(path.join(dist, file));
    ok(info.size > 0, `Built asset exists: ${file}`);
  } catch {
    ok(false, `Missing built asset: ${file}`);
  }
}

for (const size of [16, 48, 128]) {
  const png = await readFile(path.join(dist, "icons", `icon${size}.png`));
  ok(
    png[0] === 0x89 && png.subarray(1, 4).toString() === "PNG",
    `icon${size}.png has a PNG signature`,
  );
}

for (const file of ["background.js", "content.js", "sidepanel.js"]) {
  const code = await readFile(path.join(dist, file), "utf8");
  ok(!/\beval\s*\(/.test(code), `${file} contains no eval()`);
  ok(!/\bnew\s+Function\s*\(/.test(code), `${file} contains no dynamic Function()`);
  ok(!/document\.write\s*\(/.test(code), `${file} contains no document.write()`);
}

const sizes = await Promise.all(
  ["background.js", "content.js", "sidepanel.js"].map(async (file) => {
    const info = await stat(path.join(dist, file));
    return `${file}=${(info.size / 1024).toFixed(1)}KB`;
  }),
);

console.log("Extension static validation");
for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.message}`);
console.log(`Bundles: ${sizes.join(", ")}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} validation error(s).`);
  process.exit(1);
}
console.log("\nAll static Manifest V3 checks passed.");
