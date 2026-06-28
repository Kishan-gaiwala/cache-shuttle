/**
 * This file simulates EXACTLY what an existing v1.0.0 user's code looks like.
 * If this runs without errors, backward compatibility is confirmed.
 * 
 * This is a copy of the original examples/demo.js that shipped with v1.0.0.
 */

const CacheShuttle = require('./lib/index.js');

// Mock data store instances representing separate structural environments
const mockInProcessMemoryStore = new Map();
const mockRemoteRedisServer = new Map();

// --- 1. Craft structural interface adapters for input endpoints ---
const memoryStoreAdapter = {
  getKeys: async () => Array.from(mockInProcessMemoryStore.keys()),
  get: async (key) => mockInProcessMemoryStore.get(key),
  set: async (key, value) => { mockInProcessMemoryStore.set(key, value); }
};

const upstreamDatabaseAdapter = {
  get: async (key) => {
    const lookupString = mockRemoteRedisServer.get(key);
    return lookupString ? JSON.parse(lookupString) : null;
  },
  set: async (key, value) => {
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    mockRemoteRedisServer.set(key, serializedValue);
  }
};

// --- 2. Instantiate and run your engine safely ---
// THIS IS THE EXACT v1.0.0 CONSTRUCTOR — no new options, no changes
async function runValidationAudit() {
  console.log("⚡ Initiating Local Cache Shuttle Pipeline (v1.0.0 code)...\n");

  const shuttleInstance = new CacheShuttle({
    source: memoryStoreAdapter,
    target: upstreamDatabaseAdapter,
    batchSize: 50
  });

  // Hydrate fake origin values
  mockInProcessMemoryStore.set("session_user_01", { identity: "Alice", active: true });
  mockInProcessMemoryStore.set("session_user_02", { identity: "Bob", active: false });

  // Execute operational flight checklist — THE EXACT v1.0.0 transferAll() CALL
  const auditReport = await shuttleInstance.transferAll();

  console.log("🏁 Operational Lifecycle Completed successfully.");
  console.log("Summary Metrics:", auditReport);

  // --- VERIFY RESULTS ---
  let allPassed = true;

  // Check transferAll report
  if (auditReport.success !== true) { console.error("❌ FAIL: success should be true"); allPassed = false; }
  if (auditReport.totalKeysFound !== 2) { console.error("❌ FAIL: totalKeysFound should be 2"); allPassed = false; }
  if (auditReport.moved !== 2) { console.error("❌ FAIL: moved should be 2"); allPassed = false; }
  if (auditReport.failed !== 0) { console.error("❌ FAIL: failed should be 0"); allPassed = false; }

  // Check data actually arrived in target
  const aliceRaw = mockRemoteRedisServer.get("session_user_01");
  const alice = JSON.parse(aliceRaw);
  if (alice.identity !== "Alice") { console.error("❌ FAIL: Alice not found in target"); allPassed = false; }

  const bobRaw = mockRemoteRedisServer.get("session_user_02");
  const bob = JSON.parse(bobRaw);
  if (bob.identity !== "Bob") { console.error("❌ FAIL: Bob not found in target"); allPassed = false; }

  // Check dual-write via set()
  await shuttleInstance.set("new_key", { identity: "Charlie" });
  const charlieInSource = mockInProcessMemoryStore.get("new_key");
  const charlieInTarget = JSON.parse(mockRemoteRedisServer.get("new_key"));
  if (charlieInSource?.identity !== "Charlie") { console.error("❌ FAIL: Charlie not in source after set()"); allPassed = false; }
  if (charlieInTarget?.identity !== "Charlie") { console.error("❌ FAIL: Charlie not in target after set()"); allPassed = false; }

  // Check read-through via get()
  mockInProcessMemoryStore.delete("new_key"); // remove from source to test fallback
  const readThrough = await shuttleInstance.get("new_key");
  if (readThrough?.identity !== "Charlie") { console.error("❌ FAIL: Read-through from target failed"); allPassed = false; }

  // Final result
  console.log("");
  if (allPassed) {
    console.log("✅ ALL v1.0.0 BACKWARD COMPATIBILITY CHECKS PASSED");
    console.log("   Old code works perfectly with the new version. Nothing is broken.");
  } else {
    console.error("❌ SOME CHECKS FAILED — backward compatibility is broken!");
    process.exit(1);
  }

  shuttleInstance.destroy();
}

runValidationAudit();
