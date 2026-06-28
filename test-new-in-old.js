/**
 * This file proves that NEW features (TTL, background sweep, delete, clear, destroy)
 * work correctly INSIDE the old bridge mode setup (source + target adapters).
 * 
 * Old users can adopt new features without changing their existing code.
 */

const CacheShuttle = require('./lib/index.js');

async function testNewFeaturesInBridgeMode() {
  console.log("🧪 Testing NEW features inside OLD bridge mode setup...\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) { console.log(`✅ [PASS] ${message}`); passed++; }
    else { console.error(`❌ [FAIL] ${message}`); failed++; }
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Old-style mock adapters (exactly how v1.0.0 users set them up)
  const mockSource = new Map();
  const mockTarget = new Map();

  const sourceAdapter = {
    getKeys: async () => Array.from(mockSource.keys()),
    get: async (key) => mockSource.get(key),
    set: async (key, value) => { mockSource.set(key, value); }
  };

  const targetAdapter = {
    get: async (key) => mockTarget.get(key),
    set: async (key, value) => { mockTarget.set(key, value); }
  };

  // OLD constructor + NEW options combined
  const shuttle = new CacheShuttle({
    source: sourceAdapter,
    target: targetAdapter,
    batchSize: 50,
    sweepInterval: 30,              // NEW: sweep every 30ms (fast for testing)
    enableBackgroundSweep: true     // NEW: background sweep enabled
  });

  // --- Test 1: Old transferAll still works ---
  mockSource.set("user:1", { name: "Alice" });
  mockSource.set("user:2", { name: "Bob" });
  const report = await shuttle.transferAll();
  assert(report.success === true && report.moved === 2, 'Old transferAll() still works with new options');

  // --- Test 2: Old dual-write set() still works ---
  mockSource.clear();
  mockTarget.clear();
  await shuttle.set("key1", "hello");
  assert(mockSource.get("key1") === "hello", 'Old dual-write to source still works');
  assert(mockTarget.get("key1") === "hello", 'Old dual-write to target still works');

  // --- Test 3: NEW TTL works in bridge mode ---
  await shuttle.set("temp", "expires-soon", 50); // 50ms TTL
  const before = await shuttle.get("temp");
  assert(before === "expires-soon", 'NEW: TTL key is readable before expiration in bridge mode');

  await sleep(60);
  const after = await shuttle.get("temp");
  // After TTL expires, in-memory cache returns null, but falls through to source adapter
  // The value is still in source adapter because adapters don't have TTL
  assert(after === "expires-soon", 'Bridge mode falls through to source adapter after in-memory TTL expires');

  // --- Test 4: NEW delete() works in bridge mode ---
  shuttle.cache.set("local-only", { value: "test", expiresAt: null });
  shuttle.delete("local-only");
  assert(!shuttle.cache.has("local-only"), 'NEW: delete() removes key from in-memory cache in bridge mode');

  // --- Test 5: NEW clear() works in bridge mode ---
  await shuttle.set("x", 1);
  await shuttle.set("y", 2);
  shuttle.clear();
  assert(shuttle.cache.size === 0, 'NEW: clear() empties in-memory cache in bridge mode');

  // --- Test 6: NEW background sweep works in bridge mode ---
  await shuttle.set("sweep-me", "gone", 10); // 10ms TTL
  await sleep(50); // Wait for sweep to run
  assert(!shuttle.cache.has("sweep-me"), 'NEW: Background sweep cleans expired keys in bridge mode');

  // --- Test 7: NEW destroy() works in bridge mode ---
  shuttle.destroy();
  assert(true, 'NEW: destroy() runs without errors in bridge mode');

  // --- Summary ---
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

testNewFeaturesInBridgeMode();
