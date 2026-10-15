import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlanManagement from "../../src/components/composites/PlanManagement";
import * as plans from "../../src/services/planApi";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("../../src/services/planApi", async () => ({
  ...(await vi.importActual<typeof import("../../src/services/planApi")>(
    "../../src/services/planApi",
  )),
  listTrainingPlans: vi.fn(),
  createTrainingPlan: vi.fn(),
  getTrainingPlan: vi.fn(),
  updateTrainingPlan: vi.fn(),
  activateTrainingPlan: vi.fn(),
  deleteTrainingPlan: vi.fn(),
  isTrainingPlanConflict: vi.fn(),
}));
vi.mock("../../src/utils/logger", () => ({
  logger: { apiError: vi.fn() },
}));

const samplePlan: plans.TrainingPlan = {
  id: "plan-1",
  user_id: "user-1",
  name: "Base plan",
  status: "active",
  start_date: "2026-10-01",
  end_date: "2026-11-01",
  session_count: 2,
  completed_count: 1,
  progress_percent: 50,
  revision: 1,
  duration_weeks: null,
  target_frequency: null,
  time_zone: "UTC",
  activated_at: null,
  archived_at: null,
};

describe("Training plan management", () => {
  let client: QueryClient;
  const renderPlans = () =>
    render(
      <QueryClientProvider client={client}>
        <PlanManagement open onClose={vi.fn()} />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    client = createTestQueryClient();
    vi.mocked(plans.listTrainingPlans).mockResolvedValue([samplePlan]);
    vi.mocked(plans.getTrainingPlan).mockResolvedValue({
      plan: samplePlan,
      etag: '"plan-plan-1-1"',
    });
    vi.mocked(plans.createTrainingPlan).mockResolvedValue(samplePlan);
    vi.mocked(plans.updateTrainingPlan).mockResolvedValue(samplePlan);
    vi.mocked(plans.deleteTrainingPlan).mockResolvedValue(undefined);
    vi.mocked(plans.activateTrainingPlan).mockResolvedValue(samplePlan);
    vi.mocked(plans.isTrainingPlanConflict).mockReturnValue(false);
  });

  afterEach(async () => {
    await cleanupQueryClient(client);
    vi.clearAllMocks();
  });

  it("loads existing plans and opens a populated edit form with its server version", async () => {
    renderPlans();
    expect(await screen.findByText("Base plan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.edit" }));
    expect(await screen.findByDisplayValue("Base plan")).toBeInTheDocument();
    expect(plans.getTrainingPlan).toHaveBeenCalledWith("plan-1");
    fireEvent.change(screen.getByDisplayValue("Base plan"), {
      target: { value: "Revised plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.save" }));
    await waitFor(() => {
      expect(plans.updateTrainingPlan).toHaveBeenCalledWith(
        "plan-1",
        { name: "Revised plan" },
        '"plan-plan-1-1"',
      );
    });
  });

  it("creates a plan using the existing form without inventing date defaults", async () => {
    renderPlans();
    await screen.findByText("Base plan");
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.create" }));
    fireEvent.change(screen.getByLabelText("trainingPlans.fields.name"), {
      target: { value: "New plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.save" }));
    await waitFor(() => {
      expect(plans.createTrainingPlan).toHaveBeenCalledWith({
        name: "New plan",
        start_date: null,
        end_date: null,
        duration_weeks: null,
        target_frequency: null,
        time_zone: expect.any(String),
      });
    });
  });

  it("rejects inverted dates without sending an invalid request", async () => {
    renderPlans();
    await screen.findByText("Base plan");
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.create" }));
    fireEvent.change(screen.getByLabelText("trainingPlans.fields.name"), {
      target: { value: "Invalid dates" },
    });
    fireEvent.change(screen.getByLabelText("trainingPlans.fields.startDate"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("trainingPlans.fields.endDate"), {
      target: { value: "2026-10-01" },
    });
    const endDate = screen.getByLabelText("trainingPlans.fields.endDate");
    expect(endDate).toHaveAttribute("min", "2026-11-01");
    // Native constraint validation blocks form submission in a real browser.
    // Exercise the browser invalid event and its accessible localized feedback.
    fireEvent.invalid(endDate);
    expect(await screen.findByText("trainingPlans.errors.dateOrder")).toBeInTheDocument();
    expect(plans.createTrainingPlan).not.toHaveBeenCalled();
  });

  it("allows renaming an activated plan without writing schedule fields", async () => {
    const activated = { ...samplePlan, activated_at: "2026-10-02T08:00:00.000Z" };
    vi.mocked(plans.listTrainingPlans).mockResolvedValue([activated]);
    vi.mocked(plans.getTrainingPlan).mockResolvedValue({
      plan: activated,
      etag: '"plan-plan-1-1"',
    });
    renderPlans();
    await screen.findByText("Base plan");
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.edit" }));
    await screen.findByDisplayValue("Base plan");
    expect(screen.getByLabelText("trainingPlans.fields.startDate")).toBeDisabled();
    expect(screen.getByLabelText("trainingPlans.fields.endDate")).toBeDisabled();
    fireEvent.change(screen.getByDisplayValue("Base plan"), { target: { value: "Renamed plan" } });
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.save" }));
    await waitFor(() =>
      expect(plans.updateTrainingPlan).toHaveBeenCalledWith(
        "plan-1",
        { name: "Renamed plan" },
        '"plan-plan-1-1"',
      ),
    );
  });

  it("allows activation when scheduling details and templates are present", async () => {
    const configured = {
      ...samplePlan,
      duration_weeks: 3,
      target_frequency: 2,
      activated_at: null,
    };
    vi.mocked(plans.listTrainingPlans).mockResolvedValue([configured]);
    renderPlans();
    await screen.findByText("Base plan");
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.activate" }));
    await waitFor(() => expect(plans.activateTrainingPlan).toHaveBeenCalledWith("plan-1"));
  });

  it("asks for confirmation before archiving a plan", async () => {
    renderPlans();
    await screen.findByText("Base plan");
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.delete" }));
    expect(plans.deleteTrainingPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.delete" }));
    await waitFor(() => expect(plans.deleteTrainingPlan).toHaveBeenCalledWith("plan-1"));
  });

  it("shows a conflict and reloads the latest plan version rather than overwriting it", async () => {
    const staleError = new Error("Precondition Failed");
    vi.mocked(plans.updateTrainingPlan).mockRejectedValue(staleError);
    vi.mocked(plans.isTrainingPlanConflict).mockImplementation((error) => error === staleError);
    renderPlans();
    await screen.findByText("Base plan");
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.edit" }));
    await screen.findByDisplayValue("Base plan");
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.save" }));
    expect(await screen.findByText("trainingPlans.errors.conflict")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "trainingPlans.actions.save" })).toBeDisabled();
    vi.mocked(plans.getTrainingPlan).mockResolvedValue({
      plan: { ...samplePlan, name: "Updated elsewhere", revision: 2 },
      etag: '"plan-plan-1-2"',
    });
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.reload" }));
    expect(await screen.findByDisplayValue("Updated elsewhere")).toBeInTheDocument();
    expect(screen.queryByText("trainingPlans.errors.conflict")).not.toBeInTheDocument();
  });
});
