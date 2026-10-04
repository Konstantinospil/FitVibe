import Redis from "ioredis";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

/**
 * Cache service with Redis support and in-memory fallback
 * Supports TTL (time-to-live) for cache entries
 * Falls back to in-memory Map if Redis is unavailable
 */
export class CacheService {
  private redis: Redis | null = null;
  private store = new Map<string, { value: unknown; expiresAt?: number }>();
  private useRedis: boolean;

  constructor() {
    this.useRedis = env.redis.enabled;
    if (this.useRedis) {
      try {
        this.redis = new Redis({
          host: env.redis.host,
          port: env.redis.port,
          password: env.redis.password,
          db: env.redis.db,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });

        this.redis.on("error", (error: Error) => {
          logger.warn(
            { error: error.message },
            "[Cache] Redis connection error, falling back to in-memory",
          );
          this.useRedis = false;
        });

        this.redis.on("connect", () => {
          logger.info("[Cache] Redis connected successfully");
        });

        // Attempt to connect (non-blocking)
        this.redis.connect().catch((error: unknown) => {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            "[Cache] Redis connection failed, using in-memory cache",
          );
          this.useRedis = false;
        });
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "[Cache] Redis initialization failed, using in-memory cache",
        );
        this.useRedis = false;
      }
    }
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (this.useRedis && this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value === null) {
          return undefined;
        }
        return JSON.parse(value) as T;
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), key },
          "[Cache] Redis get failed, falling back to in-memory",
        );
        // Fallback to in-memory
        return this.getFromMemory<T>(key);
      }
    }

    return this.getFromMemory<T>(key);
  }

  /**
   * Set a value in cache with optional TTL
   * @param key - Cache key
   * @param value - Value to cache (must be JSON-serializable)
   * @param ttlSeconds - Time-to-live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          await this.redis.setex(key, ttlSeconds, serialized);
        } else {
          await this.redis.set(key, serialized);
        }
        return;
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), key },
          "[Cache] Redis set failed, falling back to in-memory",
        );
        // Fallback to in-memory
        this.setInMemory(key, value, ttlSeconds);
        return;
      }
    }

    this.setInMemory(key, value, ttlSeconds);
  }

  /**
   * Delete a value from cache
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), key },
          "[Cache] Redis delete failed, falling back to in-memory",
        );
        // Fallback to in-memory
        this.store.delete(key);
        return;
      }
    }

    this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.flushdb();
        return;
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "[Cache] Redis clear failed, falling back to in-memory",
        );
        // Fallback to in-memory
        this.store.clear();
        return;
      }
    }

    this.store.clear();
  }

  /**
   * Get value from in-memory cache
   */
  private getFromMemory<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set value in in-memory cache
   */
  private setInMemory<T>(key: string, value: T, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Close Redis connection (call on application shutdown)
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.useRedis && this.redis !== null && this.redis.status === "ready";
  }
}

// Export singleton instance
export const cacheService = new CacheService();
