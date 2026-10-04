import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedFilters } from "../../src/components/feed/FeedFilters";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("FeedFilters", () => {
  it("emits search, sort, and scope changes", () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onScopeChange = vi.fn();

    render(
      <FeedFilters
        onSearchChange={onSearchChange}
        onSortChange={onSortChange}
        onScopeChange={onScopeChange}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "squat" } });
    expect(onSearchChange).toHaveBeenCalledWith("squat");

    fireEvent.change(screen.getByLabelText("feed.filters.sort"), {
      target: { value: "popularity" },
    });
    expect(onSortChange).toHaveBeenCalledWith("popularity");

    fireEvent.change(screen.getByLabelText("feed.filters.scope"), {
      target: { value: "following" },
    });
    expect(onScopeChange).toHaveBeenCalledWith("following");
  });

  it("hides the scope filter when requested", () => {
    render(<FeedFilters showScopeFilter={false} />);
    expect(screen.queryByLabelText("feed.filters.scope")).not.toBeInTheDocument();
  });
});
