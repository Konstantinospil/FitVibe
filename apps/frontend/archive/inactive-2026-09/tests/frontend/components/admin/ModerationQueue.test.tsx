import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModerationQueue } from "../../src/components/admin/ModerationQueue";
import type { FeedReport } from "../../src/services/api";

const getFeedReports = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/services/api", () => ({
  getFeedReports: (...args: unknown[]) => getFeedReports(...args),
}));

vi.mock("../../src/components/admin/ContentModerationActions", () => ({
  ContentModerationActions: ({ onActionComplete }: { onActionComplete: () => void }) => (
    <button type="button" onClick={onActionComplete}>
      action-report
    </button>
  ),
}));

function makeReport(overrides: Partial<FeedReport> = {}): FeedReport {
  return {
    id: "r-1",
    reporterUsername: "mod-user",
    reason: "spam",
    details: "looks automated",
    status: "pending",
    createdAt: "2026-01-02T10:00:00.000Z",
    contentPreview: "buy now",
    contentAuthor: "spammer",
    ...overrides,
  };
}

describe("ModerationQueue", () => {
  beforeEach(() => {
    getFeedReports.mockReset().mockResolvedValue({ data: [], total: 0 });
  });

  it("shows an empty state", async () => {
    render(<ModerationQueue />);
    expect(await screen.findByText("admin.moderation.queue.empty")).toBeInTheDocument();
    expect(getFeedReports).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", limit: 20, offset: 0 }),
    );
  });

  it("renders reports, paginates, filters, and reloads after an action", async () => {
    const onReportActioned = vi.fn();
    getFeedReports.mockResolvedValue({
      data: [
        makeReport(),
        makeReport({
          id: "r-2",
          status: "reviewed",
          details: null,
          reporterUsername: "other",
          contentPreview: "already handled",
        }),
      ],
      total: 40,
    });

    render(<ModerationQueue onReportActioned={onReportActioned} />);
    expect(await screen.findByText("mod-user")).toBeInTheDocument();
    expect(screen.getByText("already handled")).toBeInTheDocument();
    expect(screen.getByText("looks automated")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(getFeedReports).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 })),
    );

    fireEvent.click(screen.getByRole("tab", { name: "admin.moderation.status.all" }));
    await waitFor(() =>
      expect(getFeedReports).toHaveBeenCalledWith(expect.objectContaining({ status: undefined })),
    );

    fireEvent.click(screen.getByText("action-report"));
    await waitFor(() => expect(onReportActioned).toHaveBeenCalled());
  });

  it("swallows load errors", async () => {
    getFeedReports.mockRejectedValue(new Error("fail"));
    render(<ModerationQueue />);
    expect(await screen.findByText("admin.moderation.queue.empty")).toBeInTheDocument();
  });
});
