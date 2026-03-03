import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function main() {
  try {
    const output = run("npx prisma migrate status");
    console.log(output.trim());

    const lowered = output.toLowerCase();
    const hasModifiedWarning =
      lowered.includes("was modified after it was applied") ||
      lowered.includes("modified after it was applied");

    if (hasModifiedWarning) {
      console.error("\nFAIL migration health: applied migration file changed.");
      process.exit(1);
    }

    console.log("\nPASS migration health.");
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("FAIL migration health:", message);
    process.exit(1);
  }
}

main();
