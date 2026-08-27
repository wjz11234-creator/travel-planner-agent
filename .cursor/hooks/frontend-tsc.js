#!/usr/bin/env node
/**
 * afterFileEdit：从被改文件向上找带 typecheck/test 的 package.json，防抖跑 tsc。fail open。
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function filePathFromPayload(payload) {
  return String(
    payload.file_path ||
      payload.filePath ||
      payload.path ||
      payload.uri ||
      "",
  );
}

function isFrontendSource(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("/node_modules/")) return false;
  return /\.(ts|tsx|vue|svelte)$/.test(normalized);
}

function findPackageRoot(filePath) {
  let dir = path.dirname(filePath);
  for (let i = 0; i < 16; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        const scripts = pkg.scripts || {};
        if (scripts.typecheck || scripts.test || scripts.build) {
          return dir;
        }
      } catch {
        /* skip invalid package.json */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function shouldRun(stampFile, debounceMs) {
  try {
    const prev = Number(fs.readFileSync(stampFile, "utf8"));
    if (Number.isFinite(prev) && Date.now() - prev < debounceMs) return false;
  } catch {
    /* first run */
  }
  return true;
}

const raw = readStdin();
let payload = {};
try {
  payload = JSON.parse(raw || "{}");
} catch {
  process.stdout.write("{}\n");
  process.exit(0);
}

const edited = filePathFromPayload(payload);
if (!isFrontendSource(edited)) {
  process.stdout.write("{}\n");
  process.exit(0);
}

const pkgRoot = findPackageRoot(edited);
if (!pkgRoot || !fs.existsSync(path.join(pkgRoot, "node_modules"))) {
  process.stdout.write("{}\n");
  process.exit(0);
}

const stampFile = path.join(__dirname, "..", ".tsc-stamp");
if (!shouldRun(stampFile, 30000)) {
  process.stdout.write("{}\n");
  process.exit(0);
}

try {
  fs.writeFileSync(stampFile, String(Date.now()));
} catch {
  /* ignore stamp write */
}

const result = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
  cwd: pkgRoot,
  encoding: "utf8",
  timeout: 45000,
});

if (result.status !== 0) {
  const out = `${result.stdout || ""}${result.stderr || ""}`.trim().slice(0, 4000);
  const msg = out || "tsc --noEmit failed";
  process.stdout.write(
    `${JSON.stringify({ additional_context: `tsc failed in ${pkgRoot}:\n${msg}` })}\n`,
  );
  process.exit(0);
}

process.stdout.write("{}\n");
process.exit(0);
