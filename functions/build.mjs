// Bundles the function with the app's shared form and PDF code (../src/forms, ../src/pdf),
// which deploy would otherwise leave out because only this folder is uploaded.
// npm packages stay external and are installed from package.json at deploy.
import { cpSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("lib", { recursive: true, force: true });
await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
});
cpSync("../src/pdf/fonts", "lib/fonts", { recursive: true });
console.log("Built lib/index.js");
