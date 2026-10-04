import type { UserStatus } from "@fitvibe/contracts";
import { apiClient } from "./httpApi";

// Admin & System API
export interface SystemReadOnlyStatus {
  readOnlyMode: boolean;
  message: string | null;
  timestamp: string;
}

export interface EnableReadOnlyRequest {
  reason?: string;
  estimatedDuration?: string;
}

export interface DisableReadOnlyRequest {
  notes?: string;
}

export async function getSystemReadOnlyStatus(): Promise<SystemReadOnlyStatus> {
  const res = await apiClient.get<SystemReadOnlyStatus>("/api/v1/system/read-only/status");
  return res.data;
}

export async function enableReadOnlyMode(
  payload: EnableReadOnlyRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    "/api/v1/system/read-only/enable",
    payload,
  );
  return res.data;
}

export async function disableReadOnlyMode(
  payload: DisableReadOnlyRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    "/api/v1/system/read-only/disable",
    payload,
  );
  return res.data;
}

// Admin - Content Reports API
export interface FeedReport {
  id: string;
  reporterUsername: string;
  feedItemId?: string;
  commentId?: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  contentPreview: string;
  contentAuthor: string;
}

export interface FeedReportsQuery {
  status?: "all" | "pending" | "reviewed" | "dismissed";
  limit?: number;
  offset?: number;
}

export interface FeedReportsResponse {
  data: FeedReport[];
  total: number;
  limit: number;
  offset: number;
}

export interface ModerateContentRequest {
  action: "hide" | "dismiss" | "ban";
  notes?: string;
}

export async function getFeedReports(params?: FeedReportsQuery): Promise<FeedReportsResponse> {
  const res = await apiClient.get<FeedReportsResponse>("/api/v1/admin/reports", { params });
  return res.data;
}

export async function moderateContent(
  reportId: string,
  payload: ModerateContentRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/api/v1/admin/reports/${reportId}/moderate`,
    payload,
  );
  return res.data;
}

// Admin - User Management API
export interface UserRecord {
  id: string;
  username: string;
  email: string;
  roleCode: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
  reportCount: number;
}

export interface UserSearchQuery {
  q: string;
  limit?: number;
  offset?: number;
}

export interface UserSearchResponse {
  data: UserRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserActionRequest {
  reason?: string;
  notes?: string;
}

export async function searchUsers(params: UserSearchQuery): Promise<UserSearchResponse> {
  const res = await apiClient.get<UserSearchResponse>("/api/v1/admin/users/search", { params });
  return res.data;
}

export async function suspendUser(
  userId: string,
  payload?: UserActionRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/suspend`,
    payload ?? {},
  );
  return res.data;
}

export async function unsuspendUser(
  userId: string,
  payload?: UserActionRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/unsuspend`,
    payload ?? {},
  );
  return res.data;
}

export async function banUser(
  userId: string,
  payload?: UserActionRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/ban`,
    payload ?? {},
  );
  return res.data;
}

export async function activateUser(
  userId: string,
  payload?: UserActionRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/activate`,
    payload ?? {},
  );
  return res.data;
}

export async function deleteUser(
  userId: string,
  payload?: UserActionRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}`,
    { data: payload },
  );
  return res.data;
}
