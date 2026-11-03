// Bundles the CLI (and the shared gate logic it imports from features/gates/shared) into one
// dependency-free file, so `node tollgate.mjs hook` starts fast on every Bash call.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));

await build({
  entryPoints: [join(here, "src", "main.ts")],
  outfile: join(here, "dist", "tollgate.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: false,
  legalComments: "none",
  banner: { js: "#!/usr/bin/env node" },
  define: { TOLLGATE_VERSION: JSON.stringify(version) },
  logLevel: "warning",
});
console.log(`built packages/cli/dist/tollgate.mjs (v${version})`);
