import { apiClient } from "./httpApi";

// Points API
export interface PointsBalance {
  total: number;
  recentEvents?: Array<{
    id: string;
    type: string;
    points: number;
    description: string;
    createdAt: string;
  }>;
}

export interface PointsHistoryEntry {
  id: string;
  type?: string;
  points: number;
  description?: string;
  reason?: string;
  createdAt: string;
  awardedAt?: string;
  sessionId?: string | null;
  exerciseId?: string;
}

export interface PointsHistoryResponse {
  entries: PointsHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export async function getPointsBalance(): Promise<PointsBalance> {
  const res = await apiClient.get<PointsBalance>("/api/v1/points");
  return res.data;
}

export async function getPointsHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<PointsHistoryResponse> {
  const res = await apiClient.get<PointsHistoryResponse>("/api/v1/points/history", { params });
  return res.data;
}

// Badges API
export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  iconUrl?: string;
  category?: string;
  rarity?: "common" | "rare" | "epic" | "legendary";
  earnedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export interface BadgeCatalogResponse {
  badges: Badge[];
  total: number;
}

export interface UserBadgesResponse {
  badges: Badge[];
  total: number;
}

export async function getUserBadges(): Promise<UserBadgesResponse> {
  const res = await apiClient.get<UserBadgesResponse>("/api/v1/points/badges/earned");
  return res.data;
}

export async function getBadgeCatalog(): Promise<BadgeCatalogResponse> {
  const res = await apiClient.get<BadgeCatalogResponse>("/api/v1/points/badges");
  return res.data;
}

// Leaderboard API
export type LeaderboardType = "global" | "friends";
export type LeaderboardPeriod = "week" | "month" | "year" | "all";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  points: number;
  badgesCount: number;
  streak?: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  type: LeaderboardType;
  period: LeaderboardPeriod;
  userRank?: number;
}

export async function getLeaderboard(params: {
  type: LeaderboardType;
  period: LeaderboardPeriod;
}): Promise<LeaderboardResponse> {
  const res = await apiClient.get<LeaderboardResponse>("/api/v1/leaderboards", { params });
  return res.data;
}
