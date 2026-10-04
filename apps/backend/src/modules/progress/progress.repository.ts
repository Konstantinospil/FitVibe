import { db } from "../../db/connection.js";
import type {
  ExerciseBreakdown,
  PlanProgress,
  ProgressSummary,
  TrendGroupBy,
  TrendPoint,
} from "./progress.types.js";

type TrendRow = {
  bucket_start: Date | string;
  sessions: number | string;
  volume: number | string;
};

type ExerciseAggregateRow = {
  type_code: string;
  sessions: number | string;
  total_reps: number | string;
  total_volume: number | string;
  total_duration_sec: number | string;
};

type PlanProgressRow = {
  id: string;
  name: string;
  progress_percent: number | string | null;
  session_count: number | string | null;
  completed_count: number | string | null;
  status: string;
  user_id: string;
  start_date: string | Date | null;
};

type SummaryRow = {
  sessions_completed: number | string | null;
  total_reps: number | string | null;
  total_volume: number | string | null;
  total_duration_sec: number | string | null;
};

type WeeklyAggregateRow = {
  week_start: Date | string;
  sessions: number | string;
  total_volume: number | string;
};

type VibePointsRow = {
  type_code: string;
  month_key: string;
  points: number | string;
};

type OverallPointsRow = {
  month_key: string;
  points: number | string;
};

function cutoffISO(periodDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - periodDays);
  return d.toISOString();
}

function cutoffWeekISO(periodDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - periodDays);
  const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diff = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - diff);
  return weekStart.toISOString();
}

function cutoffMonthISO(months: number): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  return start.toISOString();
}

export async function fetchSummary(userId: string, period: number): Promise<ProgressSummary> {
  const cutoff = cutoffISO(period);

  const aggregates = await db("session_summary as ss")
    .select(
      db.raw("COUNT(*) as sessions_completed"),
      db.raw("COALESCE(SUM(ss.total_reps), 0) as total_reps"),
      db.raw("COALESCE(SUM(ss.total_volume), 0) as total_volume"),
      db.raw("COALESCE(SUM(ss.total_duration_sec), 0) as total_duration_sec"),
    )
    .where({ "ss.owner_id": userId, "ss.status": "completed" })
    .whereNotNull("ss.completed_at")
    .andWhere("ss.completed_at", ">=", cutoff)
    .first<SummaryRow>();

  const sessionsCompleted = Number(aggregates?.sessions_completed ?? 0);
  const totalReps = Number(aggregates?.total_reps ?? 0);
  const totalVolume = Number(aggregates?.total_volume ?? 0);
  const totalDurationMin =
    Math.round((Number(aggregates?.total_duration_sec ?? 0) / 60) * 100) / 100;

  const avgVolumePerSession =
    sessionsCompleted > 0 ? Math.round((totalVolume / sessionsCompleted) * 100) / 100 : 0;

  return {
    period,
    sessions_completed: sessionsCompleted,
    total_reps: totalReps,
    total_volume: totalVolume,
    total_duration_min: totalDurationMin,
    avg_volume_per_session: avgVolumePerSession,
  };
}

export async function fetchTrends(
  userId: string,
  period: number,
  groupBy: TrendGroupBy,
): Promise<TrendPoint[]> {
  if (groupBy === "week") {
    const cutoffWeek = cutoffWeekISO(period);
    const rows = (await db("weekly_aggregates as wa")
      .where("wa.owner_id", userId)
      .andWhere("wa.week_start", ">=", cutoffWeek)
      .orderBy("wa.week_start", "asc")
      .select("wa.week_start", "wa.sessions", "wa.total_volume")) as WeeklyAggregateRow[];

    return rows.map((row) => ({
      date: new Date(row.week_start).toISOString(),
      sessions: Number(row.sessions),
      volume: Number(row.total_volume),
    }));
  }

  const cutoff = cutoffISO(period);
  const rows = (await db("session_summary as ss")
    .where({ "ss.owner_id": userId, "ss.status": "completed" })
    .whereNotNull("ss.completed_at")
    .andWhere("ss.completed_at", ">=", cutoff)
    .groupByRaw("date_trunc('day', ss.completed_at)")
    .select(
      db.raw("date_trunc('day', ss.completed_at) as bucket_start"),
      db.raw("COUNT(*) as sessions"),
      db.raw("COALESCE(SUM(ss.total_volume), 0) as volume"),
    )
    .orderBy("bucket_start", "asc")) as TrendRow[];

  return rows.map((row) => ({
    date: new Date(row.bucket_start).toISOString(),
    sessions: Number(row.sessions),
    volume: Number(row.volume),
  }));
}

