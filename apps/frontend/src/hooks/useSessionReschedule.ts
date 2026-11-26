import { useCallback } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  getScheduleConflictIds,
  updateSession,
  type SessionListItem,
  type SessionsListResponse,
} from "../services/sessionApi";
import { durationOf, findScheduleConflicts } from "../lib/scheduling/sessionSchedule";
import { logger } from "../utils/logger";

/** Every cached calendar window starts with this key segment. */
export const CALENDAR_QUERY_KEY = ["calendar"] as const;

/** Where a session should be: its start and its planned length in minutes. */
export interface SessionSchedule {
  plannedAt: string;
  durationMin: number;
}

export type RescheduleResult =
  | ({ status: "saved" } & SessionSchedule)
  | ({ status: "conflict"; conflictingIds: string[] } & SessionSchedule)
  | { status: "failed" };

type CalendarSnapshot = Array<[QueryKey, SessionsListResponse | undefined]>;

interface RescheduleVariables {
  session: SessionListItem;
  schedule: SessionSchedule;
}

const withSchedule = (
  data: SessionsListResponse | undefined,
  sessionId: string,
  { plannedAt, durationMin }: SessionSchedule,
): SessionsListResponse | undefined =>
  data && {
    ...data,
    data: data.data.map((item) =>
      item.id === sessionId
        ? { ...item, planned_at: plannedAt, planned_duration_min: durationMin }
        : item,
    ),
  };

/**
 * Moves and resizes a planned session.
 * Overlaps with the loaded sessions are rejected before any request (US-4.3-AC02);
 * the server re-validates and its 422 conflict is mapped to the same result (AC03).
 * The calendar cache is updated optimistically, so a change re-renders without a
 * reload (AC01), and is restored if the server refuses it.
 */
export function useSessionReschedule(loadedSessions: readonly SessionListItem[]) {
  const queryClient = useQueryClient();

  const mutation = useMutation<unknown, unknown, RescheduleVariables, CalendarSnapshot>({
    mutationFn: ({ session, schedule }) =>
      updateSession(session.id, {
        ...(new Date(schedule.plannedAt).getTime() !== new Date(session.planned_at).getTime()
          ? { planned_at: schedule.plannedAt }
          : {}),
        ...(schedule.durationMin !== durationOf(session)
          ? { planned_duration_min: schedule.durationMin }
          : {}),
      }),
    onMutate: async ({ session, schedule }) => {
      await queryClient.cancelQueries({ queryKey: CALENDAR_QUERY_KEY });
      const snapshot = queryClient.getQueriesData<SessionsListResponse>({
        queryKey: CALENDAR_QUERY_KEY,
      });
      queryClient.setQueriesData<SessionsListResponse>({ queryKey: CALENDAR_QUERY_KEY }, (data) =>
        withSchedule(data, session.id, schedule),
      );
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      for (const [key, data] of snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }),
  });

  const { mutateAsync } = mutation;

  const reschedule = useCallback(
    async (session: SessionListItem, schedule: SessionSchedule): Promise<RescheduleResult> => {
      const localConflicts = findScheduleConflicts(
        loadedSessions,
        session.id,
        schedule.plannedAt,
        schedule.durationMin,
      );
      if (localConflicts.length > 0) {
        return {
          status: "conflict",
          conflictingIds: localConflicts.map((item) => item.id),
          ...schedule,
        };
      }
      try {
        await mutateAsync({ session, schedule });
        return { status: "saved", ...schedule };
      } catch (error) {
        const conflictingIds = getScheduleConflictIds(error);
        if (conflictingIds) {
          return { status: "conflict", conflictingIds, ...schedule };
        }
        logger.apiError(
          "Failed to reschedule session",
          error,
          `/api/v1/sessions/${session.id}`,
          "PATCH",
        );
        return { status: "failed" };
      }
    },
    [loadedSessions, mutateAsync],
  );

  return { reschedule, isSaving: mutation.isPending };
}
