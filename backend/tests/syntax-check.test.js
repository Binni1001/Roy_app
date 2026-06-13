import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function listJsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listJsFiles(path) : path.endsWith(".js") ? [path] : [];
  });
}

for (const file of listJsFiles("src")) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`${file}\n${result.stderr || result.stdout}`);
  }
}
