// Local import mock setup
const CacheShuttle = require('../lib/index.js');

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
    // Structural safety step: Converts complex objects into safe network transmission strings
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    mockRemoteRedisServer.set(key, serializedValue);
  }
};

// --- 2. Instantiate and run your engine safely ---
async function runValidationAudit() {
  console.log("⚡ Initiating Local Cache Shuttle Pipeline...");

  const shuttleInstance = new CacheShuttle({
    source: memoryStoreAdapter,
    target: upstreamDatabaseAdapter,
    batchSize: 50
  });

  // Hydrate fake origin values
  mockInProcessMemoryStore.set("session_user_01", { identity: "Alice", active: true });
  mockInProcessMemoryStore.set("session_user_02", { identity: "Bob", active: false });

  // Execute operational flight checklist
  const auditReport = await shuttleInstance.transferAll();

  console.log("\n🏁 Operational Lifecycle Completed successfully.");
  console.log("Summary Metrics:", auditReport);
}

runValidationAudit();