import { db } from "../../db/connection.js";

const LEADERBOARD_TABLE = "mv_leaderboard";
const FOLLOWERS_TABLE = "followers";

export interface LeaderboardRow {
  user_id: string;
  username: string;
  display_name: string;
  points: number;
  badges_count: number;
}

export async function getLeaderboardRows({
  period,
  scope,
  viewerId,
  limit = 25,
}: {
  period: "week" | "month";
  scope: "global" | "friends";
  viewerId?: string;
  limit?: number;
}): Promise<LeaderboardRow[]> {
  const periodStartExpr = db.raw("date_trunc(?, now())::date", [period]);

  const query = db(LEADERBOARD_TABLE)
    .select<LeaderboardRow[]>([
      "user_id",
      "alias as username",
      "display_name",
      "points",
      "badges_count",
    ])
    .where({ period_type: period })
    .andWhere("period_start", "=", periodStartExpr)
    .orderBy("points", "desc")
    .limit(limit);

  if (scope === "friends" && viewerId) {
    query.whereIn("user_id", (builder) => {
      builder.select("following_id").from(FOLLOWERS_TABLE).where({ follower_id: viewerId });
      builder.unionAll((unionBuilder) => {
        unionBuilder.select(db.raw("?", [viewerId]));
      });
    });
  }

  return query;
}
