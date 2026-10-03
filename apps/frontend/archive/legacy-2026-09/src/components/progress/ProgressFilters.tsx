import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import DateRangePicker, { type DateRange } from "../DateRangePicker";

export type ProgressGroupBy = "day" | "week" | "month";

export interface ProgressFiltersProps {
  rangeMode: "preset" | "custom";
  onRangeModeChange: (mode: "preset" | "custom") => void;
  period: number;
  onPeriodChange: (period: number) => void;
  customRange: DateRange;
  onCustomRangeChange: (range: DateRange) => void;
  groupBy: ProgressGroupBy;
  onGroupByChange: (groupBy: ProgressGroupBy) => void;
  onExport?: () => void;
  isExporting?: boolean;
}

/**
 * ProgressFilters component for filtering progress data.
 * Supports preset periods, custom date ranges, and grouping options.
 */
export const ProgressFilters: React.FC<ProgressFiltersProps> = ({
  rangeMode,
  onRangeModeChange,
  period,
  onPeriodChange,
  customRange,
  onCustomRangeChange,
  groupBy,
  onGroupByChange,
  onExport,
  isExporting = false,
}) => {
  const { t } = useTranslation("common");

  const selectStyle: React.CSSProperties = {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid var(--color-border)",
    background: "var(--color-input-bg)",
    color: "var(--color-text-primary)",
    fontSize: "0.9rem",
    cursor: "pointer",
  };

  return (
    <Card>
      <CardContent>
        <div className="flex flex--column flex--gap-md">
          {/* Range Mode Toggle */}
          <div className="flex flex--gap-sm">
            <Button
              type="button"
              variant={rangeMode === "preset" ? "primary" : "ghost"}
              size="sm"
              onClick={() => onRangeModeChange("preset")}
            >
              {t("progress.presetRange")}
            </Button>
            <Button
              type="button"
              variant={rangeMode === "custom" ? "primary" : "ghost"}
              size="sm"
              onClick={() => onRangeModeChange("custom")}
            >
              {t("progress.customRange")}
            </Button>
          </div>

          {/* Controls Row */}
          <div
            className="flex flex--justify-between flex--align-center flex--wrap"
            style={{ gap: "1rem" }}
          >
            <div className="flex flex--gap-md flex--align-center flex--wrap">
              {rangeMode === "preset" ? (
                <label className="flex flex--align-center flex--gap-sm">
                  <span className="text-sm text-secondary">{t("progress.period")}:</span>
                  <select
                    style={selectStyle}
                    value={period}
                    onChange={(e) => onPeriodChange(Number(e.target.value))}
                  >
                    <option value={7}>{t("progress.7days")}</option>
                    <option value={30}>{t("progress.30days")}</option>
                    <option value={90}>{t("progress.90days")}</option>
                  </select>
                </label>
              ) : (
                <DateRangePicker value={customRange} onChange={onCustomRangeChange} />
              )}
              <label className="flex flex--align-center flex--gap-sm">
                <span className="text-sm text-secondary">{t("progress.groupBy")}:</span>
                <select
                  style={selectStyle}
                  value={groupBy}
                  onChange={(e) => onGroupByChange(e.target.value as ProgressGroupBy)}
                >
                  <option value="day">{t("progress.daily")}</option>
                  <option value="week">{t("progress.weekly")}</option>
                  <option value="month">{t("progress.monthly") || "Monthly"}</option>
                </select>
              </label>
            </div>
            {onExport && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onExport}
                isLoading={isExporting}
                disabled={isExporting}
              >
                {t("progress.exportCsv")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