export async function fetchExerciseBreakdown(
  userId: string,
  period: number,
): Promise<ExerciseBreakdown[]> {
  const cutoff = cutoffISO(period);

  const rows = (await db("exercise_sets as s")
    .join("session_exercises as se", "se.id", "s.session_exercise_id")
    .join("sessions as sess", "sess.id", "se.session_id")
    .join("exercises as e", "e.id", "se.exercise_id")
    .where({ "sess.owner_id": userId, "sess.status": "completed" })
    .andWhere("sess.completed_at", ">=", cutoff)
    .groupBy("e.type_code")
    .select(
      "e.type_code",
      db.raw("COUNT(DISTINCT sess.id) as sessions"),
      db.raw("COALESCE(SUM(s.reps),0) as total_reps"),
      db.raw("COALESCE(SUM(COALESCE(s.reps,0) * COALESCE(s.weight_kg,0)),0) as total_volume"),
      db.raw("COALESCE(SUM(COALESCE(s.duration_sec,0)),0) as total_duration_sec"),
    )
    .orderBy("e.type_code", "asc")) as ExerciseAggregateRow[];

  return rows.map((row) => ({
    type_code: row.type_code,
    sessions: Number(row.sessions),
    total_reps: Number(row.total_reps),
    total_volume: Number(row.total_volume),
    total_duration_min: Math.round((Number(row.total_duration_sec) / 60) * 100) / 100,
  }));
}

export async function fetchPlansProgress(userId: string): Promise<PlanProgress[]> {
  const rows = await db<PlanProgressRow>("plans")
    .select<PlanProgressRow[]>([
      "id",
      "name",
      "progress_percent",
      "session_count",
      "completed_count",
    ])
    .where({ user_id: userId })
    .andWhereNot("status", "archived")
    .orderBy("start_date", "desc");

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    progress_percent: Number(row.progress_percent ?? 0),
    session_count: Number(row.session_count ?? 0),
    completed_count: Number(row.completed_count ?? 0),
  }));
}

export async function fetchVibePointsTrends(
  userId: string,
  months: number,
): Promise<{ vibeRows: VibePointsRow[]; overallRows: OverallPointsRow[] }> {
  const cutoff = cutoffMonthISO(months);

  const vibeRows = (await db("vibe_level_changes as vlc")
    .where({
      "vlc.user_id": userId,
      "vlc.change_reason": "session_completed",
    })
    .whereNotNull("vlc.points_awarded")
    .andWhere("vlc.created_at", ">=", cutoff)
    .groupBy("vlc.domain_code", db.raw("to_char(date_trunc('month', vlc.created_at), 'YYYY-MM')"))
    .select(
      "vlc.domain_code as type_code",
      db.raw("to_char(date_trunc('month', vlc.created_at), 'YYYY-MM') as month_key"),
      db.raw("SUM(COALESCE(vlc.points_awarded, 0)) as points"),
    )
    .orderBy("month_key", "asc")) as VibePointsRow[];

  const overallRows = (await db("vibe_level_changes as vlc")
    .where({
      "vlc.user_id": userId,
      "vlc.change_reason": "session_completed",
    })
    .whereNotNull("vlc.points_awarded")
    .andWhere("vlc.created_at", ">=", cutoff)
    .groupBy(db.raw("to_char(date_trunc('month', vlc.created_at), 'YYYY-MM')"))
    .select(
      db.raw("to_char(date_trunc('month', vlc.created_at), 'YYYY-MM') as month_key"),
      db.raw("SUM(COALESCE(vlc.points_awarded, 0)) as points"),
    )
    .orderBy("month_key", "asc")) as OverallPointsRow[];

  return { vibeRows, overallRows };
}
