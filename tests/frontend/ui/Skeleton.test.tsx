import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../../src/components/ui";

describe("Skeleton", () => {
  it("renders an aria-hidden placeholder", async () => {
    const { unmount } = render(<Skeleton data-testid="skeleton" width="150px" height="20px" />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");

    await waitFor(
      () => {
        expect(skeleton).toHaveStyle({ width: "150px", height: "20px" });
      },
      { timeout: 5000 },
    );
    unmount();
  });

  describe("default props", () => {
    it("uses default width of 100% when not provided", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ width: "100%" });
      unmount();
    });

    it("uses default height of 1rem when not provided", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton.style.height).toBe("1rem");
      unmount();
    });

    it("uses default radius of 12px when not provided", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ borderRadius: "12px" });
      unmount();
    });
  });

  describe("custom props", () => {
    it("applies custom width as string", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" width="200px" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ width: "200px" });
      unmount();
    });

    it("applies custom width as number", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" width={300} />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ width: "300px" });
      unmount();
    });

    it("applies custom height as string", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" height="50px" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ height: "50px" });
      unmount();
    });

    it("applies custom height as number", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" height={75} />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ height: "75px" });
      unmount();
    });

    it("applies custom radius as string", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" radius="8px" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ borderRadius: "8px" });
      unmount();
    });

    it("applies custom radius as number", () => {
      const { unmount } = render(<Skeleton data-testid="skeleton" radius={16} />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveStyle({ borderRadius: "16px" });
      unmount();
    });
  });

  describe("style prop merging", () => {
    it("merges custom style with default styles", () => {
      const { unmount } = render(
        <Skeleton
          data-testid="skeleton"
          width="100px"
          style={{ backgroundColor: "red", opacity: "0.5" }}
        />,
      );
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton.style.width).toBe("100px");
      expect(skeleton.style.opacity).toBe("0.5");
      unmount();
    });

    it("allows style to override default props", () => {
      const { unmount } = render(
        <Skeleton data-testid="skeleton" width="100px" style={{ width: "200px" }} />,
      );
      const skeleton = screen.getByTestId("skeleton");
      // Custom style should override prop
      expect(skeleton).toHaveStyle({ width: "200px" });
      unmount();
    });
  });

  describe("other props", () => {
    it("passes through other HTML attributes", () => {
      const { unmount } = render(
        <Skeleton data-testid="skeleton" className="custom-class" id="skeleton-1" />,
      );
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("custom-class");
      expect(skeleton).toHaveAttribute("id", "skeleton-1");
      unmount();
    });
  });
});
