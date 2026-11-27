import { useQuery } from "@tanstack/react-query";
import { getUserPreferences } from "../services/accountApi";
import { loadUnitFor, type LoadUnit } from "../lib/units/load";

const PREFERENCES_STALE_MS = 5 * 60_000;

export interface LoadUnitState {
  unit: LoadUnit;
  /**
   * False while the preference loads: load fields wait, so a number typed in one
   * unit is never read in the other. A failed request falls back to kilograms.
   */
  ready: boolean;
}

/**
 * The athlete's load unit from their preferences (issue 89). Shares the Settings
 * cache (["settings", "preferences"]), so a change there applies everywhere.
 */
export function useLoadUnit(): LoadUnitState {
  const preferences = useQuery({
    queryKey: ["settings", "preferences"],
    queryFn: getUserPreferences,
    staleTime: PREFERENCES_STALE_MS,
  });
  return {
    unit: loadUnitFor(preferences.data?.measurementSystem),
    ready: preferences.isSuccess || preferences.isError,
  };
}
