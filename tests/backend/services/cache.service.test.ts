import { CacheService } from "../../../apps/backend/src/services/cache.service.js";
import type Redis from "ioredis";
import { env } from "../../../apps/backend/src/config/env.js";

// Mock Redis
const mockRedisInstance = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  setex: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  flushdb: jest.fn().mockResolvedValue("OK"),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue("OK"),
  on: jest.fn(),
  status: "ready" as const,
};

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

// Mock logger
jest.mock("../../../apps/backend/src/config/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from "../../../apps/backend/src/config/logger.js";

const mockLogger = jest.mocked(logger);

describe("Cache Service", () => {
  let cacheService: CacheService;
  const redisConfig = env.redis as {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  const originalRedisConfig = { ...redisConfig };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(redisConfig, originalRedisConfig);
    // Reset Redis mock
    mockRedisInstance.get.mockResolvedValue(null);
    mockRedisInstance.set.mockResolvedValue("OK");
    mockRedisInstance.setex.mockResolvedValue("OK");
    mockRedisInstance.del.mockResolvedValue(1);
    mockRedisInstance.flushdb.mockResolvedValue("OK");
    mockRedisInstance.connect.mockResolvedValue(undefined);
    mockRedisInstance.quit.mockResolvedValue("OK");
    mockRedisInstance.on.mockImplementation((event: string, handler: () => void) => {
      if (event === "connect") {
        // Simulate connect event
        setTimeout(() => handler(), 0);
      }
    });
    mockRedisInstance.status = "ready";
  });

  afterEach(() => {
    Object.assign(redisConfig, originalRedisConfig);
    if (cacheService) {
      cacheService.close().catch(() => {
        // Ignore errors during cleanup
      });
    }
  });

  describe("In-Memory Cache (Redis disabled)", () => {
    beforeEach(() => {
      redisConfig.enabled = false;
      cacheService = new CacheService();
    });

    describe("get", () => {
      it("should get value from in-memory cache", async () => {
        const key = "test-key";
        const value = { data: "test" };

        await cacheService.set(key, value);
        const result = await cacheService.get(key);

        expect(result).toEqual(value);
      });

      it("should return undefined for non-existent key", async () => {
        const result = await cacheService.get("non-existent");

        expect(result).toBeUndefined();
      });

      it("should return undefined for expired TTL entry", async () => {
        const key = "expired-key";
        const value = { data: "test" };

        await cacheService.set(key, value, 0.001); // 1ms TTL
        await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for expiration
        const result = await cacheService.get(key);

        expect(result).toBeUndefined();
      });
    });

    describe("set", () => {
      it("should set value in cache", async () => {
        const key = "test-key";
        const value = { data: "test" };

        await cacheService.set(key, value);
        const result = await cacheService.get(key);

        expect(result).toEqual(value);
      });

      it("should set value with TTL", async () => {
        const key = "test-key-ttl";
        const value = { data: "test" };

        await cacheService.set(key, value, 60);
        const result = await cacheService.get(key);

        expect(result).toEqual(value);
      });

      it("should set value without TTL", async () => {
        const key = "test-key-no-ttl";
        const value = { data: "test" };

        await cacheService.set(key, value);
        const result = await cacheService.get(key);

        expect(result).toEqual(value);
      });
    });

    describe("delete", () => {
      it("should delete value from cache", async () => {
        const key = "test-key";
        const value = { data: "test" };

        await cacheService.set(key, value);
        await cacheService.delete(key);
        const result = await cacheService.get(key);

        expect(result).toBeUndefined();
      });
    });

    describe("clear", () => {
      it("should clear all cache", async () => {
        await cacheService.set("key1", "value1");
        await cacheService.set("key2", "value2");

        await cacheService.clear();

        expect(await cacheService.get("key1")).toBeUndefined();
        expect(await cacheService.get("key2")).toBeUndefined();
      });
    });

    describe("isRedisAvailable", () => {
      it("should return false when Redis is disabled", () => {
        expect(cacheService.isRedisAvailable()).toBe(false);
      });
    });

    describe("close", () => {
      it("should not throw when closing without Redis", async () => {
        await expect(cacheService.close()).resolves.toBeUndefined();
      });
    });
  });

  describe("Redis Cache (Redis enabled)", () => {
    beforeEach(() => {
      redisConfig.enabled = true;
      redisConfig.host = "localhost";
      redisConfig.port = 6379;
      cacheService = new CacheService();
    });

    describe("get", () => {
      it("should get value from Redis", async () => {
        const key = "test-key";
        const value = { data: "test" };
        mockRedisInstance.get.mockResolvedValue(JSON.stringify(value));

        const result = await cacheService.get(key);

        expect(result).toEqual(value);
        expect(mockRedisInstance.get).toHaveBeenCalledWith(key);
      });

      it("should return undefined when Redis returns null", async () => {
        mockRedisInstance.get.mockResolvedValue(null);

        const result = await cacheService.get("non-existent");

        expect(result).toBeUndefined();
      });

      it("should fallback to in-memory when Redis get fails", async () => {
        const key = "test-key";
        const value = { data: "test" };
        // Set will fail, so it stores in memory
        mockRedisInstance.set.mockRejectedValueOnce(new Error("Redis error"));
        // Get will also fail, so it falls back to memory
        mockRedisInstance.get.mockRejectedValueOnce(new Error("Redis error"));

        await cacheService.set(key, value);

        const result = await cacheService.get(key);

        expect(result).toEqual(value);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe("set", () => {
      it("should set value in Redis", async () => {
        const key = "test-key";
        const value = { data: "test" };

        await cacheService.set(key, value);

        expect(mockRedisInstance.set).toHaveBeenCalledWith(key, JSON.stringify(value));
      });

      it("should set value in Redis with TTL", async () => {
        const key = "test-key-ttl";
        const value = { data: "test" };

        await cacheService.set(key, value, 60);

        expect(mockRedisInstance.setex).toHaveBeenCalledWith(key, 60, JSON.stringify(value));
      });

      it("should fallback to in-memory when Redis set fails", async () => {
        const key = "test-key";
        const value = { data: "test" };
        mockRedisInstance.set.mockRejectedValueOnce(new Error("Redis error"));
        // Get will also fail to trigger fallback
        mockRedisInstance.get.mockRejectedValueOnce(new Error("Redis error"));

        await cacheService.set(key, value);

        const result = await cacheService.get(key);
        expect(result).toEqual(value);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it("should fallback to in-memory when Redis setex fails", async () => {
        const key = "test-key-ttl";
        const value = { data: "test" };
        mockRedisInstance.setex.mockRejectedValueOnce(new Error("Redis error"));
        // Get will also fail to trigger fallback
        mockRedisInstance.get.mockRejectedValueOnce(new Error("Redis error"));

        await cacheService.set(key, value, 60);

        const result = await cacheService.get(key);
        expect(result).toEqual(value);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe("delete", () => {
      it("should delete value from Redis", async () => {
        const key = "test-key";

        await cacheService.delete(key);

        expect(mockRedisInstance.del).toHaveBeenCalledWith(key);
      });

      it("should fallback to in-memory when Redis delete fails", async () => {
        const key = "test-key";
        mockRedisInstance.del.mockRejectedValue(new Error("Redis error"));

        await cacheService.delete(key);

        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe("clear", () => {
      it("should clear Redis cache", async () => {
        await cacheService.clear();

        expect(mockRedisInstance.flushdb).toHaveBeenCalled();
      });

      it("should fallback to in-memory when Redis clear fails", async () => {
        mockRedisInstance.flushdb.mockRejectedValue(new Error("Redis error"));

        await cacheService.clear();

        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe("isRedisAvailable", () => {
      it("should return true when Redis is ready", () => {
        mockRedisInstance.status = "ready";
        expect(cacheService.isRedisAvailable()).toBe(true);
      });

      it("should return false when Redis is not ready", () => {
        mockRedisInstance.status = "end" as const;
        expect(cacheService.isRedisAvailable()).toBe(false);
      });
    });

    describe("close", () => {
      it("should close Redis connection", async () => {
        await cacheService.close();

        expect(mockRedisInstance.quit).toHaveBeenCalled();
      });
    });
  });

  describe("Redis connection events", () => {
    it("should handle Redis error event and fallback to in-memory", () => {
      redisConfig.enabled = true;
      const errorHandler = jest.fn();
      mockRedisInstance.on.mockImplementation((event: string, handler: () => void) => {
        if (event === "error") {
          errorHandler(handler);
        }
      });

      cacheService = new CacheService();

      // Simulate error event
      const errorCallbacks = mockRedisInstance.on.mock.calls
        .filter((call) => call[0] === "error")
        .map((call) => call[1]);
      if (errorCallbacks.length > 0) {
        errorCallbacks[0](new Error("Connection error"));
      }

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should handle Redis connect event", () => {
      redisConfig.enabled = true;
      const connectHandler = jest.fn();
      mockRedisInstance.on.mockImplementation((event: string, handler: () => void) => {
        if (event === "connect") {
          connectHandler(handler);
        }
      });

      cacheService = new CacheService();

      // Simulate connect event
      const connectCallbacks = mockRedisInstance.on.mock.calls
        .filter((call) => call[0] === "connect")
        .map((call) => call[1]);
      if (connectCallbacks.length > 0) {
        connectCallbacks[0]();
      }

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe("Redis initialization errors", () => {
    it("should fallback to in-memory when Redis constructor throws", () => {
      redisConfig.enabled = true;
      const RedisMock = jest.requireMock("ioredis");
      RedisMock.mockImplementationOnce(() => {
        throw new Error("Redis init error");
      });

      cacheService = new CacheService();

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should fallback to in-memory when Redis connect fails", async () => {
      redisConfig.enabled = true;
      mockRedisInstance.connect.mockRejectedValue(new Error("Connection failed"));

      cacheService = new CacheService();
      // Wait for async connect
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
