import { useCallback } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  getScheduleConflictIds,
  updateSession,
  type SessionListItem,
  type SessionsListResponse,
} from "../services/sessionApi";
import { findScheduleConflicts } from "../lib/scheduling/sessionSchedule";
import { logger } from "../utils/logger";

/** Every cached calendar window starts with this key segment. */
export const CALENDAR_QUERY_KEY = ["calendar"] as const;

export type RescheduleResult =
  | { status: "saved"; plannedAt: string }
  | { status: "conflict"; conflictingIds: string[]; plannedAt: string }
  | { status: "failed" };

type CalendarSnapshot = Array<[QueryKey, SessionsListResponse | undefined]>;

interface RescheduleVariables {
  session: SessionListItem;
  plannedAt: string;
}

const withPlannedAt = (
  data: SessionsListResponse | undefined,
  sessionId: string,
  plannedAt: string,
): SessionsListResponse | undefined =>
  data && {
    ...data,
    data: data.data.map((item) =>
      item.id === sessionId ? { ...item, planned_at: plannedAt } : item,
    ),
  };

/**
 * Moves a planned session to a new instant.
 * Conflicts against the loaded sessions are rejected before any request (US-4.3-AC02);
 * the server re-validates and its 422 conflict is mapped to the same result (AC03).
 * The calendar cache is updated optimistically, so a move re-renders without a reload
 * (AC01), and is restored if the server refuses the move.
 */
export function useSessionReschedule(loadedSessions: readonly SessionListItem[]) {
  const queryClient = useQueryClient();

  const mutation = useMutation<unknown, unknown, RescheduleVariables, CalendarSnapshot>({
    mutationFn: ({ session, plannedAt }) => updateSession(session.id, { planned_at: plannedAt }),
    onMutate: async ({ session, plannedAt }) => {
      await queryClient.cancelQueries({ queryKey: CALENDAR_QUERY_KEY });
      const snapshot = queryClient.getQueriesData<SessionsListResponse>({
        queryKey: CALENDAR_QUERY_KEY,
      });
      queryClient.setQueriesData<SessionsListResponse>({ queryKey: CALENDAR_QUERY_KEY }, (data) =>
        withPlannedAt(data, session.id, plannedAt),
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
    async (session: SessionListItem, plannedAt: string): Promise<RescheduleResult> => {
      const localConflicts = findScheduleConflicts(loadedSessions, session.id, plannedAt);
      if (localConflicts.length > 0) {
        return {
          status: "conflict",
          conflictingIds: localConflicts.map((item) => item.id),
          plannedAt,
        };
      }
      try {
        await mutateAsync({ session, plannedAt });
        return { status: "saved", plannedAt };
      } catch (error) {
        const conflictingIds = getScheduleConflictIds(error);
        if (conflictingIds) {
          return { status: "conflict", conflictingIds, plannedAt };
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
