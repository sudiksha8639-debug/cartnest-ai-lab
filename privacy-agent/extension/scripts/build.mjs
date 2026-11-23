import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const shared = {
  bundle: true,
  sourcemap: false,
  target: ["chrome114"],
  logLevel: "info",
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
};

await build({
  ...shared,
  entryPoints: [path.join(root, "src/content/index.ts")],
  outfile: path.join(dist, "content.js"),
  format: "iife",
});

await build({
  ...shared,
  entryPoints: [path.join(root, "src/background/index.ts")],
  outfile: path.join(dist, "background.js"),
  format: "esm",
});

await build({
  ...shared,
  entryPoints: [path.join(root, "src/ui/sidepanel.ts")],
  outfile: path.join(dist, "sidepanel.js"),
  format: "iife",
});

await cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
await cp(path.join(root, "src/ui/sidepanel.html"), path.join(dist, "sidepanel.html"));
await cp(path.join(root, "src/ui/sidepanel.css"), path.join(dist, "sidepanel.css"));
await cp(path.join(root, "icons"), path.join(dist, "icons"), { recursive: true });

if (!existsSync(path.join(dist, "manifest.json"))) {
  throw new Error("Build did not produce manifest.json");
}

console.log("Extension built in extension/dist");
