const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const checks = [
  { name: "home", path: "/", allowed: [200] },
  { name: "sign-in", path: "/sign-in", allowed: [200] },
  { name: "org page (signed-out redirect)", path: "/orgs/demo", allowed: [307] },
  { name: "org discovery API (signed-out redirect)", path: "/api/orgs/my", allowed: [307] },
];

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const ok = check.allowed.includes(response.status);
  return {
    ...check,
    status: response.status,
    location: response.headers.get("location"),
    ok,
  };
}

async function main() {
  const results = [];
  for (const check of checks) {
    try {
      const result = await runCheck(check);
      results.push(result);
    } catch (error) {
      results.push({
        ...check,
        status: -1,
        location: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let failed = 0;
  for (const result of results) {
    if (result.ok) {
      console.log(`PASS ${result.name}: ${result.status}`);
    } else {
      failed += 1;
      console.error(
        `FAIL ${result.name}: got ${result.status}, expected ${result.allowed.join(", ")}${result.error ? ` | ${result.error}` : ""}`
      );
    }
    if (result.location) {
      console.log(`  location: ${result.location}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }

  console.log("Smoke test passed.");
  process.exit(0);
}

main();
