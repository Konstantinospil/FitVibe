import { createHash } from "node:crypto";
import { HttpError } from "../../utils/http.js";
import { isCommonPassword } from "./common-passwords.blocklist.js";

// #557: server-only HIBP k-anonymity; SHA-1 is NOT used for password storage.
const MAX_RESPONSE_BYTES = 256 * 1024;
const PREFIX_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PREFIXES = 128;
const TIMEOUT_MS = 2500;
const CIRCUIT_MS = 30_000;
const FAILURE_THRESHOLD = 3;
const SUFFIX_RE = /^([A-F0-9]{35}):([0-9]+)$/;
type Fetcher = typeof fetch;
type Entry = { suffixCounts: Map<string, number>; expiresAt: number };

export class BreachedPasswordChecker {
  private readonly cache = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<Entry>>();
  private failures = 0;
  private circuitUntil = 0;

  constructor(
    private readonly transport: Fetcher = fetch,
    private readonly clock: () => number = Date.now,
  ) {}

  private unavailable(): HttpError {
    return new HttpError(503, "BREACH_CHECK_UNAVAILABLE", "BREACH_CHECK_UNAVAILABLE");
  }

  private remember(prefix: string, entry: Entry): void {
    this.cache.delete(prefix);
    this.cache.set(prefix, entry);
    while (this.cache.size > MAX_PREFIXES) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  private parse(response: string): Map<string, number> {
    if (Buffer.byteLength(response, "utf8") > MAX_RESPONSE_BYTES) throw this.unavailable();
    const lines = response.trim().split(/\r?\n/);
    if (lines.length < 2) throw this.unavailable();
    const result = new Map<string, number>();
    for (const line of lines) {
      const match = SUFFIX_RE.exec(line);
      if (!match || result.has(match[1])) throw this.unavailable();
      const count = Number(match[2]);
      if (!Number.isSafeInteger(count)) throw this.unavailable();
      result.set(match[1], count);
    }
    return result;
  }

  private async load(prefix: string): Promise<Entry> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const response = await this.transport(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          method: "GET",
          headers: { "Add-Padding": "true", "User-Agent": "FitVibe-Backend/2.1" },
          signal: abort.signal,
          redirect: "error",
        },
      );
      if (!response.ok || response.status !== 200) throw this.unavailable();
      const length = response.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
        throw this.unavailable();
      }
      if (!response.body) throw this.unavailable();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) throw this.unavailable();
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const suffixCounts = this.parse(Buffer.concat(chunks).toString("utf8"));
      const entry = { suffixCounts, expiresAt: this.clock() + PREFIX_TTL_MS };
      this.remember(prefix, entry);
      this.failures = 0;
      this.circuitUntil = 0;
      return entry;
    } catch {
      this.failures += 1;
      if (this.failures >= FAILURE_THRESHOLD) this.circuitUntil = this.clock() + CIRCUIT_MS;
      throw this.unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  async assertAcceptable(password: string): Promise<void> {
    if (isCommonPassword(password)) {
      throw new HttpError(400, "PASSWORD_COMMON", "PASSWORD_COMMON");
    }
    const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5);
    const cached = this.cache.get(prefix);
    let entry: Entry;
    if (cached && cached.expiresAt > this.clock()) {
      this.remember(prefix, cached);
      entry = cached;
    } else {
      if (this.clock() < this.circuitUntil) throw this.unavailable();
      let inFlight = this.pending.get(prefix);
      if (!inFlight) {
        inFlight = this.load(prefix);
        this.pending.set(prefix, inFlight);
        void inFlight.finally(() => {
          this.pending.delete(prefix);
        }).catch(() => undefined);
      }
      entry = await inFlight;
    }
    if ((entry.suffixCounts.get(suffix) ?? 0) > 0) {
      throw new HttpError(400, "PASSWORD_BREACHED", "PASSWORD_BREACHED");
    }
  }
}

export const breachedPasswordChecker = new BreachedPasswordChecker();
