# Cache Shuttle 🚀

A production-grade, fault-tolerant bridging framework to seamlessly dual-write, read-through, and migrate data across conflicting storage caching tiers without server downtime.

Unlike standard multi-caching tools, **Cache Shuttle** focuses specifically on structural migration mechanics, giving you safe, chunked data synchronization utilities to transfer live data from one provider to another seamlessly.

## Key Features

* 🔒 **RAM Explosion Prevention:** Processes large migrations in adjustable, chunked batches to keep memory overhead near zero.
* 🛡️ **Anti-Crash Isolation:** Utilizes parallel non-blocking execution routines (`Promise.allSettled`) to isolate backend network drops.
* 🔄 **Read-Through & Auto-Healing:** Resolves fast local cache misses by looking up upstream nodes and auto-healing the local tier.
* 🚚 **The Shuttle (`transferAll`):** Drain and migrate entire memory trees securely with a single line of code.

---

## Installation

```bash
npm install cache-shuttle