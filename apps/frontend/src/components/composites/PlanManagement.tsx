import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  createTrainingPlan,
  deleteTrainingPlan,
  getTrainingPlan,
  isTrainingPlanConflict,
  listTrainingPlans,
  updateTrainingPlan,
  type TrainingPlan,
  type TrainingPlanInput,
} from "../../services/planApi";
import { logger } from "../../utils/logger";
import { ConfirmDialog } from "../ConfirmDialog";
import { FormActions, FormFeedback, FormStack } from "./FormStack";
import { Modal } from "./Modal";
import { Section, SectionHeader } from "./Section";
import { RetryErrorPanel, StatusPanel } from "./StatusPanel";
import { TrainingSummaryCard } from "./TrainingSurface";

interface PlanManagementProps {
  open: boolean;
  onClose: () => void;
}

interface PlanDraft {
  id?: string;
  etag?: string;
  name: string;
  startDate: string;
  endDate: string;
}

const planDraft = (plan: TrainingPlan, etag: string): PlanDraft => ({
  id: plan.id,
  etag,
  name: plan.name,
  startDate: plan.start_date?.slice(0, 10) ?? "",
  endDate: plan.end_date?.slice(0, 10) ?? "",
});

const emptyDraft = (): PlanDraft => ({
  name: "",
  startDate: "",
  endDate: "",
});

