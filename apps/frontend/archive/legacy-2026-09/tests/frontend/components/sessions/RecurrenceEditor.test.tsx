import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecurrenceEditor } from "../../src/components/sessions/RecurrenceEditor";

const tState = { impl: (key: string) => key };
const t = (key: string) => tState.impl(key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

describe("RecurrenceEditor", () => {
  beforeEach(() => {
    tState.impl = (key: string) => key;
  });

  it("enables recurrence and updates weekly days", () => {
    const onChange = vi.fn();
    render(<RecurrenceEditor onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("recurrence.enable"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: "weekly", interval: 1 }),
    );
    expect(screen.getByText("recurrence.selectAtLeastOneDay")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("calendar.monday"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ daysOfWeek: [1] }));
    fireEvent.click(screen.getByLabelText("calendar.monday"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ daysOfWeek: [] }));
  });

  it("switches frequency, interval, monthly day, and end conditions", () => {
    const onChange = vi.fn();
    render(
      <RecurrenceEditor
        value={{ frequency: "weekly", interval: 1, daysOfWeek: [1] }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("recurrence.frequency"), { target: { value: "daily" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ frequency: "daily" }));
    expect(screen.getByText("recurrence.intervalDays")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("recurrence.interval"), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ interval: 1 }));
    fireEvent.change(screen.getByLabelText("recurrence.interval"), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ interval: 3 }));

    fireEvent.change(screen.getByLabelText("recurrence.frequency"), {
      target: { value: "monthly" },
    });
    expect(screen.getByText("recurrence.intervalMonths")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("recurrence.dayOfMonth"), { target: { value: "15" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dayOfMonth: 15 }));
    fireEvent.change(screen.getByLabelText("recurrence.dayOfMonth"), { target: { value: "40" } });

    fireEvent.change(screen.getByLabelText("recurrence.frequency"), {
      target: { value: "yearly" },
    });
    expect(screen.getByText("recurrence.intervalYears")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("recurrence.endDate"), {
      target: { value: "2026-12-01" },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ endDate: "2026-12-01" }));
    fireEvent.change(screen.getByLabelText("recurrence.endDate"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("recurrence.occurrences"), { target: { value: "8" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ occurrences: 8 }));
    fireEvent.change(screen.getByLabelText("recurrence.occurrences"), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ occurrences: undefined }));

    fireEvent.click(screen.getByLabelText("recurrence.enable"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders weekly days from a value without daysOfWeek and ignores missing onChange", () => {
    render(<RecurrenceEditor value={{ frequency: "weekly", interval: 2 }} />);

    expect(screen.getByText("recurrence.selectAtLeastOneDay")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("calendar.friday"));
    fireEvent.click(screen.getByLabelText("recurrence.enable"));
  });

  it("ignores invalid monthly day values", () => {
    const onChange = vi.fn();
    render(
      <RecurrenceEditor
        value={{ frequency: "monthly", interval: 1, dayOfMonth: 10 }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("recurrence.dayOfMonth"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("recurrence.dayOfMonth"), { target: { value: "0" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders English fallbacks when translations are empty", () => {
    tState.impl = () => "";
    render(<RecurrenceEditor value={{ frequency: "weekly", interval: 1, daysOfWeek: [1] }} />);

    expect(screen.getByText("Recurrence")).toBeInTheDocument();
    expect(screen.getByLabelText("Repeat this session")).toBeChecked();
    expect(screen.getByText("weeks")).toBeInTheDocument();
    expect(screen.getByText("Monday")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "daily" } });
    expect(screen.getByText("days")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "monthly" } });
    expect(screen.getByText("months")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "yearly" } });
    expect(screen.getByText("years")).toBeInTheDocument();
  });
});
