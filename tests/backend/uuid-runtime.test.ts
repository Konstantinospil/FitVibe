import { execFileSync } from "node:child_process";
import path from "node:path";

describe("UUID 14 runtime", () => {
  it("loads the real UUID package and generates distinct valid UUIDv4 values in CommonJS", () => {
    // The backend Jest setup mocks uuid. Execute a separate Node process
    // so this test verifies the installed package rather than the mock.
    const script = [
      "const uuid = require('uuid');",
      "const first = uuid.v4();",
      "const second = uuid.v4();",
      "if (!uuid.validate(first) || uuid.version(first) !== 4) process.exit(1);",
      "if (!uuid.validate(second) || uuid.version(second) !== 4) process.exit(1);",
      "if (first === second) process.exit(1);",
      "process.stdout.write(first);",
    ].join(" ");

    const output = execFileSync(process.execPath, ["-e", script], {
      cwd: path.resolve(__dirname, "../../apps/backend"),
      encoding: "utf8",
    });
    expect(output).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