const PlanManagement: React.FC<PlanManagementProps> = ({ open, onClose }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const plans = useQuery({
    queryKey: ["training-plans"],
    queryFn: listTrainingPlans,
    enabled: open,
  });
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TrainingPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const resetMessages = () => {
    setError(null);
    setConflict(false);
  };

  const dismiss = () => {
    if (busy) {
      return;
    }
    setDraft(null);
    resetMessages();
    onClose();
  };

  const dateLabel = (date: string | null) =>
    date
      ? new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(date.slice(0, 10)))
      : t("trainingPlans.noDate");

  const editPlan = async (plan: TrainingPlan) => {
    setBusy(true);
    resetMessages();
    try {
      const latest = await getTrainingPlan(plan.id);
      setDraft(planDraft(latest.plan, latest.etag));
    } catch (cause) {
      setError(t("trainingPlans.errors.loadDetail"));
      logger.apiError("Failed to fetch plan for editing", cause, `/api/v1/plans/${plan.id}`, "GET");
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || busy) {
      return;
    }
    if (!draft.name.trim()) {
      setError(t("trainingPlans.errors.required"));
      return;
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      setError(t("trainingPlans.errors.dateOrder"));
      return;
    }
    const input: TrainingPlanInput = {
      name: draft.name.trim(),
      start_date: draft.startDate || null,
      end_date: draft.endDate || null,
    };
    setBusy(true);
    resetMessages();
    try {
      if (draft.id) {
        if (!draft.etag) {
          throw new Error("Cannot save a plan without its version");
        }
        await updateTrainingPlan(draft.id, input, draft.etag);
      } else {
        await createTrainingPlan(input);
      }
      await queryClient.invalidateQueries({ queryKey: ["training-plans"] });
      setDraft(null);
    } catch (cause) {
      if (isTrainingPlanConflict(cause)) {
        setConflict(true);
      } else {
        setError(t("trainingPlans.errors.save"));
      }
      logger.apiError(
        "Failed to save training plan",
        cause,
        draft.id ? `/api/v1/plans/${draft.id}` : "/api/v1/plans",
        draft.id ? "PATCH" : "POST",
      );
    } finally {
      setBusy(false);
    }
  };

  const deletePlan = async () => {
    if (!pendingDelete || busy) {
      return;
    }
    const id = pendingDelete.id;
    setBusy(true);
    resetMessages();
    try {
      await deleteTrainingPlan(id);
      await queryClient.invalidateQueries({ queryKey: ["training-plans"] });
    } catch (cause) {
      setError(t("trainingPlans.errors.delete"));
      logger.apiError("Failed to archive training plan", cause, `/api/v1/plans/${id}`, "DELETE");
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  const reloadPlan = async () => {
    if (!draft?.id || busy) {
      return;
    }
    const id = draft.id;
    setBusy(true);
    try {
      const latest = await getTrainingPlan(id);
      setDraft(planDraft(latest.plan, latest.etag));
      resetMessages();
      await queryClient.invalidateQueries({ queryKey: ["training-plans"] });
    } catch (cause) {
      setError(t("trainingPlans.errors.loadDetail"));
      logger.apiError("Failed to reload updated plan", cause, `/api/v1/plans/${id}`, "GET");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open && !pendingDelete}
        title={
          draft
            ? t(draft.id ? "trainingPlans.editTitle" : "trainingPlans.createTitle")
            : t("trainingPlans.title")
        }
        description={t("trainingPlans.description")}
        closeLabel={t("trainingPlans.actions.close")}
        onClose={dismiss}
        closeOnBackdrop={!busy}
        width="lg"
        footer={
          draft ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  resetMessages();
                }}
              >
                {t("trainingPlans.actions.cancel")}
              </Button>
              <Button type="submit" form="training-plan-form" isLoading={busy} disabled={conflict}>
                {t("trainingPlans.actions.save")}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                resetMessages();
                setDraft(emptyDraft());
              }}
            >
              {t("trainingPlans.actions.create")}
            </Button>
          )
        }
      >
        <Section>
          {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
          {draft ? (
            <FormStack id="training-plan-form" onSubmit={(event) => void savePlan(event)}>
              {conflict ? (
                <StatusPanel
                  kind="warning"
                  actions={
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void reloadPlan()}
                      disabled={busy}
                    >
                      {t("trainingPlans.actions.reload")}
                    </Button>
                  }
                >
                  {t("trainingPlans.errors.conflict")}
                </StatusPanel>
              ) : null}
              <label className="form-label">
                <span className="form-label-text">{t("trainingPlans.fields.name")}</span>
                <InputControl
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  maxLength={200}
                  disabled={busy}
                />
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("trainingPlans.fields.startDate")}</span>
                <InputControl
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                  disabled={busy}
                />
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("trainingPlans.fields.endDate")}</span>
                <InputControl
                  type="date"
                  value={draft.endDate}
                  onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                  min={draft.startDate || undefined}
                  disabled={busy}
                />
              </label>
            </FormStack>
          ) : (
            <Section>
              <SectionHeader title={t("trainingPlans.listTitle")} />
              {plans.isPending ? (
                <StatusPanel kind="loading">{t("trainingPlans.loading")}</StatusPanel>
              ) : null}
              {plans.isError ? (
                <RetryErrorPanel
                  message={t("trainingPlans.errors.list")}
                  retryLabel={t("actions.retry")}
                  onRetry={() => void plans.refetch()}
                  isRetrying={plans.isFetching}
                />
              ) : null}
              {plans.isSuccess && plans.data.length === 0 ? (
                <div className="training-empty">{t("trainingPlans.empty")}</div>
              ) : null}
              {plans.data?.map((plan) => (
                <TrainingSummaryCard
                  key={plan.id}
                  title={plan.name}
                  meta={t("trainingPlans.dateRange", {
                    start: dateLabel(plan.start_date),
                    end: dateLabel(plan.end_date),
                  })}
                  supporting={t("trainingPlans.sessionCount", { count: plan.session_count })}
                  trailing={
                    <FormActions>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void editPlan(plan)}
                      >
                        {t("trainingPlans.actions.edit")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          resetMessages();
                          setPendingDelete(plan);
                        }}
                      >
                        {t("trainingPlans.actions.delete")}
                      </Button>
                    </FormActions>
                  }
                />
              ))}
            </Section>
          )}
        </Section>
      </Modal>
      <ConfirmDialog
        isOpen={open && pendingDelete !== null}
        title={t("trainingPlans.delete.title")}
        message={t("trainingPlans.delete.message", { name: pendingDelete?.name })}
        confirmLabel={t("trainingPlans.actions.delete")}
        cancelLabel={t("trainingPlans.actions.cancel")}
        variant="danger"
        onConfirm={() => void deletePlan()}
        onCancel={() => {
          if (!busy) {
            setPendingDelete(null);
          }
        }}
      />
    </>
  );
};

export default PlanManagement;
