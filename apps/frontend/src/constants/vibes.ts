export type VibeKey =
  "strength" | "agility" | "endurance" | "explosivity" | "intelligence" | "regeneration";

/** The six Vibes in their canonical order. */
export const VIBE_KEYS: readonly VibeKey[] = [
  "strength",
  "agility",
  "endurance",
  "explosivity",
  "intelligence",
  "regeneration",
];

export const isVibeKey = (value: string): value is VibeKey =>
  (VIBE_KEYS as readonly string[]).includes(value);

export const VIBE_TYPE_CODE_MAP: Record<VibeKey, string> = {
  strength: "strength",
  agility: "balance",
  endurance: "endurance",
  explosivity: "plyometrics",
  intelligence: "skill",
  regeneration: "recovery",
};

export const TYPE_CODE_TO_VIBE = Object.entries(VIBE_TYPE_CODE_MAP).reduce(
  (acc, [vibe, typeCode]) => {
    acc[typeCode] = vibe as VibeKey;
    return acc;
  },
  {} as Record<string, VibeKey>,
);
