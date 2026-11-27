import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addSessionExercise,
  addSessionSet,
  deleteSession,
  getSession,
  pauseSession,
  recordSet,
  resumeSession,
  skipSessionExercise,
  updateSession,
  type RecordSetRequest,
  type SessionCompletionOutcome,
  type SessionSetPlannedValues,
  type SessionWithExercises,
} from "../../services/sessionApi";
import { generateIdempotencyKey } from "../../utils/idempotency";
import { CALENDAR_QUERY_KEY } from "../scheduling/calendarQuery";
import { liveSessionQueryKey } from "./liveWorkout";

export type LiveCommand =
  | { kind: "start" }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "record"; setId: string; payload: RecordSetRequest }
  | { kind: "addSet"; exerciseRowId: string; planned: SessionSetPlannedValues | null }
  | { kind: "addExercise"; exerciseId: string }
  | { kind: "skipExercise"; exerciseRowId: string };

export type FinishChoice =
  { kind: "save"; outcome: SessionCompletionOutcome } | { kind: "discard" };

/**
 * Data for the live workout (ADR-043). Every command returns the whole session,
 * which replaces the cached one, so the screen always shows what the server stored.
 */
export function useLiveWorkout(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = liveSessionQueryKey(sessionId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => getSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  const store = (session: SessionWithExercises) => {
    queryClient.setQueryData(queryKey, session);
    queryClient.setQueryData(["session-detail", session.id], session);
  };

  const refreshLists = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["home", "recent-sessions"] }),
    ]);

  const command = useMutation({
    mutationFn: (input: LiveCommand): Promise<SessionWithExercises> => {
      const id = sessionId!;
      switch (input.kind) {
        case "start":
          return updateSession(id, { status: "in_progress" });
        case "pause":
          return pauseSession(id);
        case "resume":
          return resumeSession(id);
        case "record":
          return recordSet(id, input.setId, input.payload);
        case "addSet":
          // A new key per action: a retried request then adds the set once.
          return addSessionSet(id, input.exerciseRowId, input.planned, generateIdempotencyKey());
        case "addExercise":
          return addSessionExercise(id, input.exerciseId, generateIdempotencyKey());
        case "skipExercise":
          return skipSessionExercise(id, input.exerciseRowId);
      }
    },
    onSuccess: async (session, input) => {
      store(session);
      if (input.kind === "start") {
        await refreshLists();
      }
    },
  });

  const finish = useMutation({
    mutationFn: async (choice: FinishChoice): Promise<SessionWithExercises | null> => {
      const id = sessionId!;
      if (choice.kind === "discard") {
        await deleteSession(id);
        return null;
      }
      return updateSession(id, { status: "completed", completion_outcome: choice.outcome });
    },
    onSuccess: async (session) => {
      if (session) {
        store(session);
      } else {
        queryClient.removeQueries({ queryKey });
        queryClient.removeQueries({ queryKey: ["session-detail", sessionId] });
      }
      await refreshLists();
    },
  });

  return { query, command, finish };
}
