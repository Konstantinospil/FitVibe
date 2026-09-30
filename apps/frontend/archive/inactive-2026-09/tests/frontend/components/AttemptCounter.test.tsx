/**
 * Tests for AttemptCounter component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttemptCounter } from "../../src/components/AttemptCounter";

describe("AttemptCounter", () => {
  it("should display warning when 3 attempts remaining", () => {
    render(
      <AttemptCounter
        remainingAccountAttempts={3}
        remainingIPAttempts={5}
        remainingIPDistinctEmails={5}
        accountAttemptCount={2}
        ipTotalAttemptCount={5}
        ipDistinctEmailCount={2}
      />,
    );

    expect(screen.getByText(/3 attempt/i)).toBeInTheDocument();
    expect(screen.getByText(/remaining before/i)).toBeInTheDocument();
  });

  it("should display critical warning when 1 attempt remaining", () => {
    render(
      <AttemptCounter
        remainingAccountAttempts={1}
        remainingIPAttempts={5}
        remainingIPDistinctEmails={5}
        accountAttemptCount={4}
        ipTotalAttemptCount={5}
        ipDistinctEmailCount={2}
      />,
    );

    expect(screen.getByText(/Last attempt before lockout/i)).toBeInTheDocument();
    expect(screen.getByText(/1 attempt/i)).toBeInTheDocument();
  });

  it("should display account attempt count", () => {
    render(
      <AttemptCounter
        remainingAccountAttempts={2}
        remainingIPAttempts={5}
        remainingIPDistinctEmails={5}
        accountAttemptCount={3}
        ipTotalAttemptCount={5}
        ipDistinctEmailCount={2}
      />,
    );

    expect(screen.getByText(/Account attempts: 3/i)).toBeInTheDocument();
  });

  it("should display IP attempt count and distinct emails", () => {
    render(
      <AttemptCounter
        remainingAccountAttempts={5}
        remainingIPAttempts={3}
        remainingIPDistinctEmails={5}
        accountAttemptCount={0}
        ipTotalAttemptCount={7}
        ipDistinctEmailCount={3}
      />,
    );

    expect(screen.getByText(/IP attempts: 7/i)).toBeInTheDocument();
    expect(screen.getByText(/3 different emails/i)).toBeInTheDocument();
  });

  it("should not render when all attempts are exhausted", () => {
    const { container } = render(
      <AttemptCounter
        remainingAccountAttempts={0}
        remainingIPAttempts={0}
        remainingIPDistinctEmails={0}
        accountAttemptCount={5}
        ipTotalAttemptCount={10}
        ipDistinctEmailCount={5}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should use account lockout type when account has fewest remaining", () => {
    render(
      <AttemptCounter
        remainingAccountAttempts={2}
        remainingIPAttempts={5}
        remainingIPDistinctEmails={5}
        accountAttemptCount={3}
        ipTotalAttemptCount={5}
        ipDistinctEmailCount={2}
      />,
    );

    expect(screen.getByText(/Account lockout/i)).toBeInTheDocument();
  });

  it("should use IP lockout type when IP has fewest remaining", () => {
    render(
      <AttemptCounter
        remainingAccountAttempts={5}
        remainingIPAttempts={2}
        remainingIPDistinctEmails={5}
        accountAttemptCount={0}
        ipTotalAttemptCount={8}
        ipDistinctEmailCount={2}
      />,
    );

    expect(screen.getByText(/IP lockout/i)).toBeInTheDocument();
  });

  it("should use IP email lockout type when distinct emails has fewest remaining", () => {
    render(
      <AttemptCounter
        remainingAccountAttempts={5}
        remainingIPAttempts={5}
        remainingIPDistinctEmails={2}
        accountAttemptCount={0}
        ipTotalAttemptCount={3}
        ipDistinctEmailCount={3}
      />,
    );

    expect(screen.getByText(/too many different emails/i)).toBeInTheDocument();
  });

  it("should be accessible with ARIA alert role", () => {
    const { container } = render(
      <AttemptCounter
        remainingAccountAttempts={3}
        remainingIPAttempts={5}
        remainingIPDistinctEmails={5}
        accountAttemptCount={2}
        ipTotalAttemptCount={5}
        ipDistinctEmailCount={2}
      />,
    );

    const alertElements = screen.getAllByRole("alert");
    const alertElement =
      Array.from(alertElements).find((el) => container.contains(el)) || alertElements[0];
    expect(alertElement).toBeInTheDocument();
  });
});
