import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ConsentCard,
  EventCard,
  MessageCard,
  MetricCard,
  WorkoutSummaryCard,
} from "../../../packages/ui/src/CardPatterns";

describe("CardPatterns", () => {
  it("renders the message-card tone and dismiss action", () => {
    const onDismiss = vi.fn();
    render(
      <MessageCard
        tone="success"
        title="Message text"
        description="This is a message for the user"
        onDismiss={onDismiss}
      />,
    );

    const card = screen.getByText("Message text").closest("[data-component='message-card']");
    expect(card).toHaveAttribute("data-tone", "success");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders a workout summary without page-specific layout", () => {
    render(
      <WorkoutSummaryCard
        title="Workout summary"
        timestamp="22/05/2026 09:00"
        metricLabel="Text body here"
        metricValue="12"
      />,
    );

    expect(screen.getByText("Workout summary")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
  });

  it("renders a metric card with supporting text", () => {
    render(<MetricCard label="Label" value="Value" supportingText="Supporting text" />);
    expect(screen.getByText("Value")).toBeVisible();
    expect(screen.getByText("Supporting text")).toBeVisible();
  });

  it("composes an event card from nested content and action", () => {
    const onAction = vi.fn();
    render(
      <EventCard
        title="Eventtext"
        explanation="Explanation"
        actionLabel="Continue"
        onAction={onAction}
      >
        <MessageCard title="Message text" description="This is a message for the user" />
      </EventCard>,
    );

    expect(screen.getByText("Eventtext")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders the consent composition with canonical switch", () => {
    render(
      <ConsentCard
        category="Commercial Cookie"
        requiredLabel="Required"
        title="This is a description of what kind of data is collected."
      />,
    );

    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeVisible();
  });
});
