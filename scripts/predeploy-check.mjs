import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(command, label) {
  const started = Date.now();
  console.log(`\n[RUN] ${label}`);
  execSync(command, { stdio: "inherit" });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[PASS] ${label} (${elapsed}s)`);
}

function stopStalePrismaEngine() {
  try {
    if (process.platform === "win32") {
      execSync("taskkill /IM query-engine-windows.exe /F", { stdio: "ignore" });
    } else {
      execSync("pkill -f query-engine", { stdio: "ignore" });
    }
    console.log("[INFO] Stopped stale Prisma query engine process.");
  } catch {
    // no-op if process was not running
  }
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const map = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function mergedEnv() {
  const root = process.cwd();
  const env = parseEnvFile(path.join(root, ".env"));
  const envLocal = parseEnvFile(path.join(root, ".env.local"));
  return { ...env, ...envLocal, ...process.env };
}

function isPlaceholder(value) {
  if (!value) return true;
  const lowered = value.toLowerCase();
  return (
    lowered.includes("your_key_here") ||
    lowered.includes("database_name") ||
    lowered.includes("user:password") ||
    lowered.includes("example") ||
    lowered === "changeme"
  );
}

function validateEnv() {
  const env = mergedEnv();
  const vercelEnv = String(env.VERCEL_ENV ?? "").toLowerCase();
  const enforceProdChecks = String(env.ENFORCE_PROD_CHECKS ?? "") === "1";
  const isProductionTarget = vercelEnv === "production" || enforceProdChecks;
  const required = [
    "DATABASE_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_APP_URL",
  ];

  const errors = [];
  const warnings = [];

  for (const key of required) {
    const value = env[key];
    if (!value || isPlaceholder(value)) {
      errors.push(`Missing/placeholder env var: ${key}`);
    }
  }

  const queueMode = (env.QUEUE_MODE ?? "memory").trim().toLowerCase();
  if (!["memory", "redis"].includes(queueMode)) {
    errors.push(`Invalid QUEUE_MODE="${env.QUEUE_MODE}". Allowed: memory|redis`);
  }
  if (queueMode === "memory") {
    const message =
      "QUEUE_MODE is memory. Use QUEUE_MODE=redis and run workers separately for production.";
    if (isProductionTarget) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }
  if (queueMode === "redis") {
    const redisUrl = env.REDIS_URL;
    if (!redisUrl || isPlaceholder(redisUrl)) {
      errors.push("QUEUE_MODE=redis requires REDIS_URL");
    }
  }

  if (!env.OPENAI_API_KEY || isPlaceholder(env.OPENAI_API_KEY)) {
    warnings.push("OPENAI_API_KEY is missing/placeholder. AI extraction/generation features will be disabled.");
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
  if (appUrl.startsWith("http://")) {
    const message = "NEXT_PUBLIC_APP_URL uses http://. Use https:// for production.";
    if (isProductionTarget) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (errors.length > 0) {
    console.error("\n[FAIL] Environment validation");
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log("\n[PASS] Environment validation");
  if (warnings.length > 0) {
    console.warn("[WARN] Environment warnings:");
    for (const warn of warnings) console.warn(`  - ${warn}`);
  }
}

function main() {
  console.log("Pre-deploy checks started");
  validateEnv();
  run("npm run lint", "Lint");
  run("npm test", "Unit/API tests");
  run("npm run build", "Production build");
  run("npm run db:health", "Migration health");
  run("npx prisma validate", "Prisma schema validation");
  stopStalePrismaEngine();
  run("npx prisma generate", "Prisma client generation");
  console.log("\nAll pre-deploy checks passed.");
}

main();
