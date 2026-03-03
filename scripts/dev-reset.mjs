#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const cwd = process.cwd();
const project = cwd.replace(/\\/g, "\\\\");

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function killPid(pid) {
  if (!pid) return;
  run(`cmd /c taskkill /PID ${pid} /F`);
}

const psQuery = `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ` +
  `Get-CimInstance Win32_Process | ` +
  `Where-Object { $_.Name -eq 'node.exe' -and (` +
  `$_.CommandLine -like '*${project}*next*dev*' -or ` +
  `$_.CommandLine -like '*${project}*start-server.js*' -or ` +
  `$_.CommandLine -like '*${project}*.next*postcss.js*' ) } | ` +
  `Select-Object -ExpandProperty ProcessId`;

const raw = run(`powershell -NoProfile -Command "${psQuery}"`);
const pids = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /^\d+$/.test(line));

for (const pid of pids) killPid(pid);

const lockFile = join(cwd, ".next", "dev", "lock");
if (existsSync(lockFile)) {
  rmSync(lockFile, { force: true });
}

console.log(`dev:reset complete. Killed ${pids.length} process(es). Lock cleared: ${!existsSync(lockFile)}`);
