import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../../utils/http.js";
import { normalizeSessionExercises, trimToNull } from "./sessions.normalization.js";
import type { SessionBlockUpsertInput, SessionStructure } from "./sessions.repository.js";
import type {
  SessionBlock,
  SessionBlockInput,
  SessionBlockKind,
  SessionExerciseInput,
} from "./sessions.types.js";

/**
 * Interval and circuit blocks (ADR-046, issue 290).
 *
 * A block groups consecutive exercises of a session and says how they repeat.
 * It has no order of its own: its members' `order` places it. Each round of a
 * member is one of that member's ordinary sets, so flat sessions and scoring
 * are unchanged. `rounds` is the prescription: like a planned set count, a
 * member may end up with more sets (an extra round) or fewer (stopped early).
 */

/** The migration's check constraint mirrors these (202611280001_create_session_blocks). */
export const SESSION_BLOCK_LIMITS = {
  maxRounds: 50,
  minWorkSec: 1,
  maxWorkSec: 3600,
  maxRestSec: 3600,
  nameMaxLength: 100,
  /** A circuit moves between exercises; one exercise on repeat is an interval. */
  minCircuitMembers: 2,
  /** One block per exercise at most; mirrors the request's exercise limit. */
  maxBlocks: 50,
} as const;

export const SESSION_BLOCK_KINDS: readonly SessionBlockKind[] = ["interval", "circuit"];

const INVALID_BLOCK = "E.SESSION.INVALID_BLOCK";

function invalidBlock(message: string): HttpError {
  return new HttpError(422, INVALID_BLOCK, message);
}

function normalizeBlock(block: SessionBlockInput): SessionBlockUpsertInput {
  const context = `block ${block.ref}`;
  if (block.kind === "interval" && (block.work_sec === undefined || block.work_sec === null)) {
    throw invalidBlock(`${context}: an interval block needs work_sec`);
  }
  return {
    id: uuidv4(),
    kind: block.kind,
    name: trimToNull(block.name),
    rounds: block.rounds,
    work_sec: block.work_sec ?? null,
    rest_sec: block.rest_sec ?? null,
    round_rest_sec: block.round_rest_sec ?? null,
  };
}

/**
 * Validates a request's exercises and blocks together and links each member to
 * its block. Ranges are checked by the request schema; this checks structure:
 * known refs, at least one member (two for a circuit), and members next to each
 * other in exercise order.
 */
export function normalizeSessionStructure(
  exerciseInputs?: SessionExerciseInput[],
  blockInputs: SessionBlockInput[] = [],
): SessionStructure {
  const exercises = normalizeSessionExercises(exerciseInputs);
  if (!blockInputs.length) {
    const stray = exerciseInputs?.find(
      (exercise) => exercise.block_ref !== undefined && exercise.block_ref !== null,
    );
    if (stray) {
      throw invalidBlock(`exercise ${stray.order}: block_ref ${stray.block_ref} has no block`);
    }
    return { exercises, blocks: [] };
  }

  const blocksByRef = new Map<number, SessionBlockUpsertInput>();
  for (const input of blockInputs) {
    if (blocksByRef.has(input.ref)) {
      throw invalidBlock(`Duplicate block ref ${input.ref}`);
    }
    blocksByRef.set(input.ref, normalizeBlock(input));
  }

  const kindByRef = new Map(blockInputs.map((input) => [input.ref, input.kind]));
  const refByOrder = new Map(
    (exerciseInputs ?? []).map((exercise) => [exercise.order, exercise.block_ref ?? null]),
  );
  const positionsByRef = new Map<number, number[]>();
  exercises.forEach((exercise, position) => {
    const ref = refByOrder.get(exercise.order_index) ?? null;
    if (ref === null) {
      return;
    }
    const block = blocksByRef.get(ref);
    if (!block) {
      throw invalidBlock(`exercise ${exercise.order_index}: block_ref ${ref} has no block`);
    }
    exercise.block_id = block.id;
    positionsByRef.set(ref, [...(positionsByRef.get(ref) ?? []), position]);
  });

  for (const [ref] of blocksByRef) {
    const positions = positionsByRef.get(ref) ?? [];
    const minMembers =
      kindByRef.get(ref) === "circuit" ? SESSION_BLOCK_LIMITS.minCircuitMembers : 1;
    if (positions.length < minMembers) {
      throw invalidBlock(`block ${ref}: needs at least ${minMembers} exercise(s)`);
    }
    const contiguous = positions.every(
      (position, index) => index === 0 || position === positions[index - 1] + 1,
    );
    if (!contiguous) {
      throw invalidBlock(`block ${ref}: its exercises must follow each other`);
    }
  }

  return { exercises, blocks: [...blocksByRef.values()] };
}

/**
 * A stored session's blocks as request input, for copying a session (clone,
 * plan activation). `refOf` gives the ref to put on each member exercise.
 */
export function blockInputsOf(blocks: SessionBlock[]): {
  blocks: SessionBlockInput[];
  refOf: (blockId: string | null | undefined) => number | null;
} {
  const refs = new Map(blocks.map((block, index) => [block.id, index + 1]));
  return {
    blocks: blocks.map((block, index) => ({
      ref: index + 1,
      kind: block.kind,
      name: block.name,
      rounds: block.rounds,
      work_sec: block.work_sec,
      rest_sec: block.rest_sec,
      round_rest_sec: block.round_rest_sec,
    })),
    refOf: (blockId) => (blockId ? (refs.get(blockId) ?? null) : null),
  };
}
