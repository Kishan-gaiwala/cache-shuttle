const CacheShuttle = require('./lib/index.js');

async function runTests() {
  console.log("🧪 Running CacheShuttle Test Suite...\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // =========================================================================
  // SECTION 1: In-Memory Cache (New Features)
  // =========================================================================
  console.log("--- In-Memory Cache Tests ---\n");

  // Test 1: Basic Set and Get
  try {
    const cache = new CacheShuttle({ enableBackgroundSweep: false });
    cache.set('name', 'Antigravity');
    const val = await cache.get('name');
    assert(val === 'Antigravity', 'Should set and retrieve basic string values');
    cache.destroy();
  } catch (err) {
    assert(false, `Test 1 threw error: ${err.message}`);
  }

  // Test 2: Manual Delete
  try {
    const cache = new CacheShuttle({ enableBackgroundSweep: false });
    cache.set('key-to-delete', 'value');
    cache.delete('key-to-delete');
    const val = await cache.get('key-to-delete');
    assert(val === null, 'Should return null for manually deleted keys');
    cache.destroy();
  } catch (err) {
    assert(false, `Test 2 threw error: ${err.message}`);
  }

  // Test 3: Clear
  try {
    const cache = new CacheShuttle({ enableBackgroundSweep: false });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    const a = await cache.get('a');
    const b = await cache.get('b');
    assert(a === null && b === null, 'Should return null for all keys after clear()');
    cache.destroy();
  } catch (err) {
    assert(false, `Test 3 threw error: ${err.message}`);
  }

  // Test 4: Passive Expiration (via get)
  try {
    const cache = new CacheShuttle({ enableBackgroundSweep: false });
    cache.set('temp', 'expired-data', 50); // 50ms TTL
    const before = await cache.get('temp');
    assert(before === 'expired-data', 'Should retrieve data before TTL expiration');

    await sleep(60);
    const after = await cache.get('temp');
    assert(after === null, 'Should return null after TTL expiration (passive cleanup)');
    cache.destroy();
  } catch (err) {
    assert(false, `Test 4 threw error: ${err.message}`);
  }

  // Test 5: Active Background Sweep
  try {
    const cache = new CacheShuttle({ sweepInterval: 20, enableBackgroundSweep: true });
    cache.set('temp-active', 'active-data', 10); // 10ms TTL

    await sleep(40);
    assert(!cache.cache.has('temp-active'), 'Background sweep should remove expired keys from map');
    cache.destroy();
  } catch (err) {
    assert(false, `Test 5 threw error: ${err.message}`);
  }

  // =========================================================================
  // SECTION 2: Bridge Mode (Old API - Backward Compatibility)
  // =========================================================================
  console.log("\n--- Bridge Mode Tests (Backward Compatibility) ---\n");

  // Create mock adapters (same pattern as old examples/demo.js)
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

  // Test 6: Bridge mode constructor accepts source + target
  try {
    const shuttle = new CacheShuttle({
      source: sourceAdapter,
      target: targetAdapter,
      batchSize: 50,
      enableBackgroundSweep: false
    });
    assert(shuttle._bridgeMode === true, 'Should enable bridge mode when source and target are provided');
    shuttle.destroy();
  } catch (err) {
    assert(false, `Test 6 threw error: ${err.message}`);
  }

  // Test 7: Dual-write set (writes to both source and target)
  try {
    mockSource.clear();
    mockTarget.clear();
    const shuttle = new CacheShuttle({
      source: sourceAdapter,
      target: targetAdapter,
      enableBackgroundSweep: false
    });

    await shuttle.set('user:1', { name: 'Alice' });
    assert(
      mockSource.get('user:1')?.name === 'Alice' && mockTarget.get('user:1')?.name === 'Alice',
      'Dual-write should store data in both source and target adapters'
    );
    shuttle.destroy();
  } catch (err) {
    assert(false, `Test 7 threw error: ${err.message}`);
  }

  // Test 8: transferAll migrates data from source to target
  try {
    mockSource.clear();
    mockTarget.clear();
    mockSource.set('session:1', { id: 1 });
    mockSource.set('session:2', { id: 2 });

    const shuttle = new CacheShuttle({
      source: sourceAdapter,
      target: targetAdapter,
      batchSize: 50,
      enableBackgroundSweep: false
    });

    const report = await shuttle.transferAll();
    assert(report.success === true, 'transferAll() should report success');
    assert(report.totalKeysFound === 2, 'transferAll() should find 2 keys');
    assert(report.moved === 2, 'transferAll() should move 2 keys');
    assert(report.failed === 0, 'transferAll() should have 0 failures');
    assert(
      mockTarget.get('session:1')?.id === 1 && mockTarget.get('session:2')?.id === 2,
      'transferAll() should copy all data to target adapter'
    );
    shuttle.destroy();
  } catch (err) {
    assert(false, `Test 8 threw error: ${err.message}`);
  }

  // Test 9: transferAll throws helpful error in standalone mode
  try {
    const cache = new CacheShuttle({ enableBackgroundSweep: false });
    let threwError = false;
    try {
      await cache.transferAll();
    } catch (e) {
      threwError = true;
    }
    assert(threwError, 'transferAll() should throw an error when not in bridge mode');
    cache.destroy();
  } catch (err) {
    assert(false, `Test 9 threw error: ${err.message}`);
  }

  // --- Summary ---
  console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
