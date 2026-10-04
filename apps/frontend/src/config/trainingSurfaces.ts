export const TRAINING_DATA_CONFIG = {
  homeRecentFeedLimit: 12,
  homeTrendingFeedLimit: 10,
  homePreviousActivitiesLimit: 6,
  calendarSessionLimit: 200,
  calendarGridDayCount: 42,
  exerciseCatalogLimit: 250,
  standardQueryStaleMs: 60_000,
  exerciseCatalogStaleMs: 300_000,
} as const;

export const TRAINING_TIME_UNITS = {
  millisecondsPerMinute: 60_000,
  minutesPerHour: 60,
  minutesPerDay: 1_440,
} as const;
