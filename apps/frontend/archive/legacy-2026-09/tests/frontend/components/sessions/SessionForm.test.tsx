import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionForm } from "../../src/components/sessions/SessionForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const data = {
  title: "Push day",
  notes: "Keep rest short",
  plannedDate: "2026-01-02",
  plannedTime: "18:00",
  visibility: "private" as const,
};

describe("SessionForm", () => {
  it("updates title, notes, date, time, and visibility", () => {
    const onChange = vi.fn();
    render(<SessionForm data={data} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue("Push day"), { target: { value: "Pull day" } });
    expect(onChange).toHaveBeenCalledWith({ ...data, title: "Pull day" });

    fireEvent.change(screen.getByDisplayValue("Keep rest short"), {
      target: { value: "Slow eccentrics" },
    });
    expect(onChange).toHaveBeenCalledWith({ ...data, notes: "Slow eccentrics" });

    fireEvent.change(screen.getByDisplayValue("2026-01-02"), { target: { value: "2026-01-03" } });
    expect(onChange).toHaveBeenCalledWith({ ...data, plannedDate: "2026-01-03" });

    fireEvent.change(screen.getByDisplayValue("18:00"), { target: { value: "19:30" } });
    expect(onChange).toHaveBeenCalledWith({ ...data, plannedTime: "19:30" });

    fireEvent.click(screen.getByRole("button", { name: /visibility.labels.public/i }));
    expect(onChange).toHaveBeenCalledWith({ ...data, visibility: "public" });
  });

  it("shows field errors and disables inputs", () => {
    render(
      <SessionForm
        data={data}
        onChange={vi.fn()}
        disabled
        errors={{ title: "Required", notes: "Too long", plannedDate: "Invalid" }}
      />,
    );

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Too long")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Push day")).toBeDisabled();
  });
});
