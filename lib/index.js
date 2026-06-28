/**
 * CacheShuttle
 * A production-grade framework to securely dual-write, read-through, and migrate 
 * data across different caching layers smoothly without server downtime.
 * 
 * Now includes built-in in-memory caching with TTL support and background sweep
 * to prevent idle memory leaks from expired keys that are never read again.
 */
class CacheShuttle {
    /**
     * @param {Object} options
     * @param {Object} [options.source] - The primary/fast caching tier adapter.
     * @param {Object} [options.target] - The secondary/persistent caching tier adapter.
     * @param {number} [options.batchSize=100] - Chunks processed per cycle to prevent memory overloads.
     * @param {number} [options.sweepInterval=60000] - How often to clear expired keys in milliseconds (default: 1 minute)
     * @param {boolean} [options.enableBackgroundSweep=true] - Set to false to disable background cleanup loop
     */
    constructor(options = {}) {
        // In-memory cache store with TTL and background sweep support
        this.cache = new Map();

        // Background sweep configuration
        this.enableBackgroundSweep = options.enableBackgroundSweep !== false;
        this.sweepInterval = options.sweepInterval || 60000;

        if (this.enableBackgroundSweep) {
            this.startBackgroundSweep();
        }

        // Bridge mode: if source and target adapters are provided, enable dual-write/migration
        if (options.source && options.target) {
            this._bridgeMode = true;
            this._validateAdapters(options.source, options.target);
            this.source = options.source;
            this.target = options.target;
            this.batchSize = Math.max(1, parseInt(options.batchSize, 10) || 100);
        } else {
            this._bridgeMode = false;
        }
    }

    /**
     * Defensive Validation Checklist
     * Throws explicit errors instantly on startup if the user misconfigures adapters.
     * @private
     */
    _validateAdapters(source, target) {
        if (!source || !target) {
            throw new Error("CacheShuttle Core Error: Provide valid 'source' and 'target' configuration blocks.");
        }

        const requiredSourceMethods = ['get', 'set', 'getKeys'];
        for (const method of requiredSourceMethods) {
            if (typeof source[method] !== 'function') {
                throw new Error(`CacheShuttle Core Error: Source adapter is missing structural "${method}()" hook.`);
            }
        }

        if (typeof target.set !== 'function') {
            throw new Error('CacheShuttle Core Error: Target adapter lacks standard "set()" entry point.');
        }
    }

    // =========================================================================
    // IN-MEMORY CACHE METHODS (with TTL + passive/active expiration)
    // =========================================================================

    /**
     * Store an item in the in-memory cache with optional TTL.
     * If bridge mode is active, also dual-writes to source and target adapters.
     * @param {string} key
     * @param {*} value
     * @param {number} [ttl] - Time to live in milliseconds (for in-memory cache), or seconds (for bridge adapters)
     */
    async set(key, value, ttl) {
        if (key === undefined || key === null) return false;

        // Always store in local in-memory cache
        const expiresAt = ttl ? Date.now() + ttl : null;
        this.cache.set(key, { value, expiresAt });

        // If bridge mode is active, also dual-write to both adapters
        if (this._bridgeMode) {
            const results = await Promise.allSettled([
                this.source.set(key, value, ttl),
                this.target.set(key, value, ttl)
            ]);

            const sourceOk = results[0].status === 'fulfilled';
            const targetOk = results[1].status === 'fulfilled';

            if (!sourceOk) console.warn(`[CacheShuttle] Safe Warning: Outbound local write dropped for key "${key}".`);
            if (!targetOk) console.warn(`[CacheShuttle] Safe Warning: Outbound upstream write dropped for key "${key}".`);

            return sourceOk || targetOk;
        }

        return true;
    }

    /**
     * Retrieve an item. Checks in-memory cache first (with passive expiration).
     * In bridge mode, falls back to source adapter, then target adapter with self-healing.
     * @param {string} key
     * @param {number} [ttl] - TTL for self-healing back-fill (bridge mode only)
     */
    async get(key, ttl) {
        if (key === undefined || key === null) return null;

        // Step 1: Check in-memory cache with passive expiration
        const entry = this.cache.get(key);
        if (entry) {
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                this.cache.delete(key);
            } else {
                return entry.value;
            }
        }

