import type React from "react";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, InputControl, MetricCard, SelectControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { TrainingPanel } from "./TrainingSurface";
import { FormActions, FormFeedback, FormStack } from "./FormStack";
import { TRAINING_DATA_CONFIG } from "../../config/trainingSurfaces";
import {
  INTAKE_KINDS,
  INTAKE_MAX_AMOUNT,
  intakeTotal,
  parseIntakeAmount,
} from "../../lib/sessions/intake";
import {
  addIntakeEntry,
  deleteIntakeEntry,
  type IntakeKind,
  type SessionIntake,
  type SessionStatus,
} from "../../services/sessionApi";

export interface SessionIntakePanelProps {
  sessionId: string;
  intake: SessionIntake;
  status: SessionStatus;
  onChanged: (intake: SessionIntake) => void;
}

/** Intake can be recorded once a workout has started, and corrected after (as on the server). */
const RECORDABLE_STATUSES: ReadonlySet<SessionStatus> = new Set(["in_progress", "completed"]);

/** The amount with its unit, such as "500 ml" or "90 kcal". */
const useIntakeAmount = () => {
  const { t } = useTranslation();
  return (kind: IntakeKind, amount: number) => t(`workoutIntake.amount.${kind}`, { amount });
};

/**
 * Water and food energy for a workout (ADR-045): totals, quick water buttons, an
 * entry form and the entries recorded so far. Used during the live workout and
 * on the session page; it never touches the workout's own calories.
 */
export const SessionIntakePanel: React.FC<SessionIntakePanelProps> = ({
  sessionId,
  intake,
  status,
  onChanged,
}) => {
  const { t, i18n } = useTranslation();
  const editable = RECORDABLE_STATUSES.has(status);
  const formatAmount = useIntakeAmount();
  const [kind, setKind] = useState<IntakeKind>("water");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const time = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }),
    [i18n.language],
  );

  const add = useMutation({
    mutationFn: (entry: { kind: IntakeKind; amount: number }) => addIntakeEntry(sessionId, entry),
    onSuccess: (updated) => {
      onChanged(updated);
      setAmount("");
      setError(null);
    },
    onError: () => setError(t("workoutIntake.saveError")),
  });
  const remove = useMutation({
    mutationFn: (entryId: string) => deleteIntakeEntry(sessionId, entryId),
    onSuccess: (updated) => {
      onChanged(updated);
      setError(null);
    },
    onError: () => setError(t("workoutIntake.removeError")),
  });
  const busy = add.isPending || remove.isPending;
  if (!editable && intake.entries.length === 0) {
    return null;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = parseIntakeAmount(kind, amount);
    if (value === null) {
      setError(t(`workoutIntake.invalid.${kind}`, { max: INTAKE_MAX_AMOUNT[kind] }));
      return;
    }
    add.mutate({ kind, amount: value });
  };

  return (
    <TrainingPanel title={t("workoutIntake.title")}>
      <div className="metric-card-grid">
        {INTAKE_KINDS.map((each) => (
          <MetricCard
            key={each}
            label={t(`workoutIntake.kind.${each}`)}
            value={formatAmount(each, intakeTotal(intake, each))}
          />
        ))}
      </div>
      {editable ? (
        <>
          <FormActions>
            {TRAINING_DATA_CONFIG.intakeWaterQuickAddMl.map((ml) => (
              <Button
                key={ml}
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => add.mutate({ kind: "water", amount: ml })}
              >
                {t("workoutIntake.quickWater", { amount: formatAmount("water", ml) })}
              </Button>
            ))}
          </FormActions>
          <FormStack noValidate onSubmit={submit}>
            <div className="set-fields">
              <label className="form-label">
                <span className="form-label-text">{t("workoutIntake.fields.kind")}</span>
                <SelectControl
                  value={kind}
                  disabled={busy}
                  onChange={(event) => setKind(event.target.value as IntakeKind)}
                >
                  {INTAKE_KINDS.map((each) => (
                    <option key={each} value={each}>
                      {t(`workoutIntake.kind.${each}`)}
                    </option>
                  ))}
                </SelectControl>
              </label>
              <label className="form-label">
                <span className="form-label-text">{t(`workoutIntake.fields.amount.${kind}`)}</span>
                <InputControl
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={INTAKE_MAX_AMOUNT[kind]}
                  step={1}
                  value={amount}
                  disabled={busy}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            </div>
            <FormActions>
              <Button type="submit" isLoading={add.isPending} disabled={!amount.trim()}>
                {t("workoutIntake.add")}
              </Button>
            </FormActions>
          </FormStack>
        </>
      ) : null}
      {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
      {intake.entries.length > 0 ? (
        <ul className="stack-list" aria-label={t("workoutIntake.entries")}>
          {intake.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex--align-center flex--justify-between flex--gap-sm"
            >
              <span>
                {t(`workoutIntake.entry.${entry.kind}`, {
                  amount: formatAmount(entry.kind, entry.amount),
                  time: time.format(new Date(entry.recorded_at)),
                })}
              </span>
              {editable ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  aria-label={t("workoutIntake.removeEntry", {
                    amount: formatAmount(entry.kind, entry.amount),
                  })}
                  onClick={() => remove.mutate(entry.id)}
                >
                  {t("workoutIntake.remove")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="typography-supporting text-secondary">{t("workoutIntake.empty")}</p>
      )}
    </TrainingPanel>
  );
};
