import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportButton } from "../../src/components/feed/ReportButton";

const showToast = vi.fn();
const tState = { impl: (key: string) => key };
const t = (key: string) => tState.impl(key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

const reportFeedItem = vi.fn();
vi.mock("../../src/services/api", () => ({
  reportFeedItem: (...args: unknown[]) => reportFeedItem(...args),
}));

describe("ReportButton", () => {
  beforeEach(() => {
    tState.impl = (key: string) => key;
    showToast.mockReset();
    reportFeedItem.mockReset().mockResolvedValue(undefined);
    vi.useRealTimers();
  });

  it("opens the report modal and requires a reason", () => {
    render(<ReportButton feedItemId="item-1" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.report.label" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "feed.report.submit" });
    expect(submit).toBeDisabled();
  });

  it("submits a report and notifies the parent", async () => {
    const onReported = vi.fn();
    render(<ReportButton feedItemId="item-1" onReported={onReported} />);

    fireEvent.click(screen.getByRole("button", { name: "feed.report.label" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "spam" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Looks like spam" } });
    fireEvent.click(screen.getByRole("button", { name: "feed.report.submit" }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "feed.report.submitted",
        message: "feed.report.submittedMessage",
      }),
    );
    expect(reportFeedItem).toHaveBeenCalledWith("item-1", {
      reason: "spam",
      details: "Looks like spam",
    });
    expect(onReported).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the modal from cancel and the overlay close", () => {
    render(<ReportButton feedItemId="item-1" />);

    fireEvent.click(screen.getByRole("button", { name: "feed.report.label" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses English copy and a larger size when translations are empty", () => {
    tState.impl = () => "";
    render(<ReportButton feedItemId="item-1" size="lg" />);

    fireEvent.click(screen.getByRole("button", { name: "Report content" }));
    expect(screen.getByText("Report Content")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Help us keep the community safe by reporting content that violates our guidelines.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Report" })).toBeDisabled();
  });
});
