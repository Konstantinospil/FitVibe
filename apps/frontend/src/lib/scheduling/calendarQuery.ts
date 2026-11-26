/**
 * Every cached calendar window starts with this key segment.
 *
 * Kept outside `hooks/`: pages that only need the key must not import a hook
 * module, because the build groups small hooks shared by two pages into the
 * eagerly loaded `shared-small` chunk (see vite.config.ts), which would pull the
 * hook's dependencies into every page's first load.
 */
export const CALENDAR_QUERY_KEY = ["calendar"] as const;
