import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminStats } from "../../src/components/admin/AdminStats";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe.skip("AdminStats (quarantined: no admin stats API)", () => {
  it("loads placeholder stats and notifies the parent", async () => {
    const onLoad = vi.fn();
    render(<AdminStats onLoad={onLoad} />);

    expect(await screen.findByText("admin.stats.title")).toBeInTheDocument();
    await waitFor(() =>
      expect(onLoad).toHaveBeenCalledWith({
        totalUsers: 0,
        activeUsers: 0,
        totalSessions: 0,
        totalReports: 0,
        pendingReports: 0,
      }),
    );
    expect(screen.getByText("admin.stats.totalUsers")).toBeInTheDocument();
    expect(screen.getByText("admin.stats.pendingReports")).toBeInTheDocument();
  });
});
