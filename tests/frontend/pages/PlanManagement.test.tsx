import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlanManagement from "../../src/components/composites/PlanManagement";
import { logger } from "../../src/utils/logger";
import * as plans from "../../src/services/planApi";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Plan progress shows its interpolated values; every other key renders as itself.
    t: (key: string, options?: { completed?: number; total?: number; percent?: string }) =>
      options?.completed !== undefined
        ? `${key}:${options.completed}/${options.total}/${options.percent}`
        : key,
    i18n: { language: "en" },
  }),
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

  it("shows completion progress for activated plans and the session count otherwise", async () => {
    vi.mocked(plans.listTrainingPlans).mockResolvedValue([
      samplePlan,
      {
        ...samplePlan,
        id: "plan-active",
        name: "Active block",
        activated_at: "2026-11-01T08:00:00.000Z",
        session_count: 8,
        completed_count: 3,
        progress_percent: "37.50",
      },
    ]);
    renderPlans();

    expect(await screen.findByText("trainingPlans.progress:3/8/38%")).toBeInTheDocument();
    expect(screen.getByText("trainingPlans.sessionCount")).toBeInTheDocument();
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
    // A stale version is an expected outcome, not an error to log.
    expect(logger.apiError).not.toHaveBeenCalled();
    vi.mocked(plans.getTrainingPlan).mockResolvedValue({
      plan: { ...samplePlan, name: "Updated elsewhere", revision: 2 },
      etag: '"plan-plan-1-2"',
    });
    fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.reload" }));
    expect(await screen.findByDisplayValue("Updated elsewhere")).toBeInTheDocument();
    expect(screen.queryByText("trainingPlans.errors.conflict")).not.toBeInTheDocument();
  });

  describe("failures and secondary paths", () => {
    const openCreateForm = async () => {
      renderPlans();
      await screen.findByText("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.create" }));
    };

    it("closes through the dialog's close button", async () => {
      const onClose = vi.fn();
      render(
        <QueryClientProvider client={client}>
          <PlanManagement open onClose={onClose} />
        </QueryClientProvider>,
      );
      await screen.findByText("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.close" }));
      expect(onClose).toHaveBeenCalled();
    });

    it("asks for a name before saving", async () => {
      await openCreateForm();
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.name"), {
        target: { value: "   " },
      });
      fireEvent.submit(screen.getByLabelText("trainingPlans.fields.name").closest("form")!);
      expect(await screen.findByText("trainingPlans.errors.required")).toBeInTheDocument();
      expect(plans.createTrainingPlan).not.toHaveBeenCalled();
    });

    it("refuses inverted dates even when the browser does not block the form", async () => {
      await openCreateForm();
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.name"), {
        target: { value: "Dates" },
      });
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.startDate"), {
        target: { value: "2026-11-01" },
      });
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.endDate"), {
        target: { value: "2026-10-01" },
      });
      fireEvent.submit(screen.getByLabelText("trainingPlans.fields.name").closest("form")!);
      expect(await screen.findByText("trainingPlans.errors.dateOrder")).toBeInTheDocument();
      expect(plans.createTrainingPlan).not.toHaveBeenCalled();
    });

    it("sends the schedule fields of a new plan", async () => {
      await openCreateForm();
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.name"), {
        target: { value: "Block" },
      });
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.durationWeeks"), {
        target: { value: "4" },
      });
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.targetFrequency"), {
        target: { value: "3" },
      });
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.timeZone"), {
        target: { value: "Europe/Athens" },
      });
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.save" }));
      await waitFor(() =>
        expect(plans.createTrainingPlan).toHaveBeenCalledWith(
          expect.objectContaining({
            duration_weeks: 4,
            target_frequency: 3,
            time_zone: "Europe/Athens",
          }),
        ),
      );
    });

    it("leaves the form with Cancel", async () => {
      await openCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.cancel" }));
      expect(screen.queryByLabelText("trainingPlans.fields.name")).not.toBeInTheDocument();
      expect(screen.getByText("Base plan")).toBeInTheDocument();
    });

    it("reports and logs a failed save", async () => {
      vi.mocked(plans.createTrainingPlan).mockRejectedValue(new Error("offline"));
      await openCreateForm();
      fireEvent.change(screen.getByLabelText("trainingPlans.fields.name"), {
        target: { value: "New" },
      });
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.save" }));
      expect(await screen.findByText("trainingPlans.errors.save")).toBeInTheDocument();
      expect(logger.apiError).toHaveBeenCalledWith(
        "Failed to save training plan",
        expect.any(Error),
        "/api/v1/plans",
        "POST",
      );
    });

    it("reports a plan that could not be loaded for editing", async () => {
      vi.mocked(plans.getTrainingPlan).mockRejectedValue(new Error("gone"));
      renderPlans();
      await screen.findByText("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.edit" }));
      expect(await screen.findByText("trainingPlans.errors.loadDetail")).toBeInTheDocument();
    });

    it("reports a failed activation", async () => {
      vi.mocked(plans.listTrainingPlans).mockResolvedValue([
        { ...samplePlan, duration_weeks: 3, target_frequency: 2 },
      ]);
      vi.mocked(plans.activateTrainingPlan).mockRejectedValue(new Error("conflict"));
      renderPlans();
      await screen.findByText("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.activate" }));
      expect(await screen.findByText("trainingPlans.errors.activate")).toBeInTheDocument();
    });

    it("reports a failed archive and keeps the plan", async () => {
      vi.mocked(plans.deleteTrainingPlan).mockRejectedValue(new Error("offline"));
      renderPlans();
      await screen.findByText("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.delete" }));
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.delete" }));
      expect(await screen.findByText("trainingPlans.errors.delete")).toBeInTheDocument();
      expect(screen.getByText("Base plan")).toBeInTheDocument();
    });

    it("cancels the archive confirmation", async () => {
      renderPlans();
      await screen.findByText("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.delete" }));
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.cancel" }));
      expect(await screen.findByText("Base plan")).toBeInTheDocument();
      expect(plans.deleteTrainingPlan).not.toHaveBeenCalled();
    });

    it("reports a failed reload after a conflict", async () => {
      const staleError = new Error("Precondition Failed");
      vi.mocked(plans.updateTrainingPlan).mockRejectedValue(staleError);
      vi.mocked(plans.isTrainingPlanConflict).mockImplementation((error) => error === staleError);
      renderPlans();
      await screen.findByText("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.edit" }));
      await screen.findByDisplayValue("Base plan");
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.save" }));
      await screen.findByText("trainingPlans.errors.conflict");
      vi.mocked(plans.getTrainingPlan).mockRejectedValue(new Error("offline"));
      fireEvent.click(screen.getByRole("button", { name: "trainingPlans.actions.reload" }));
      expect(await screen.findByText("trainingPlans.errors.loadDetail")).toBeInTheDocument();
    });

    it("offers a retry when the plan list fails to load", async () => {
      vi.mocked(plans.listTrainingPlans).mockRejectedValueOnce(new Error("offline"));
      renderPlans();
      expect(await screen.findByText("trainingPlans.errors.list")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "actions.retry" }));
      expect(await screen.findByText("Base plan")).toBeInTheDocument();
    });
  });
});
