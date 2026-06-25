/**
 * CacheShuttle
 * A production-grade framework to securely dual-write, read-through, and migrate 
 * data across different caching layers smoothly without server downtime.
 */
class CacheShuttle {
    /**
     * @param {Object} options
     * @param {Object} options.source - The primary/fast caching tier adapter.
     * @param {Object} options.target - The secondary/persistent caching tier adapter.
     * @param {number} [options.batchSize=100] - Chunks processed per cycle to prevent memory overloads.
     */
    constructor(options = {}) {
        this._validateAdapters(options.source, options.target);

        this.source = options.source;
        this.target = options.target;
        this.batchSize = Math.max(1, parseInt(options.batchSize, 10) || 100);
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

    /**
     * Strategy: Dual-Write
     * Executes background updates on both stores in parallel. Fully isolated to bypass system-wide breaks.
     */
    async set(key, value, ttlInSeconds = null) {
        if (key === undefined || key === null) return false;

        const results = await Promise.allSettled([
            this.source.set(key, value, ttlInSeconds),
            this.target.set(key, value, ttlInSeconds)
        ]);

        const sourceOk = results[0].status === 'fulfilled';
        const targetOk = results[1].status === 'fulfilled';

        if (!sourceOk) console.warn(`[CacheShuttle] Safe Warning: Outbound local write dropped for key "${key}".`);
        if (!targetOk) console.warn(`[CacheShuttle] Safe Warning: Outbound upstream write dropped for key "${key}".`);

        return sourceOk || targetOk;
    }

    /**
     * Strategy: Read-Through + Self-Healing
     * Returns data immediately on a fast cache hit. Resolves cache misses by pulling from target and refreshing source.
     */
    async get(key, ttlInSeconds = null) {
        if (key === undefined || key === null) return null;

        try {
            // Step A: Read local fast engine
            const cachedValue = await this.source.get(key);
            if (cachedValue !== undefined && cachedValue !== null) {
                return cachedValue;
            }

            // Step B: Search primary storage network layer
            if (typeof this.target.get === 'function') {
                const storedValue = await this.target.get(key);

                if (storedValue !== undefined && storedValue !== null) {
                    // Asynchronously heal source node to optimize downstream loops
                    this.source.set(key, storedValue, ttlInSeconds).catch(err => {
                        console.error(`[CacheShuttle] Failed healing back-fill for "${key}":`, err.message);
                    });
                    return storedValue;
                }
            }
        } catch (error) {
            console.error(`[CacheShuttle] Read Exception encountered on "${key}":`, error.message);
        }

        return null;
    }

    /**
     * Strategy: The Shuttle (Safely Batched High-Speed Core Migration)
     * Converts and drains memory trees into production databases safely using segmented loops.
     */
    async transferAll() {
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
}

module.exports = CacheShuttle;