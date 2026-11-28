import type { TFunction } from "i18next";
import type { SessionBlock, SessionWithExercises } from "../../services/sessionApi";
import { joinMetrics } from "./setSummary";

/**
 * Interval and circuit blocks (ADR-046), shown the same way on the session page
 * and in the live workout: a header card before a block's first exercise.
 */

/** The block a session's exercise opens, by exercise id; members after the first are absent. */
export function blocksByFirstExercise(session: SessionWithExercises): Map<string, SessionBlock> {
  const blocks = new Map((session.blocks ?? []).map((block) => [block.id, block]));
  const opened = new Map<string, SessionBlock>();
  const seen = new Set<string>();
  for (const exercise of session.exercises) {
    const block = exercise.block_id ? blocks.get(exercise.block_id) : undefined;
    if (block && !seen.has(block.id)) {
      seen.add(block.id);
      opened.set(exercise.id, block);
    }
  }
  return opened;
}

/** Rounds, work and rest of a block, e.g. "8 rounds · Work: 20 s · Rest: 10 s". */
export function blockSummary(t: TFunction, block: Omit<SessionBlock, "id" | "name">) {
  return joinMetrics([
    t("sessionBlocks.rounds", { count: block.rounds }),
    block.work_sec === null ? null : t("sessionBlocks.work", { value: block.work_sec }),
    block.rest_sec === null ? null : t("sessionDetail.rest", { value: block.rest_sec }),
    block.round_rest_sec === null
      ? null
      : t("sessionBlocks.roundRest", { value: block.round_rest_sec }),
  ]);
}

/** Props for the TrainingSummaryCard that heads a block. */
export function blockCardProps(t: TFunction, block: SessionBlock) {
  const kind = t(`sessionBlocks.kind.${block.kind}`);
  return { title: block.name || kind, meta: kind, supporting: blockSummary(t, block) };
}
