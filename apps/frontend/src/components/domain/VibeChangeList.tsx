import React from "react";
import { useTranslation } from "react-i18next";
import { VIBE_KEYS, type VibeKey } from "../../constants/vibes";
import { VibeIcon } from "./VibeIcon";

export interface VibeChange {
  vibe: VibeKey;
  newLevel: number;
  change: number;
}

/**
 * The Vibe levels a workout moved (issue 289): each Vibe with its new level and the
 * change. It shows what the server awarded; how levels are calculated stays there.
 */
export const VibeChangeList: React.FC<{ changes: VibeChange[] }> = ({ changes }) => {
  const { t, i18n } = useTranslation();
  const level = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
  const change = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  // The Vibes in their usual order, not the server's.
  const ordered = [...changes].sort(
    (a, b) => VIBE_KEYS.indexOf(a.vibe) - VIBE_KEYS.indexOf(b.vibe),
  );

  return (
    <ul className="vibe-change-list">
      {ordered.map((item) => (
        <li
          key={item.vibe}
          className="vibe-change-list__item"
          data-direction={Math.sign(item.change)}
        >
          <VibeIcon vibe={item.vibe} />
          <span className="vibe-change-list__name">{t(`vibes.${item.vibe}.name`)}</span>
          <span className="vibe-change-list__level">
            {t("vibeChanges.level", { value: level.format(item.newLevel) })}
          </span>
          <span className="vibe-change-list__change">{change.format(item.change)}</span>
        </li>
      ))}
    </ul>
  );
};

VibeChangeList.displayName = "VibeChangeList";
