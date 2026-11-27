export const TRAINING_DATA_CONFIG = {
  homeRecentFeedLimit: 12,
  homeTrendingFeedLimit: 10,
  homePreviousActivitiesLimit: 6,
  calendarSessionLimit: 200,
  // GET /sessions accepts at most 100 records per request.
  calendarApiPageLimit: 100,
  calendarGridDayCount: 42,
  // Week and day views show at least these hours; earlier or later sessions extend the range.
  calendarDayStartHour: 6,
  calendarDayEndHour: 22,
  // Planned session length, in minutes. The server enforces the same bounds and
  // defaults new sessions to 60 minutes; resizing moves in steps of 15 minutes.
  sessionDurationMinMinutes: 5,
  sessionDurationMaxMinutes: 720,
  sessionDurationDefaultMinutes: 60,
  sessionDurationStepMinutes: 15,
  // Set results the server accepts: effort (RPE) 1–10 and an optional heart rate of
  // 20–250 bpm. The server enforces the same bounds.
  setRpeMin: 1,
  setRpeMax: 10,
  setHeartRateMinBpm: 20,
  setHeartRateMaxBpm: 250,
  // Body weight the profile accepts, in kilograms; the server enforces the same range.
  bodyWeightMinKg: 20,
  bodyWeightMaxKg: 400,
  // Points are awarded in the background after completion; the session page checks again until they arrive.
  pointsPendingPollMs: 2_000,
  // GET /exercises accepts at most 100 records per request.
  exerciseCatalogLimit: 100,
  standardQueryStaleMs: 60_000,
  exerciseCatalogStaleMs: 300_000,
} as const;

export const TRAINING_TIME_UNITS = {
  millisecondsPerMinute: 60_000,
  minutesPerHour: 60,
  minutesPerDay: 1_440,
} as const;
