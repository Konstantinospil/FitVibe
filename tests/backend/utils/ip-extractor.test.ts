import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Request } from "express";
import {
  extractClientIp,
  extractClientIpForRateLimit,
} from "../../../apps/backend/src/utils/ip-extractor.js";
import { env } from "../../../apps/backend/src/config/env.js";

jest.mock("../../../apps/backend/src/config/env.js", () => ({
  env: {
    trustProxy: false,
    trustedProxyIps: ["192.168.1.1", "10.0.0.1"],
    NODE_ENV: "production",
    isProduction: true,
  },
}));

describe("ip-extractor", () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      socket: {
        remoteAddress: "192.168.1.1",
      },
      ip: "192.168.1.1",
      headers: {},
    };
  });

  describe("extractClientIp", () => {
    describe("when not behind trusted proxy", () => {
      beforeEach(() => {
        jest.mocked(env).trustProxy = false;
      });

      it("should return socket remote address when valid IPv4", () => {
        mockRequest.socket = { remoteAddress: "192.168.1.100" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("192.168.1.100");
      });

      it("should return socket remote address when valid IPv6", () => {
        mockRequest.socket = { remoteAddress: "2001:0db8:85a3:0000:0000:8a2e:0370:7334" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
      });

      it("should return localhost IPv6 when socket address is ::1", () => {
        mockRequest.socket = { remoteAddress: "::1" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("::1");
      });

      it("should return localhost IPv6 when socket address is ::ffff:127.0.0.1", () => {
        mockRequest.socket = { remoteAddress: "::ffff:127.0.0.1" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("::ffff:127.0.0.1");
      });

      it("should accept IPv4-mapped IPv6 addresses from Docker networking", () => {
        mockRequest.socket = { remoteAddress: "::ffff:172.18.0.1" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("::ffff:172.18.0.1");
      });

      it("should accept compressed IPv6 addresses", () => {
        mockRequest.socket = { remoteAddress: "2001:db8::1" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("2001:db8::1");
      });

      it("should fallback to req.ip when socket.remoteAddress is undefined", () => {
        mockRequest.socket = undefined;
        mockRequest.ip = "10.0.0.1";
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("10.0.0.1");
      });

      it("should return 'unknown' when IP is invalid", () => {
        mockRequest.socket = { remoteAddress: "invalid-ip" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("unknown");
      });

      it("should return 'unknown' when socket and ip are both undefined", () => {
        mockRequest.socket = undefined;
        mockRequest.ip = undefined;
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("unknown");
      });

      it("should ignore X-Forwarded-For header when not behind proxy", () => {
        mockRequest.headers = { "x-forwarded-for": "1.2.3.4" };
        mockRequest.socket = { remoteAddress: "192.168.1.1" };
        const ip = extractClientIp(mockRequest as Request);
        // Should use socket address, not X-Forwarded-For
        expect(ip).toBe("192.168.1.1");
      });
    });

    describe("when behind trusted proxy", () => {
      beforeEach(() => {
        jest.mocked(env).trustProxy = true;
      });

      it("should ignore forwarded headers from an untrusted proxy peer", () => {
        mockRequest.socket = { remoteAddress: "192.168.1.200" };
        mockRequest.headers = { "x-forwarded-for": "1.2.3.4" };

        const ip = extractClientIp(mockRequest as Request);

        expect(ip).toBe("192.168.1.200");
      });

      it("should use leftmost IP from X-Forwarded-For header", () => {
        mockRequest.headers = { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("1.2.3.4");
      });

      it("should trim whitespace from X-Forwarded-For IPs", () => {
        mockRequest.headers = { "x-forwarded-for": "  1.2.3.4  ,  5.6.7.8  " };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("1.2.3.4");
      });

      it("should validate IP format from X-Forwarded-For", () => {
        mockRequest.headers = { "x-forwarded-for": "invalid-ip, 1.2.3.4" };
        const ip = extractClientIp(mockRequest as Request);
        // Should fallback to socket address since first IP is invalid
        expect(ip).toBe("192.168.1.1");
      });

      it("should fallback to socket address when X-Forwarded-For is invalid", () => {
        mockRequest.headers = { "x-forwarded-for": "not-an-ip" };
        mockRequest.socket = { remoteAddress: "10.0.0.1" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("10.0.0.1");
      });

      it("should fallback to socket address when X-Forwarded-For is missing", () => {
        mockRequest.headers = {};
        mockRequest.socket = { remoteAddress: "10.0.0.1" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("10.0.0.1");
      });

      it("should handle X-Forwarded-For as array", () => {
        mockRequest.headers = { "x-forwarded-for": ["1.2.3.4", "5.6.7.8"] };
        // When X-Forwarded-For is an array, it should be ignored (type check fails)
        mockRequest.socket = { remoteAddress: "10.0.0.1" };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("10.0.0.1");
      });

      it("should handle IPv6 in X-Forwarded-For", () => {
        mockRequest.headers = {
          "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        };
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
      });

      it("should return 'unknown' when all sources are invalid", () => {
        mockRequest.headers = { "x-forwarded-for": "invalid" };
        mockRequest.socket = { remoteAddress: "also-invalid" };
        mockRequest.ip = "also-invalid";
        const ip = extractClientIp(mockRequest as Request);
        expect(ip).toBe("unknown");
      });
    });
  });

  describe("extractClientIpForRateLimit", () => {
    it("should return the same result as extractClientIp", () => {
      mockRequest.socket = { remoteAddress: "192.168.1.1" };
      const ip1 = extractClientIp(mockRequest as Request);
      const ip2 = extractClientIpForRateLimit(mockRequest as Request);
      expect(ip1).toBe(ip2);
    });

    it("should work with trusted proxy", () => {
      jest.mocked(env).trustProxy = true;
      mockRequest.headers = { "x-forwarded-for": "1.2.3.4" };
      const ip = extractClientIpForRateLimit(mockRequest as Request);
      expect(ip).toBe("1.2.3.4");
    });
  });
});
