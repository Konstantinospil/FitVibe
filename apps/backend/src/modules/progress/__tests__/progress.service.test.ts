import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

import { getVibePoints } from "../progress.service.js";
import { fetchVibePointsTrends } from "../progress.repository.js";

jest.mock("../progress.repository.js", () => ({
  fetchVibePointsTrends: jest.fn(),
}));

jest.mock("../../common/audit.util.js", () => ({
  insertAudit: jest.fn(),
}));

describe("progress service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-03-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds month-keyed vibe points trends aligned to the requested window", async () => {
    jest.mocked(fetchVibePointsTrends).mockResolvedValue({
      vibeRows: [
        { type_code: "strength", month_key: "2025-02", points: 10 },
        { type_code: "regeneration", month_key: "2025-03", points: 20 },
      ],
      overallRows: [
        { month_key: "2025-02", points: 5 },
        { month_key: "2025-03", points: 15 },
      ],
    });

    const result = await getVibePoints("user-1", 3);

    expect(fetchVibePointsTrends).toHaveBeenCalledWith("user-1", 3);
    expect(result.months).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(result.overall.trend).toEqual([
      { month: "2025-01", points: 0 },
      { month: "2025-02", points: 5 },
      { month: "2025-03", points: 15 },
    ]);
    expect(result.vibes).toEqual([
      {
        type_code: "strength",
        points: 10,
        trend: [
          { month: "2025-01", points: 0 },
          { month: "2025-02", points: 10 },
          { month: "2025-03", points: 0 },
        ],
      },
      {
        type_code: "regeneration",
        points: 20,
        trend: [
          { month: "2025-01", points: 0 },
          { month: "2025-02", points: 0 },
          { month: "2025-03", points: 20 },
        ],
      },
    ]);
  });
});
