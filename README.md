# Cache Shuttle 🚀

A production-grade, zero-dependency caching toolkit for Node.js — featuring a blazing-fast in-memory cache with TTL, automatic background cleanup, and a powerful bridge mode to dual-write, read-through, and migrate data across storage providers without downtime.

https://medium.com/@kishangaiwala487/introducing-js-cache-shuttle-a-lightweight-fast-in-memory-cache-for-node-js-cfc9fd4768bc?postPublishedType=repub

## Key Features

* ⚡ **In-Memory Cache:** Lightning-fast key-value store built on native `Map` with zero dependencies.
* ⏱️ **TTL Support:** Set expiration times on any key. Expired keys are cleaned up automatically.
* 🧹 **Background Sweep:** A configurable background timer actively removes expired keys from memory — even if they're never read again. No more idle memory leaks.
* 🔒 **RAM Explosion Prevention:** Processes large migrations in adjustable, chunked batches to keep memory overhead near zero.
* 🛡️ **Anti-Crash Isolation:** Utilizes parallel non-blocking execution routines (`Promise.allSettled`) to isolate backend network drops.
* 🔄 **Read-Through & Auto-Healing:** Resolves fast local cache misses by looking up upstream nodes and auto-healing the local tier.
* 🚚 **The Shuttle (`transferAll`):** Drain and migrate entire memory trees securely with a single line of code.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CacheShuttle                             │
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐     │
│   │           In-Memory Cache (Map)                       │     │
│   │                                                       │     │
│   │   set(key, value, ttl)    TTL auto-expiration         │     │
│   │   get(key)                Passive cleanup on read     │     │
│   │   delete(key)             Background sweep timer      │     │
│   │   clear()                 destroy() for clean exit    │     │
│   │                                                       │     │
│   └───────────────────────────────────────────────────────┘     │
│                          │                                      │
│            ┌─────────────┴──────────────┐                       │
│            │   Bridge Mode (Optional)   │                       │
│            │   Activates when source    │                       │
│            │   and target are provided  │                       │
│            └─────────────┬──────────────┘                       │
│                          │                                      │
│              ┌───────────┴───────────┐                          │
│              │                       │                          │
│       ┌──────▼──────┐        ┌──────▼──────┐                   │
│       │   Source     │        │   Target    │                   │
│       │   Adapter    │        │   Adapter   │                   │
│       │ (fast cache) │        │ (database)  │                   │
│       └─────────────┘        └─────────────┘                   │
│                                                                 │
│   Dual-Write ──▶ set() writes to both adapters simultaneously  │
│   Read-Through ─▶ get() checks source, falls back to target   │
│   Migration ────▶ transferAll() batched source → target copy   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Standalone Mode** — Use CacheShuttle without any adapters for a fast in-memory cache with TTL and background cleanup.

**Bridge Mode** — Pass `source` and `target` adapters to unlock dual-write, read-through, and batch migration on top of the in-memory cache.

---

## Installation

```bash
npm install js-cache-shuttle
```

---

## Quick Start

### Standalone Mode (In-Memory Cache)

Use CacheShuttle as a simple, fast in-memory cache with TTL and automatic cleanup. No adapters needed.

```javascript
const CacheShuttle = require('js-cache-shuttle');

const cache = new CacheShuttle();

// Store a value
cache.set('user:1', { name: 'Alice', role: 'admin' });

// Store a value with a 5-second TTL (in milliseconds)
cache.set('temp_token', 'abc-xyz-123', 5000);

// Retrieve a value
const user = await cache.get('user:1');
console.log(user); // { name: 'Alice', role: 'admin' }

// After 5 seconds, the temp_token is automatically expired
const token = await cache.get('temp_token');
console.log(token); // null

// Delete a specific key
cache.delete('user:1');

// Clear all cached data
cache.clear();

// Stop background sweep and clean up (call when shutting down)
cache.destroy();
```

### Bridge Mode (Dual-Write + Migration)

If you are already using CacheShuttle v1.0.0 with `source` and `target` adapters, **your existing code continues to work exactly as before**. Bridge mode activates automatically when you provide `source` and `target` in the constructor.

