import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "../../src/components/composites/Modal";

// An empty body still took its padding and showed as a blank band between the
// header and footer dividers (the first-login 2FA prompt in its choice stage).
describe("Modal body", () => {
  afterEach(() => {
    cleanup();
  });

  const footer = <button type="button">Continue</button>;
  const bodySlot = () => document.querySelector('[data-slot="modal-body"]');

  it("omits the body when every child is conditionally empty", () => {
    const showNote = false;
    render(
      <Modal open title="Secure your account" footer={footer}>
        {showNote ? <p>Note</p> : null}
        {null}
        {undefined}
        {false}
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "Secure your account" })).toBeInTheDocument();
    expect(bodySlot()).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("omits the body when there are no children", () => {
    render(<Modal open title="Secure your account" footer={footer} />);
    expect(bodySlot()).toBeNull();
  });

  it("renders the body when at least one child has content", () => {
    render(
      <Modal open title="Secure your account" footer={footer}>
        {null}
        <p>Administrators must enable two-factor authentication.</p>
      </Modal>,
    );

    expect(bodySlot()).not.toBeNull();
    expect(
      screen.getByText("Administrators must enable two-factor authentication."),
    ).toBeInTheDocument();
  });
});
