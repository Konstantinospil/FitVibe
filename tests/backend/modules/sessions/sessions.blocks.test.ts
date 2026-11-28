import {
  SESSION_BLOCK_LIMITS,
  blockInputsOf,
  normalizeSessionStructure,
} from "../../../../apps/backend/src/modules/sessions/sessions.blocks.js";
import type {
  SessionBlock,
  SessionBlockInput,
  SessionExerciseInput,
} from "../../../../apps/backend/src/modules/sessions/sessions.types.js";

const exercise = (order: number, blockRef?: number | null): SessionExerciseInput => ({
  order,
  exercise_id: `00000000-0000-4000-8000-00000000000${order}`,
  block_ref: blockRef,
  sets: [{ order: 1, planned: { duration_sec: 20 } }],
});

const tabata: SessionBlockInput = {
  ref: 1,
  kind: "interval",
  name: " Tabata ",
  rounds: 8,
  work_sec: 20,
  rest_sec: 10,
};

const circuit: SessionBlockInput = { ref: 2, kind: "circuit", rounds: 3, round_rest_sec: 60 };

describe("normalizeSessionStructure (ADR-046)", () => {
  it("keeps a flat session flat", () => {
    const structure = normalizeSessionStructure([exercise(1), exercise(2)]);
    expect(structure.blocks).toEqual([]);
    expect(structure.exercises.map((item) => item.block_id)).toEqual([null, null]);
  });

  it("links members to their block and leaves other exercises flat", () => {
    const structure = normalizeSessionStructure(
      [exercise(1), exercise(2, 1), exercise(3, 2), exercise(4, 2), exercise(5)],
      [tabata, circuit],
    );
    const [interval, rounds] = structure.blocks;
    expect(interval).toMatchObject({
      kind: "interval",
      name: "Tabata",
      rounds: 8,
      work_sec: 20,
      rest_sec: 10,
      round_rest_sec: null,
    });
    expect(rounds).toMatchObject({ kind: "circuit", rounds: 3, work_sec: null });
    expect(structure.exercises.map((item) => item.block_id)).toEqual([
      null,
      interval.id,
      rounds.id,
      rounds.id,
      null,
    ]);
  });

  it("links by exercise order, whatever order the request lists them in", () => {
    const structure = normalizeSessionStructure(
      [exercise(4, 2), exercise(3, 2), exercise(1)],
      [circuit],
    );
    expect(structure.exercises.map((item) => [item.order_index, item.block_id !== null])).toEqual([
      [1, false],
      [3, true],
      [4, true],
    ]);
  });

  it("does not limit a member's sets to the block's rounds", () => {
    const extraRound = {
      ...exercise(1, 1),
      sets: Array.from({ length: tabata.rounds + 1 }, (_, index) => ({ order: index + 1 })),
    };
    expect(() => normalizeSessionStructure([extraRound], [tabata])).not.toThrow();
  });

  it.each([
    ["an unknown block ref", [exercise(1, 3)], [tabata], "block_ref 3 has no block"],
    ["a block ref without blocks", [exercise(1, 1)], [], "block_ref 1 has no block"],
    ["a duplicate block ref", [exercise(1, 1)], [tabata, { ...tabata }], "Duplicate block ref 1"],
    [
      "an interval without work",
      [exercise(1, 1)],
      [{ ...tabata, work_sec: null }],
      "needs work_sec",
    ],
    ["a block without members", [exercise(1)], [tabata], "needs at least 1 exercise"],
    [
      "a circuit of one exercise",
      [exercise(1, 2)],
      [circuit],
      `needs at least ${SESSION_BLOCK_LIMITS.minCircuitMembers} exercise`,
    ],
    [
      "members that do not follow each other",
      [exercise(1, 2), exercise(2), exercise(3, 2)],
      [circuit],
      "must follow each other",
    ],
  ])("refuses %s", (_label, exercises, blocks, message) => {
    expect(() => normalizeSessionStructure(exercises, blocks)).toThrow(
      expect.objectContaining({ status: 422, code: "E.SESSION.INVALID_BLOCK" }),
    );
    expect(() => normalizeSessionStructure(exercises, blocks)).toThrow(message);
  });
});

describe("blockInputsOf (ADR-046)", () => {
  const stored: SessionBlock[] = [
    {
      id: "block-a",
      kind: "interval",
      name: "Tabata",
      rounds: 8,
      work_sec: 20,
      rest_sec: 10,
      round_rest_sec: null,
    },
    {
      id: "block-b",
      kind: "circuit",
      name: null,
      rounds: 3,
      work_sec: null,
      rest_sec: null,
      round_rest_sec: 60,
    },
  ];

  it("turns stored blocks into request input with fresh refs", () => {
    const { blocks, refOf } = blockInputsOf(stored);
    expect(blocks.map((block) => [block.ref, block.kind, block.rounds])).toEqual([
      [1, "interval", 8],
      [2, "circuit", 3],
    ]);
    expect([refOf("block-a"), refOf("block-b"), refOf(null), refOf("other")]).toEqual([
      1,
      2,
      null,
      null,
    ]);
  });

  it("round-trips a stored structure into an equivalent copy", () => {
    const { blocks, refOf } = blockInputsOf(stored);
    const copy = normalizeSessionStructure(
      [
        { ...exercise(1), block_ref: refOf("block-a") },
        { ...exercise(2), block_ref: refOf("block-b") },
        { ...exercise(3), block_ref: refOf("block-b") },
      ],
      blocks,
    );
    expect(copy.blocks.map(({ id: _id, ...values }) => values)).toEqual(
      stored.map(({ id: _id, ...values }) => values),
    );
    expect(new Set(copy.blocks.map((block) => block.id))).not.toContain("block-a");
  });
});
