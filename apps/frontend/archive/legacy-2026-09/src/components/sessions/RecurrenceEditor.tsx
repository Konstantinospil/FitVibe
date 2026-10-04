import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../ui/Select";
import { Checkbox } from "../ui/Checkbox";
import { Input } from "../ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Alert } from "../ui/Alert";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number;
  endDate?: string;
  occurrences?: number;
}

export interface RecurrenceEditorProps {
  value?: RecurrenceRule | null;
  onChange?: (rule: RecurrenceRule | null) => void;
}

/**
 * RecurrenceEditor component for configuring recurring session schedules.
 * Supports daily, weekly, monthly, and yearly recurrence patterns.
 */
export const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({ value, onChange }) => {
  const { t } = useTranslation("common");
  const [enabled, setEnabled] = useState(!!value);

  const [rule, setRule] = useState<RecurrenceRule>(
    value || {
      frequency: "weekly",
      interval: 1,
      daysOfWeek: [],
    },
  );

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    if (checked) {
      onChange?.(rule);
    } else {
      onChange?.(null);
    }
  };

  const updateRule = (updates: Partial<RecurrenceRule>) => {
    const newRule = { ...rule, ...updates };
    setRule(newRule);
    if (enabled) {
      onChange?.(newRule);
    }
  };

  const frequencyOptions = [
    { value: "daily", label: t("recurrence.daily") || "Daily" },
    { value: "weekly", label: t("recurrence.weekly") || "Weekly" },
    { value: "monthly", label: t("recurrence.monthly") || "Monthly" },
    { value: "yearly", label: t("recurrence.yearly") || "Yearly" },
  ];

  const dayOptions = [
    { value: "0", label: t("calendar.sunday") || "Sunday" },
    { value: "1", label: t("calendar.monday") || "Monday" },
    { value: "2", label: t("calendar.tuesday") || "Tuesday" },
    { value: "3", label: t("calendar.wednesday") || "Wednesday" },
    { value: "4", label: t("calendar.thursday") || "Thursday" },
    { value: "5", label: t("calendar.friday") || "Friday" },
    { value: "6", label: t("calendar.saturday") || "Saturday" },
  ];

  const handleDayToggle = (day: number) => {
    const currentDays = rule.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();
    updateRule({ daysOfWeek: newDays });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("recurrence.title") || "Recurrence"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex--column flex--gap-lg">
          <Checkbox
            label={t("recurrence.enable") || "Repeat this session"}
            checked={enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
          />

          {enabled && (
            <>
              <Select
                label={t("recurrence.frequency") || "Frequency"}
                options={frequencyOptions}
                value={rule.frequency}
                onChange={(e) => updateRule({ frequency: e.target.value as RecurrenceFrequency })}
              />

              <Input
                label={t("recurrence.interval") || "Repeat Every"}
                type="number"
                value={rule.interval.toString()}
                onChange={(e) => {
                  const interval = parseInt(e.target.value, 10) || 1;
                  updateRule({ interval: Math.max(1, interval) });
                }}
                min={1}
                helperText={
                  rule.frequency === "daily"
                    ? t("recurrence.intervalDays") || "days"
                    : rule.frequency === "weekly"
                      ? t("recurrence.intervalWeeks") || "weeks"
                      : rule.frequency === "monthly"
                        ? t("recurrence.intervalMonths") || "months"
                        : t("recurrence.intervalYears") || "years"
                }
              />

              {rule.frequency === "weekly" && (
                <div>
                  <label className="text-sm font-weight-600 block mb-sm">
                    {t("recurrence.daysOfWeek") || "Days of Week"}
                  </label>
                  <div className="flex flex--wrap flex--gap-sm">
                    {dayOptions.map((day) => {
                      const dayNum = parseInt(day.value, 10);
                      return (
                        <Checkbox
                          key={day.value}
                          label={day.label}
                          checked={(rule.daysOfWeek || []).includes(dayNum)}
                          onChange={() => handleDayToggle(dayNum)}
                        />
                      );
                    })}
                  </div>
                  {(rule.daysOfWeek || []).length === 0 && (
                    <Alert variant="warning" style={{ marginTop: "var(--space-sm)" }}>
                      {t("recurrence.selectAtLeastOneDay") || "Please select at least one day"}
                    </Alert>
                  )}
                </div>
              )}

              {rule.frequency === "monthly" && (
                <Input
                  label={t("recurrence.dayOfMonth") || "Day of Month"}
                  type="number"
                  value={rule.dayOfMonth?.toString() || ""}
                  onChange={(e) => {
                    const day = parseInt(e.target.value, 10);
                    if (day >= 1 && day <= 31) {
                      updateRule({ dayOfMonth: day });
                    }
                  }}
                  min={1}
                  max={31}
                  helperText={t("recurrence.dayOfMonthHelper") || "Day of the month (1-31)"}
                />
              )}

              <div className="flex flex--column flex--gap-sm">
                <label className="text-sm font-weight-600">
                  {t("recurrence.endCondition") || "End Condition"}
                </label>
                <div className="flex flex--column flex--gap-sm">
                  <Input
                    label={t("recurrence.endDate") || "End Date (optional)"}
                    type="date"
                    value={rule.endDate || ""}
                    onChange={(e) => updateRule({ endDate: e.target.value || undefined })}
                  />
                  <div className="text-xs text-secondary" style={{ marginTop: "-var(--space-sm)" }}>
                    {t("recurrence.or") || "or"}
                  </div>
                  <Input
                    label={t("recurrence.occurrences") || "Number of Occurrences (optional)"}
                    type="number"
                    value={rule.occurrences?.toString() || ""}
                    onChange={(e) => {
                      const occurrences = parseInt(e.target.value, 10);
                      if (occurrences > 0) {
                        updateRule({ occurrences });
                      } else {
                        updateRule({ occurrences: undefined });
                      }
                    }}
                    min={1}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
