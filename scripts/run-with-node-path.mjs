import { spawnSync } from "node:child_process";
import { delimiter, join } from "node:path";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-node-path.mjs <command> [...args]");
  process.exit(1);
}

const executable = process.platform === "win32" ? `${command}.cmd` : command;
const localBin = join(process.cwd(), "node_modules", ".bin", executable);
const localModules = join(process.cwd(), "node_modules");
const nodePath = [localModules, process.env.NODE_PATH].filter(Boolean).join(delimiter);

const result = spawnSync(localBin, args, {
  env: { ...process.env, NODE_PATH: nodePath },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);