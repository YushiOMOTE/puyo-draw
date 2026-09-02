import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const compiler = process.env.EMXX || "em++";
const core = ["field.cpp", "fieldbit.cpp", "move.cpp"]
  .map((file) => `third_party/ama/core/${file}`);
const beam = [
  "beam.cpp",
  "eval.cpp",
  "form.cpp",
  "layer.cpp",
  "quiet.cpp",
  "table.cpp",
].map((file) => `third_party/ama/ai/search/beam/${file}`);

mkdirSync(resolve(root, "ama"), { recursive: true });
const result = spawnSync(compiler, [
  "-std=c++20",
  "-O3",
  "-DNDEBUG",
  "-DAMA_PRESSURELESS=1",
  "-msimd128",
  "-msse4.1",
  ...core,
  ...beam,
  "ama/pressureless-ama.cpp",
  "--no-entry",
  "-sENVIRONMENT=worker",
  "-sALLOW_MEMORY_GROWTH=1",
  "-sMODULARIZE=1",
  "-sEXPORT_NAME=createPressurelessAma",
  "-sEXPORTED_RUNTIME_METHODS=ccall",
  "-sFILESYSTEM=0",
  "-o",
  "ama/pressureless-ama.js",
], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

chmodSync(resolve(root, "ama/pressureless-ama.js"), 0o644);
chmodSync(resolve(root, "ama/pressureless-ama.wasm"), 0o644);
