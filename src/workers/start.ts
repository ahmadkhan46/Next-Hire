#!/usr/bin/env tsx

import '@/workers/resume-parse.worker';
import '@/workers/bulk-import.worker';

console.log('✅ Workers started');
console.log('📋 Active queues:');
console.log('  - resume-parse (concurrency: 5)');
console.log('  - bulk-import (concurrency: 2)');
console.log('\nPress Ctrl+C to stop workers');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down workers...');
  process.exit(0);
});
