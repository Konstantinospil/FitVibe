import { execFileSync } from "node:child_process";
import path from "node:path";

describe("UUID 14 runtime", () => {
  it("loads the real UUID package in the Node CommonJS backend", () => {
    const output = execFileSync(process.execPath, [
      "-e",
      "const u = require('uuid'); const id = u.v4(); if (!u.validate(id) || u.version(id) !== 4) process.exit(1); console.log(id);"
    ], {
      cwd: path.resolve(__dirname, "../../apps/backend"),
      encoding: "utf8"
    });
    expect(output.trim()).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
