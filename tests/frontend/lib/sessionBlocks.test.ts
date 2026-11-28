import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import {
  blockCardProps,
  blockSummary,
  blocksByFirstExercise,
} from "../../../apps/frontend/src/lib/sessions/blocks";
import type {
  SessionBlock,
  SessionExercise,
  SessionWithExercises,
} from "../../../apps/frontend/src/services/sessionApi";

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}=${String(options.value ?? options.count)}` : key) as unknown as TFunction;

const interval: SessionBlock = {
  id: "block-a",
  kind: "interval",
  name: null,
  rounds: 8,
  work_sec: 20,
  rest_sec: 10,
  round_rest_sec: null,
};
const circuit: SessionBlock = {
  id: "block-b",
  kind: "circuit",
  name: "Finisher",
  rounds: 3,
  work_sec: null,
  rest_sec: null,
  round_rest_sec: 60,
};

const exercise = (id: string, blockId: string | null = null): SessionExercise => ({
  id,
  session_id: "session-1",
  order_index: 1,
  status: "planned",
  source: "prescribed",
  block_id: blockId,
  sets: [],
});

const session = (exercises: SessionExercise[], blocks: SessionBlock[]) =>
  ({
    id: "session-1",
    owner_id: "user-1",
    planned_at: "2026-12-01T17:00:00.000Z",
    planned_duration_min: 60,
    status: "planned",
    visibility: "private",
    exercises,
    blocks,
  }) as SessionWithExercises;

describe("session blocks (ADR-046)", () => {
  it("opens each block at its first exercise only", () => {
    const opened = blocksByFirstExercise(
      session(
        [
          exercise("warm-up"),
          exercise("a1", "block-a"),
          exercise("b1", "block-b"),
          exercise("b2", "block-b"),
        ],
        [interval, circuit],
      ),
    );
    expect([...opened.entries()].map(([id, block]) => [id, block.id])).toEqual([
      ["a1", "block-a"],
      ["b1", "block-b"],
    ]);
  });

  it("has nothing to open for a flat session or one without blocks loaded", () => {
    expect(blocksByFirstExercise(session([exercise("one")], [])).size).toBe(0);
    expect(blocksByFirstExercise(session([exercise("a1", "block-a")], [])).size).toBe(0);
  });

  it("summarises only the values a block has", () => {
    expect(blockSummary(t, interval)).toBe(
      "sessionBlocks.rounds=8 · sessionBlocks.work=20 · sessionDetail.rest=10",
    );
    expect(blockSummary(t, circuit)).toBe("sessionBlocks.rounds=3 · sessionBlocks.roundRest=60");
  });

  it("titles a block by its name, or by its kind when it has none", () => {
    expect(blockCardProps(t, circuit)).toMatchObject({
      title: "Finisher",
      meta: "sessionBlocks.kind.circuit",
    });
    expect(blockCardProps(t, interval).title).toBe("sessionBlocks.kind.interval");
  });
});
