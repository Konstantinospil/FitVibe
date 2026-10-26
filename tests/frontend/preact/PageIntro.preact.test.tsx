import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import PageIntro from "../../../apps/frontend/src/components/PageIntro";

const container = document.createElement("div");

afterEach(() => {
  act(() => render(null, container));
  container.remove();
});

describe("PageIntro Preact compatibility (#523 pilot)", () => {
  it("renders the actual UI component's title and description", () => {
    document.body.appendChild(container);
    act(() => render(<PageIntro title="Training" description="Upcoming sessions" />, container));
    expect(container.querySelector('h1')?.textContent).toBe("Training");
    expect(container.textContent).toContain("Upcoming sessions");
  });

  it("updates existing markup when props change without duplicating the component", () => {
    document.body.appendChild(container);
    act(() => render(<PageIntro title="Before" description="First" />, container));
    act(() => render(<PageIntro title="After" description="Second" />, container));
    expect(container.querySelectorAll('[data-component="page-intro"]')).toHaveLength(1);
    expect(container.querySelector("h1")?.textContent).toBe("After");
    expect(container.textContent).not.toContain("First");
  });

  it("runs a real DOM button interaction through the optional actions slot", () => {
    document.body.appendChild(container);
    const onAction = vi.fn();
    act(() =>
      render(
        <PageIntro title="Sessions" description="Choose an action" actions={<button type="button" onClick={onAction}>Open</button>} />,
        container,
      ),
    );
    act(() => container.querySelector("button")?.click());
    expect(onAction).toHaveBeenCalledOnce();
  });
});
