const CacheShuttle = require('../lib/index.js');

async function runDemo() {
  console.log("⚡ Initiating In-Memory Cache Shuttle Demo...\n");

  // Initialize CacheShuttle with a 1-second background sweep interval
  const cache = new CacheShuttle({
    sweepInterval: 1000,
    enableBackgroundSweep: true
  });

  // 1. Store basic data
  console.log("✏️ Setting basic keys...");
  cache.set('user:session:1', { name: 'Alice', role: 'admin' });
  cache.set('user:session:2', { name: 'Bob', role: 'user' });

  console.log("🔍 Fetching keys:");
  console.log("  user:session:1 ->", cache.get('user:session:1'));
  console.log("  user:session:2 ->", cache.get('user:session:2'));

  // 2. Store data with a Time-To-Live (TTL) of 500ms
  console.log("\n⏳ Setting key 'temp_token' with a 500ms TTL...");
  cache.set('temp_token', 'xyz-abc-123', 500);

  // Retrieve immediately
  console.log("  Immediate fetch ->", cache.get('temp_token')); // should be "xyz-abc-123"

  // Wait 600ms and retrieve again (passive expiration check)
  console.log("  Waiting 600ms...");
  await new Promise(resolve => setTimeout(resolve, 600));
  console.log("  Fetch after wait ->", cache.get('temp_token')); // should be null

  // 3. Demonstrate active background sweeping
  console.log("\n🧹 Demonstrating background sweep...");
  cache.set('sweep_target', 'expiring-data', 200); // expires in 200ms
  
  // Verify it exists in map
  console.log("  Is in Map initially?", cache.cache.has('sweep_target'));

  // Wait 1.2s (long enough for the 1s background sweep interval to run)
  console.log("  Waiting 1.2 seconds for background sweep to run...");
  await new Promise(resolve => setTimeout(resolve, 1200));

  // The key should have been actively deleted by the background sweeper
  console.log("  Is in Map after sweep?", cache.cache.has('sweep_target')); // should be false

  // Clean shutdown
  cache.destroy();
  console.log("\n🏁 Demo completed successfully.");
}

runDemo();