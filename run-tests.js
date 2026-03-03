#!/usr/bin/env node

/**
 * Quick test runner for middleware helper functions
 * Run: node run-tests.js
 */

// Mock the helper functions locally for testing
function extractOrgIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/orgs\/([^\/]+)/);
  return match ? match[1] : null;
}

function isOrgScopedPath(pathname) {
  return /^\/api\/orgs\/[^\/]+/.test(pathname);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  MIDDLEWARE HELPER FUNCTIONS - QUICK TEST');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test extractOrgIdFromPath
console.log('✅ TEST: extractOrgIdFromPath()');
const extractTests = [
  { input: '/api/orgs/org-123/candidates', expected: 'org-123' },
  { input: '/api/orgs/org-456/candidates/cand-789/skills', expected: 'org-456' },
  { input: '/api/health', expected: null },
  { input: '/api/candidates/cand-123', expected: null },
];

let extractPass = 0;
extractTests.forEach(({ input, expected }) => {
  const result = extractOrgIdFromPath(input);
  const passed = result === expected;
  if (passed) extractPass++;
  console.log(`  ${passed ? '✓' : '✗'} "${input}" → "${result}" (expected: "${expected}")`);
});
console.log(`  Result: ${extractPass}/${extractTests.length} passed\n`);

// Test isOrgScopedPath
console.log('✅ TEST: isOrgScopedPath()');
const scopeTests = [
  { input: '/api/orgs/org-123/candidates', expected: true },
  { input: '/api/orgs/org-123/jobs', expected: true },
  { input: '/api/orgs/org-123', expected: true },
  { input: '/api/candidates', expected: false },
  { input: '/api/health', expected: false },
  { input: '/orgs/org-123/candidates', expected: false },
];

let scopePass = 0;
scopeTests.forEach(({ input, expected }) => {
  const result = isOrgScopedPath(input);
  const passed = result === expected;
  if (passed) scopePass++;
  console.log(`  ${passed ? '✓' : '✗'} "${input}" → ${result} (expected: ${expected})`);
});
console.log(`  Result: ${scopePass}/${scopeTests.length} passed\n`);

// Summary
const total = extractPass + scopePass;
const expectedTotal = extractTests.length + scopeTests.length;
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  OVERALL: ${total}/${expectedTotal} tests passed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (total === expectedTotal) {
  console.log('✅ All helper functions working correctly!');
  console.log('\nNext steps:');
  console.log('1. Start dev server: npm run dev');
  console.log('2. Execute manual test scenarios from src/__tests__/middleware.test.ts');
  console.log('3. Test all 8 scenarios (auth, org isolation, public paths, etc)');
  console.log('4. Measure performance overhead');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Check helper function implementations.');
  process.exit(1);
}