```javascript
const CacheShuttle = require('js-cache-shuttle');

const shuttle = new CacheShuttle({
  source: myLocalCacheAdapter,
  target: myRemoteDatabaseAdapter,
  batchSize: 50
});

// Dual-write: saves to both source and target
await shuttle.set('session:1', { user: 'Alice' });

// Read-through: checks source first, falls back to target, auto-heals source
const data = await shuttle.get('session:1');

// Migrate all keys from source to target in safe batches
const report = await shuttle.transferAll();
console.log(report);
// { success: true, totalKeysFound: 10, moved: 10, failed: 0, errors: [] }
```

---

## Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | `Object` | `undefined` | Source cache adapter (enables bridge mode) |
| `target` | `Object` | `undefined` | Target cache adapter (enables bridge mode) |
| `batchSize` | `number` | `100` | Number of keys processed per batch during `transferAll()` |
| `sweepInterval` | `number` | `60000` | How often (in ms) the background sweep checks for expired keys |
| `enableBackgroundSweep` | `boolean` | `true` | Set to `false` to disable the automatic background cleanup |

---

## API Reference

### `set(key, value, ttl)`
Store a key-value pair. Optionally set a TTL (time-to-live) in milliseconds.
- In **standalone mode**: stores in the internal in-memory cache.
- In **bridge mode**: also dual-writes to both `source` and `target` adapters.

### `get(key)`
Retrieve a value by key. Returns `null` if the key doesn't exist or has expired.
- In **standalone mode**: reads from the in-memory cache with passive expiration check.
- In **bridge mode**: also falls back to `source`, then `target` adapter with auto-healing.

### `delete(key)`
Remove a specific key from the in-memory cache. Returns `true` if the key existed.

### `clear()`
Remove all keys from the in-memory cache.

### `transferAll()`
*(Bridge mode only)* Migrate all keys from `source` to `target` in safe, chunked batches. Returns an audit report object.

### `destroy()`
Stop the background sweep timer. Call this when shutting down your application to ensure a clean exit.

---

## Upgrading from v1.0.0 to v1.1.0

### Nothing breaks. Your existing code works as-is.

If you are using CacheShuttle v1.0.0 with `source` and `target` adapters, **no changes are required**. The bridge mode API (`set`, `get`, `transferAll`) works exactly the same way.

### What's new for existing users

You now get **free in-memory caching with TTL and background sweep** on top of your existing bridge setup. Here's how to use the new features in your existing code:

**Before (v1.0.0):**
```javascript
const shuttle = new CacheShuttle({
  source: mySourceAdapter,
  target: myTargetAdapter,
  batchSize: 50
});
```

**After (v1.1.0) — add background sweep options if you want:**
```javascript
const shuttle = new CacheShuttle({
  source: mySourceAdapter,
  target: myTargetAdapter,
  batchSize: 50,
  sweepInterval: 30000,          // sweep every 30 seconds (optional)
  enableBackgroundSweep: true     // enabled by default (optional)
});

// New: use delete() and clear() for manual cache management
shuttle.delete('stale-key');
shuttle.clear();

// New: call destroy() on shutdown for clean exit
shuttle.destroy();
```

### Or use it as a standalone in-memory cache (no adapters needed)

```javascript
const cache = new CacheShuttle();

cache.set('key', 'value', 10000); // expires in 10 seconds
const val = await cache.get('key');
```

---

## Changelog

### v1.1.0
- **New:** Built-in in-memory cache with TTL (time-to-live) support.
- **New:** Background sweep timer that actively removes expired keys from memory, preventing idle memory leaks for keys that are never read again.
- **New:** `delete(key)` method to manually remove a single key.
- **New:** `clear()` method to remove all cached data.
- **New:** `destroy()` method to stop the background sweep timer for clean shutdowns.
- **New:** Standalone mode — use CacheShuttle as a simple in-memory cache without any adapters.
- **Improved:** `set()` and `get()` now also store/check the in-memory cache alongside bridge adapters.
- **No breaking changes.** All v1.0.0 bridge mode code works without modification.

### v1.0.0
- Initial release with dual-write, read-through, and batch migration (`transferAll`).

---

## License

[MIT](./LICENSE)
