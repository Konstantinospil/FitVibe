import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Accordion, AccordionItem } from "../../src/components/ui/Accordion";

describe("Accordion", () => {
  it("renders grouped items and starts closed by default", () => {
    render(
      <Accordion>
        <AccordionItem title="Details">Hidden copy</AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole("button", { name: "Details" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Hidden copy")).toBeInTheDocument();
  });

  it("toggles open state and notifies onToggle", () => {
    const onToggle = vi.fn();
    render(
      <AccordionItem title="More" defaultOpen onToggle={onToggle}>
        Body
      </AccordionItem>,
    );

    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("applies hover styles on the trigger", () => {
    render(<AccordionItem title="Hover">Body</AccordionItem>);
    const trigger = screen.getByRole("button", { name: "Hover" });

    fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveStyle({ background: "var(--color-bg-secondary)" });

    fireEvent.mouseLeave(trigger);
    expect(trigger).toHaveStyle({ background: "var(--color-bg-card)" });
  });
});
