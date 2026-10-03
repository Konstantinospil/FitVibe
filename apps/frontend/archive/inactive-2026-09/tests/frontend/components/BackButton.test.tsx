import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "../../src/components/utils/BackButton";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("BackButton", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("uses onClick when provided", () => {
    const onClick = vi.fn();
    render(<BackButton label="Go back" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates to the provided route", () => {
    render(<BackButton to="/sessions" />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(mockNavigate).toHaveBeenCalledWith("/sessions");
  });

  it("navigates back when no route or handler is provided", () => {
    render(<BackButton />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
