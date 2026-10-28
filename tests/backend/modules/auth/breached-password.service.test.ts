import { createHash } from "node:crypto";
import { BreachedPasswordChecker } from "../../../../apps/backend/src/modules/auth/breached-password.service.js";
import { isCommonPassword } from "../../../../apps/backend/src/modules/auth/common-passwords.blocklist.js";

// Test ownership: #557, backend-jest, backend authentication security.
// No real external network calls: inject a controlled Fetcher.
const digest = (value: string) => createHash("sha1").update(value).digest("hex").toUpperCase();
const suffix = (value: string) => digest(value).slice(5);
const row = (value: string, count = 1) => `${suffix(value)}:${count}`;
const response = (rows: string[], status = 200): Response =>
  new Response(rows.join("\r\n"), { status });

describe("breached password range checker (#557)", () => {
  const candidate = "This is an original long passphrase about blue hills";
  const other = "Another original passphrase with a long length";
  const filler = "F".repeat(35) + ":0";

  it("rejects the local whole-password blocklist without network access", async () => {
    const transport = jest.fn();
    const checker = new BreachedPasswordChecker(transport);
    expect(isCommonPassword("PASSWORD123")).toBe(true);
    await expect(checker.assertAcceptable("password123")).rejects.toMatchObject({
      status: 400, code: "PASSWORD_COMMON",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not reject a longer passphrase because it contains a common word", () => {
    expect(isCommonPassword("My unusual password includes a long full sentence")).toBe(false);
  });

  it("rejects a breached positive match using only a hash prefix", async () => {
    const transport = jest.fn().mockResolvedValue(response([row(candidate, 42), filler]));
    const checker = new BreachedPasswordChecker(transport);
    await expect(checker.assertAcceptable(candidate)).rejects.toMatchObject({
      status: 400, code: "PASSWORD_BREACHED",
    });
    const [url, init] = transport.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${digest(candidate).slice(0, 5)}`);
    expect(url).not.toContain(suffix(candidate));
    expect(JSON.stringify(init)).not.toContain(candidate);
    expect(init.redirect).toBe("error");
    expect(init.headers).toMatchObject({ "Add-Padding": "true" });
  });

  it("does not mistake a zero-count padding suffix for a breach", async () => {
    const transport = jest.fn().mockResolvedValue(response([row(candidate, 0), filler]));
    await expect(new BreachedPasswordChecker(transport).assertAcceptable(candidate)).resolves.toBeUndefined();
  });

  it("accepts a valid no-match range", async () => {
    const transport = jest.fn().mockResolvedValue(response([row(other, 4), filler]));
    await expect(new BreachedPasswordChecker(transport).assertAcceptable(candidate)).resolves.toBeUndefined();
  });

  it.each([
    ["error status", () => response([filler, row(other)], 503)],
    ["malformed line", () => response(["broken", filler])],
    ["duplicate suffix", () => response([filler, filler])],
    ["truncated single line", () => response([row(other)])],
    ["unsafe count", () => response([row(other, Number.MAX_SAFE_INTEGER + 1), filler])],
    ["oversized body", () => response([row(other), filler, "A".repeat(257 * 1024)])],
  ])("fails closed on %s", async (_label, makeResponse) => {
    const checker = new BreachedPasswordChecker(jest.fn().mockImplementation(async () => makeResponse()));
    await expect(checker.assertAcceptable(candidate)).rejects.toMatchObject({
      status: 503, code: "BREACH_CHECK_UNAVAILABLE",
    });
  });

  it("fails closed on transport failure", async () => {
    const checker = new BreachedPasswordChecker(jest.fn().mockRejectedValue(new Error("offline")));
    await expect(checker.assertAcceptable(candidate)).rejects.toMatchObject({
      status: 503, code: "BREACH_CHECK_UNAVAILABLE",
    });
  });

  it("uses fresh cache and does not refresh its original expiry", async () => {
    let now = 100;
    const transport = jest.fn().mockResolvedValueOnce(response([row(other), filler]))
      .mockRejectedValueOnce(new Error("offline"));
    const checker = new BreachedPasswordChecker(transport, () => now);
    await checker.assertAcceptable(candidate);
    now += 5 * 60 * 60 * 1000;
    await checker.assertAcceptable(candidate);
    expect(transport).toHaveBeenCalledTimes(1);
    now += 60 * 60 * 1000 + 1;
    await expect(checker.assertAcceptable(candidate)).rejects.toMatchObject({
      code: "BREACH_CHECK_UNAVAILABLE",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("deduplicates simultaneous lookups of the same prefix", async () => {
    let complete!: (value: Response) => void;
    const transport = jest.fn().mockImplementation(() => new Promise<Response>(resolve => { complete = resolve; }));
    const checker = new BreachedPasswordChecker(transport);
    const first = checker.assertAcceptable(candidate);
    const second = checker.assertAcceptable(candidate);
    expect(transport).toHaveBeenCalledTimes(1);
    complete(response([row(other), filler]));
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  });

  it("opens the circuit after repeated provider failures", async () => {
    const transport = jest.fn().mockRejectedValue(new Error("offline"));
    const checker = new BreachedPasswordChecker(transport, () => 100);
    for (let i = 0; i < 3; i++) {
      await expect(checker.assertAcceptable(candidate)).rejects.toMatchObject({ status: 503 });
    }
    await expect(checker.assertAcceptable(candidate)).rejects.toMatchObject({ status: 503 });
    expect(transport).toHaveBeenCalledTimes(3);
  });
});
