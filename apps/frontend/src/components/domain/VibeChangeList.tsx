import React from "react";
import { useTranslation } from "react-i18next";
import { MetricCard } from "@fitvibe/ui";
import { VIBE_KEYS, type VibeKey } from "../../constants/vibes";
import { VibeIcon } from "./VibeIcon";

export interface VibeChange {
  vibe: VibeKey;
  newLevel: number;
  change: number;
}

/** Levels are shown as whole numbers; changes keep one decimal so small moves show. */
const LEVEL_DECIMALS = 0;
const CHANGE_DECIMALS = 1;

/**
 * The Vibe levels a workout moved (issue 289): one metric card per Vibe, with the
 * change as its value and the new level below. It shows what the server awarded;
 * how levels are calculated stays there.
 */
export const VibeChangeList: React.FC<{ changes: VibeChange[] }> = ({ changes }) => {
  const { t, i18n } = useTranslation();
  const level = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: LEVEL_DECIMALS });
  const change = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: CHANGE_DECIMALS,
    signDisplay: "exceptZero",
  });
  // The Vibes in their usual order, not the server's.
  const ordered = [...changes].sort(
    (a, b) => VIBE_KEYS.indexOf(a.vibe) - VIBE_KEYS.indexOf(b.vibe),
  );

  return (
    <ul className="metric-card-grid vibe-change-list">
      {ordered.map((item) => (
        <li key={item.vibe}>
          <MetricCard
            label={
              <span className="vibe-change-list__label">
                <VibeIcon vibe={item.vibe} />
                {t(`vibes.${item.vibe}.name`)}
              </span>
            }
            value={change.format(item.change)}
            supportingText={t("vibeChanges.level", { value: level.format(item.newLevel) })}
          />
        </li>
      ))}
    </ul>
  );
};

VibeChangeList.displayName = "VibeChangeList";