        // Step 2: If bridge mode, try source and target adapters
        if (this._bridgeMode) {
            try {
                // Read from source adapter
                const cachedValue = await this.source.get(key);
                if (cachedValue !== undefined && cachedValue !== null) {
                    return cachedValue;
                }

                // Read from target adapter with self-healing
                if (typeof this.target.get === 'function') {
                    const storedValue = await this.target.get(key);

                    if (storedValue !== undefined && storedValue !== null) {
                        // Asynchronously heal source node to optimize downstream loops
                        this.source.set(key, storedValue, ttl).catch(err => {
                            console.error(`[CacheShuttle] Failed healing back-fill for "${key}":`, err.message);
                        });
                        return storedValue;
                    }
                }
            } catch (error) {
                console.error(`[CacheShuttle] Read Exception encountered on "${key}":`, error.message);
            }
        }

        return null;
    }

    /**
     * Delete an item from the in-memory cache
     * @param {string} key
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Clear all items from the in-memory cache
     */
    clear() {
        this.cache.clear();
    }

    // =========================================================================
    // BRIDGE MODE: BATCH MIGRATION
    // =========================================================================

    /**
     * Strategy: The Shuttle (Safely Batched High-Speed Core Migration)
     * Converts and drains memory trees into production databases safely using segmented loops.
     * Only available in bridge mode (when source and target adapters are provided).
     */
    async transferAll() {
        if (!this._bridgeMode) {
            throw new Error("CacheShuttle: transferAll() requires 'source' and 'target' adapters to be configured.");
        }

        const auditLog = {
            success: true,
            totalKeysFound: 0,
            moved: 0,
            failed: 0,
            errors: []
        };

        try {
            const keys = await this.source.getKeys();
            if (!Array.isArray(keys) || keys.length === 0) {
                return auditLog;
            }

            auditLog.totalKeysFound = keys.length;

            // Safe memory slicing loops: moves batchSize records at a time
            for (let i = 0; i < keys.length; i += this.batchSize) {
                const chunk = keys.slice(i, i + this.batchSize);

                await Promise.all(chunk.map(async (key) => {
                    try {
                        const rawData = await this.source.get(key);

                        if (rawData !== undefined && rawData !== null) {
                            await this.target.set(key, rawData);
                            auditLog.moved++;
                        } else {
                            auditLog.failed++;
                            auditLog.errors.push({ key, explanation: "Empty value detected inside origin engine." });
                        }
                    } catch (chunkError) {
                        auditLog.failed++;
                        auditLog.errors.push({ key, explanation: chunkError.message });
                    }
                }));
            }

            return auditLog;
        } catch (fatalCrash) {
            return {
                success: false,
                error: `Critical lifecycle break: ${fatalCrash.message}`,
                totalKeysFound: auditLog.totalKeysFound,
                moved: auditLog.moved,
                failed: auditLog.failed,
                errors: auditLog.errors
            };
        }
    }

    // =========================================================================
    // BACKGROUND SWEEP (Addresses idle memory leak concern)
    // =========================================================================

    /**
     * Invisible background sweeper to prevent idle memory leaks.
     * Periodically scans and removes expired keys that are never read again.
     * @private
     */
    startBackgroundSweep() {
        if (typeof setInterval !== 'undefined') {
            this.sweeper = setInterval(() => {
                const now = Date.now();
                for (const [key, entry] of this.cache.entries()) {
                    if (entry.expiresAt && now > entry.expiresAt) {
                        this.cache.delete(key);
                    }
                }
            }, this.sweepInterval);

            // CRITICAL FOR NODE.JS: Prevents the timer from hanging scripts or test suites open
            if (this.sweeper && typeof this.sweeper.unref === 'function') {
                this.sweeper.unref();
            }
        }
    }

    /**
     * Stop the background sweeper manually (good for clean shutdowns)
     */
    destroy() {
        if (this.sweeper) {
            clearInterval(this.sweeper);
        }
    }
}

// Export for CommonJS compatibility
module.exports = CacheShuttle;