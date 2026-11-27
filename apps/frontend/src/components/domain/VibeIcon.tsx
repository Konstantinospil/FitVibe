import React from "react";
import type { VibeKey } from "../../constants/vibes";
import strengthIcon from "../../assets/icons/earth-strength.svg";
import agilityIcon from "../../assets/icons/air-agility.svg";
import enduranceIcon from "../../assets/icons/water-endurance.svg";
import explosivityIcon from "../../assets/icons/fire-explosivity.svg";
import intelligenceIcon from "../../assets/icons/shadow-intelligence.svg";
import regenerationIcon from "../../assets/icons/aether-regeneration.svg";

const iconByVibe: Record<VibeKey, string> = {
  strength: strengthIcon,
  agility: agilityIcon,
  endurance: enduranceIcon,
  explosivity: explosivityIcon,
  intelligence: intelligenceIcon,
  regeneration: regenerationIcon,
};

/**
 * A Vibe's element icon in its colour. Decorative: name the Vibe in text beside it.
 * Size it from the place that shows it (the badge uses `--vibe-icon-size`).
 */
export const VibeIcon: React.FC<{ vibe: VibeKey }> = ({ vibe }) => {
  // Quoted: small icons are inlined as data URLs with quotes inside, and an
  // unquoted url() holding them is invalid CSS, so the mask would be dropped.
  const mask = `url(${JSON.stringify(iconByVibe[vibe])})`;
  return (
    <span
      aria-hidden="true"
      data-slot="vibe-icon"
      data-vibe={vibe}
      style={{ WebkitMaskImage: mask, maskImage: mask }}
    />
  );
};

VibeIcon.displayName = "VibeIcon";
