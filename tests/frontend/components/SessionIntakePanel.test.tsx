import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionIntakePanel } from "../../src/components/composites/SessionIntakePanel";
import * as sessionApi from "../../src/services/sessionApi";
import { TRAINING_DATA_CONFIG } from "../../src/config/trainingSurfaces";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && Object.keys(options).length
        ? `${key}(${Object.entries(options)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(",")})`
        : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../src/services/sessionApi", async () => {
  const actual = await vi.importActual<typeof sessionApi>("../../src/services/sessionApi");
  return { ...actual, addIntakeEntry: vi.fn(), deleteIntakeEntry: vi.fn() };
});

const mocked = vi.mocked(sessionApi);
const empty: sessionApi.SessionIntake = { entries: [], totals: { water_ml: 0, energy_kcal: 0 } };
const withWater: sessionApi.SessionIntake = {
  entries: [{ id: "e1", kind: "water", amount: 500, recorded_at: "2026-11-27T10:00:00.000Z" }],
  totals: { water_ml: 500, energy_kcal: 0 },
};

describe("SessionIntakePanel (ADR-045)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  const onChanged = vi.fn();
  const renderPanel = (
    intake: sessionApi.SessionIntake,
    status: sessionApi.SessionStatus = "in_progress",
  ) =>
    render(
      <QueryClientProvider client={queryClient}>
        <SessionIntakePanel sessionId="s1" intake={intake} status={status} onChanged={onChanged} />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });
  afterEach(() => cleanupQueryClient(queryClient));

  it("adds water with one tap during a workout", async () => {
    mocked.addIntakeEntry.mockResolvedValue(withWater);
    renderPanel(empty);
    const [quickMl] = TRAINING_DATA_CONFIG.intakeWaterQuickAddMl;

    fireEvent.click(
      screen.getByRole("button", {
        name: `workoutIntake.quickWater(amount=workoutIntake.amount.water(amount=${quickMl}))`,
      }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(withWater));
    expect(mocked.addIntakeEntry).toHaveBeenCalledWith("s1", { kind: "water", amount: quickMl });
  });

  it("records food energy typed in, and refuses an amount over the limit", async () => {
    mocked.addIntakeEntry.mockResolvedValue(empty);
    renderPanel(empty);
    fireEvent.change(screen.getByLabelText("workoutIntake.fields.kind"), {
      target: { value: "energy" },
    });
    const amount = screen.getByLabelText("workoutIntake.fields.amount.energy");

    fireEvent.change(amount, {
      target: { value: String(TRAINING_DATA_CONFIG.intakeEnergyMaxKcal + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "workoutIntake.add" }));
    expect(
      screen.getByText(
        `workoutIntake.invalid.energy(max=${TRAINING_DATA_CONFIG.intakeEnergyMaxKcal})`,
      ),
    ).toBeInTheDocument();
    expect(mocked.addIntakeEntry).not.toHaveBeenCalled();

    fireEvent.change(amount, { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "workoutIntake.add" }));
    await waitFor(() =>
      expect(mocked.addIntakeEntry).toHaveBeenCalledWith("s1", { kind: "energy", amount: 90 }),
    );
  });

  it("lists entries with totals and removes one", async () => {
    mocked.deleteIntakeEntry.mockResolvedValue(empty);
    renderPanel(withWater, "completed");
    expect(screen.getByText("workoutIntake.amount.water(amount=500)")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "workoutIntake.entries" });

    fireEvent.click(
      within(list).getByRole("button", {
        name: "workoutIntake.removeEntry(amount=workoutIntake.amount.water(amount=500))",
      }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(empty));
    expect(mocked.deleteIntakeEntry).toHaveBeenCalledWith("s1", "e1");
  });

  it("only shows recorded intake on a workout that cannot take more", () => {
    const { unmount } = renderPanel(withWater, "canceled");
    expect(screen.getByRole("list", { name: "workoutIntake.entries" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();

    const { container } = renderPanel(empty, "planned");
    expect(container).toBeEmptyDOMElement();
  });
});
