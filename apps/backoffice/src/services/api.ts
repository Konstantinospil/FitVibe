import axios, { type InternalAxiosRequestConfig } from "axios";
import type { UserStatus } from "@fitvibe/contracts";

const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "http://localhost:4000");

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: true,
});

// CSRF token management
let csrfTokenPromise: Promise<string> | null = null;
let cachedCsrfToken: string | null = null;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Separate client for CSRF token fetching to avoid circular dependencies
const csrfClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: true,
});

async function fetchCsrfToken(): Promise<string> {
  // If we already have a token fetch in progress, reuse that promise
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  // Create new token fetch promise
  csrfTokenPromise = (async () => {
    try {
      const response = await csrfClient.get<{ csrfToken: string }>("/api/v1/csrf-token");
      const token = response.data.csrfToken;
      cachedCsrfToken = token;
      return token;
    } catch (error) {
      // Clear the promise on error so we can retry
      csrfTokenPromise = null;
      throw error;
    } finally {
      // Clear the promise after completion so we can fetch a new one if needed
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

function requiresCsrfToken(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

// Request interceptor to add CSRF tokens to state-changing requests
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (requiresCsrfToken(config.method || "GET")) {
      // Fetch CSRF token if we don't have one cached
      if (!cachedCsrfToken) {
        try {
          await fetchCsrfToken();
        } catch (error) {
          // If CSRF token fetch fails, still proceed - the backend will return 403
          // which we can handle in the response interceptor
          console.warn("Failed to fetch CSRF token:", error);
        }
      }

      // Add CSRF token to request header if we have one
      if (cachedCsrfToken) {
        config.headers = config.headers || {};
        config.headers["x-csrf-token"] = cachedCsrfToken;
      }
    }

    return config;
  },
  (error: unknown) => {
    return Promise.reject(error instanceof Error ? error : new Error("Request error"));
  },
);

// Response interceptor to handle CSRF token errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: unknown) => {
    // If we get a CSRF error, try to fetch a new token and retry once
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data as unknown;
      const errorCode =
        responseData && typeof responseData === "object" && "error" in responseData
          ? (responseData as { error?: { code?: string } }).error?.code
          : undefined;

      if (
        error.response?.status === 403 &&
        (errorCode === "CSRF_TOKEN_INVALID" || errorCode === "FORBIDDEN")
      ) {
        // Clear cached token
        cachedCsrfToken = null;
        csrfTokenPromise = null;

        // Fetch new token
        try {
          await fetchCsrfToken();
          // Retry the original request
          const config = error.config;
          if (config && cachedCsrfToken) {
            config.headers = config.headers || {};
            config.headers["x-csrf-token"] = cachedCsrfToken;
            return apiClient.request(config);
          }
        } catch {
          // If retry fails, return the original error
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }

    return Promise.reject(error instanceof Error ? error : new Error("Request failed"));
  },
);

// Translation types
export interface Translation {
  id: string;
  namespace: string;
  key_path: string;
  language: string;
  value: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TranslationListResponse {
  data: Translation[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface NamespaceUpdate {
  namespace: string;
  updated_at: string | null;
}

export interface NamespaceUpdateResponse {
  data: NamespaceUpdate[];
}

export interface TranslationMetadataResponse {
  data: {
    languages: string[];
    namespaces: string[];
  };
}

export type LegalDocumentType = "terms" | "privacy" | "cookie";
export type LegalChangeClass = "legacy" | "editorial" | "material";
export type LegalUserAction = "none" | "acknowledge" | "accept" | "renew_consent";

export interface LegalPublication {
  id: string;
  documentType: LegalDocumentType;
  version: string;
  changeClass: LegalChangeClass;
  userAction: LegalUserAction;
  effectiveAt: string;
  publishedAt: string;
  publishedBy: string | null;
  languages: string[];
}

export interface LegalPublicationListResponse {
  data: LegalPublication[];
}

// Contact message types
export interface ContactMessage {
  id: string;
  userId: string | null;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  readByUserId: string | null;
  respondedAt: string | null;
  response: string | null;
}

export interface ContactMessageListResponse {
  messages: ContactMessage[];
}

export type HealthStatusResponse = {
  status: string;
  uptime?: number;
  version?: string;
  timestamp?: string;
};

export interface SystemReadOnlyStatus {
  readOnlyMode: boolean;
  message: string | null;
  timestamp: string;
}

export interface SystemConfigResponse {
  readOnlyMode: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  features: Record<string, boolean>;
  timestamp: string;
}

export interface EnableReadOnlyRequest {
  reason?: string;
  estimatedDuration?: string;
}

export interface DisableReadOnlyRequest {
  notes?: string;
}

export interface FeedReport {
  id: string;
  reporterUsername: string;
  feedItemId?: string | null;
  commentId?: string | null;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  contentPreview: string | null;
  contentAuthor: string | null;
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

export interface UserRecord {
  id: string;
  username: string;
  displayName?: string | null;
  email: string;
  roleCode: string;
  status: UserStatus;
  createdAt: string;
  deactivatedAt: string | null;
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

export type OpsLightStatus = "green" | "yellow" | "red";

export interface OpsStatusResponse {
  backend: {
    status: OpsLightStatus;
    dbOk: boolean;
    nginxOk: boolean;
    clamavOk: boolean;
    clamavEnabled: boolean;
    readOnly: boolean;
  };
  frontend: {
    status: OpsLightStatus;
    ok: boolean;
  };
  counts: {
    loggedInUsers: number;
    unresolvedMessages: number;
    violationReports: number;
    unresolvedAuditLogs: number;
    openIssues: number;
  };
}

export type AuditLogSeverity = "info" | "warning" | "error" | "critical";

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  entityType: string;
  action: string;
  entityId: string | null;
  outcome: string;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  severity: AuditLogSeverity;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[];
}

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  status: string;
  role_code: string;
  created_at: string;
  deactivated_at?: string | null;
  avatar_url?: string | null;
}

export interface UserListResponse {
  users: User[];
}

export interface ActionUiMapping {
  action: string;
  uiName: string | null;
}

export interface ActionUiMappingListResponse {
  mappings: ActionUiMapping[];
}

// API functions
export const translationsApi = {
  list: async (params?: {
    language?: string;
    namespace?: string;
    search?: string;
    keyPath?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const response = await apiClient.get<TranslationListResponse>("/api/v1/translations", {
      params,
    });
    return response.data;
  },
  create: async (data: {
    namespace: string;
    key_path: string;
    language: string;
    value: string;
  }) => {
    const response = await apiClient.post<Translation>("/api/v1/translations", data);
    return response.data;
  },
  update: async (language: string, namespace: string, keyPath: string, data: { value: string }) => {
    const encodedKeyPath = encodeURIComponent(keyPath.replace(/\./g, "%2E"));
    const response = await apiClient.put<Translation>(
      `/api/v1/translations/${language}/${namespace}/${encodedKeyPath}`,
      data,
    );
    return response.data;
  },
  delete: async (language: string, namespace: string, keyPath: string) => {
    const encodedKeyPath = encodeURIComponent(keyPath.replace(/\./g, "%2E"));
    await apiClient.delete(`/api/v1/translations/${language}/${namespace}/${encodedKeyPath}`);
  },
  namespaceUpdates: async () => {
    const response = await apiClient.get<NamespaceUpdateResponse>(
      "/api/v1/translations/namespace-updates",
    );
    return response.data;
  },
  metadata: async () => {
    const response = await apiClient.get<TranslationMetadataResponse>(
      "/api/v1/translations/metadata",
    );
    return response.data;
  },
};

export const legalPublicationsApi = {
  list: async (documentType?: LegalDocumentType) => {
    const response = await apiClient.get<LegalPublicationListResponse>(
      "/api/v1/legal/publications",
      {
        params: documentType ? { documentType } : undefined,
      },
    );
    return response.data;
  },
  publish: async (
    documentType: LegalDocumentType,
    data: {
      changeClass: Exclude<LegalChangeClass, "legacy">;
      userAction: LegalUserAction;
      effectiveAt?: string;
    },
  ) => {
    const response = await apiClient.post<LegalPublication>(
      `/api/v1/legal/publications/${documentType}`,
      data,
    );
    return response.data;
  },
};

export async function getHealthStatus(): Promise<HealthStatusResponse> {
  const res = await apiClient.get<HealthStatusResponse>("/health");
  return res.data;
}

export async function getSystemReadOnlyStatus(): Promise<SystemReadOnlyStatus> {
  const res = await apiClient.get<SystemReadOnlyStatus>("/api/v1/system/read-only/status");
  return res.data;
}

export async function getSystemConfig(): Promise<SystemConfigResponse> {
  const res = await apiClient.get<SystemConfigResponse>("/api/v1/system/config");
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

export async function enableMaintenanceMode(payload?: {
  message?: string;
}): Promise<{ success: boolean; maintenanceMode: boolean; message?: string }> {
  const res = await apiClient.post<{
    success: boolean;
    maintenanceMode: boolean;
    message?: string;
  }>("/api/v1/system/maintenance/enable", payload ?? {});
  return res.data;
}

export async function disableMaintenanceMode(): Promise<{
  success: boolean;
  maintenanceMode: boolean;
  message?: string;
}> {
  const res = await apiClient.post<{
    success: boolean;
    maintenanceMode: boolean;
    message?: string;
  }>("/api/v1/system/maintenance/disable", {});
  return res.data;
}

export async function enableClamav(): Promise<{ success: boolean; clamavEnabled: boolean }> {
  const res = await apiClient.post<{ success: boolean; clamavEnabled: boolean }>(
    "/api/v1/system/clamav/enable",
    {},
  );
  return res.data;
}

export async function disableClamav(): Promise<{ success: boolean; clamavEnabled: boolean }> {
  const res = await apiClient.post<{ success: boolean; clamavEnabled: boolean }>(
    "/api/v1/system/clamav/disable",
    {},
  );
  return res.data;
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
    { data: payload ?? {} },
  );
  return res.data;
}

export async function getRecentActivity(limit = 10): Promise<AuditLogEntry[]> {
  const res = await apiClient.get<{ activity: AuditLogEntry[] }>("/api/v1/logs/recent-activity", {
    params: { limit },
  });
  return res.data.activity;
}

export async function getOpsStatus(): Promise<OpsStatusResponse> {
  const res = await apiClient.get<OpsStatusResponse>("/api/v1/admin/ops/status");
  return res.data;
}

export const messagesApi = {
  list: async (params?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    openOnly?: boolean;
  }) => {
    // Convert boolean to string for query params (backend expects "true"/"false" string)
    const queryParams = params
      ? {
          ...params,
          unreadOnly: params.unreadOnly ? "true" : undefined,
          openOnly: params.openOnly ? "true" : undefined,
        }
      : undefined;
    const response = await apiClient.get<{ success: boolean; data: ContactMessage[] }>(
      "/api/v1/contact/messages",
      {
        params: queryParams,
      },
    );
    return { messages: response.data.data };
  },
  markRead: async (messageId: string) => {
    await apiClient.post(`/api/v1/contact/messages/${messageId}/read`);
  },
  markResponded: async (messageId: string) => {
    await apiClient.post(`/api/v1/contact/messages/${messageId}/responded`);
  },
  saveResponse: async (messageId: string, response: string) => {
    const response_data = await apiClient.post<{ success: boolean; data: ContactMessage }>(
      `/api/v1/contact/messages/${messageId}/response`,
      { response },
    );
    return response_data.data.data;
  },
};

export const auditLogsApi = {
  list: async (params?: {
    action?: string | string[];
    entityType?: string;
    actorUserId?: string;
    outcome?: string;
    requestId?: string;
    severity?: AuditLogSeverity;
    resolved?: boolean;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = params
      ? {
          ...params,
          resolved:
            typeof params.resolved === "boolean" ? (params.resolved ? "true" : "false") : undefined,
        }
      : undefined;
    const response = await apiClient.get<AuditLogListResponse>("/api/v1/logs", {
      params: queryParams,
    });
    return response.data;
  },
  update: async (
    logId: string,
    updates: {
      severity?: AuditLogSeverity;
      resolved?: boolean;
    },
  ) => {
    const response = await apiClient.patch<{ log: AuditLogEntry }>(
      `/api/v1/logs/${logId}`,
      updates,
    );
    return response.data.log;
  },
  bulkUpdateResolved: async (logIds: string[], resolved: boolean) => {
    const response = await apiClient.patch<{ updated: number }>(`/api/v1/logs/bulk`, {
      ids: logIds,
      resolved,
    });
    return response.data.updated;
  },
};

export interface PrivilegedAdmin {
  id: string;
  username: string | null;
  email: string | null;
  role: "admin" | "superadmin";
  status: string;
  totpVerified: boolean;
}

export const superadminApi = {
  listAdmins: async () => {
    const response = await apiClient.get<{ users: PrivilegedAdmin[] }>(
      "/api/v1/admin/superadmin/privileges/admins",
    );
    return response.data.users;
  },
  sudo: async (password: string) => {
    const response = await apiClient.post<{ expiresAt: string }>("/api/v1/admin/superadmin/sudo", {
      password,
    });
    return response.data;
  },
  changeRole: async (
    userId: string,
    role: "admin" | "superadmin",
    reason: string,
    totpCode: string,
  ) => {
    await apiClient.post("/api/v1/admin/superadmin/privileges/admins/" + userId + "/role", {
      role,
      reason,
      totpCode,
    });
  },
};

export const usersApi = {
  search: async (query: string, limit = 20, blacklisted?: boolean) => {
    const response = await apiClient.get<{
      users: Array<{
        id: string;
        username: string;
        displayName: string;
        email: string;
        roleCode: string;
        status: string;
        createdAt: string;
        deactivatedAt: string | null;
        avatarUrl: string | null;
      }>;
    }>("/api/v1/admin/users/search", {
      params: {
        q: query,
        limit,
        blacklisted: blacklisted !== undefined ? String(blacklisted) : undefined,
      },
    });
    // Convert roleCode (camelCase from backend) to role_code (snake_case for frontend)
    return {
      users: response.data.users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.displayName || user.username,
        role_code: user.roleCode,
        status: user.status,
        created_at: user.createdAt,
        deactivated_at: user.deactivatedAt,
        avatar_url: user.avatarUrl,
      })),
    };
  },
  action: async (
    userId: string,
    action: "blacklist" | "unblacklist" | "delete",
    reason?: string,
  ) => {
    await apiClient.post(`/api/v1/admin/users/${userId}/action`, { action, reason });
  },
  changeRole: async (userId: string, role: string, reason?: string) => {
    await apiClient.post(`/api/v1/admin/users/${userId}/role`, { role, reason });
  },
  sendVerificationEmail: async (userId: string) => {
    await apiClient.post(`/api/v1/admin/users/${userId}/send-verification-email`);
  },
  sendPasswordReset: async (userId: string) => {
    await apiClient.post(`/api/v1/admin/users/${userId}/send-password-reset`);
  },
  deleteAvatar: async (userId: string, reason?: string) => {
    await apiClient.delete(`/api/v1/admin/users/${userId}/avatar`, { data: { reason } });
  },
  deleteDisplayName: async (userId: string, reason?: string) => {
    await apiClient.delete(`/api/v1/admin/users/${userId}/display-name`, { data: { reason } });
  },
};

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post<{
      user: { id: string; username: string; displayName: string; email: string; role: string };
    }>("/api/v1/auth/login", { email, password });
    return response.data;
  },
  logout: async () => {
    await apiClient.post("/api/v1/auth/logout");
  },
  me: async () => {
    // Use /api/v1/users/me endpoint which returns UserDetail directly
    const response = await apiClient.get<{
      id: string;
      username: string;
      displayName: string;
      primaryEmail: string | null;
      role: string;
    }>("/api/v1/users/me");
    // Transform to match the expected format
    return {
      user: {
        id: response.data.id,
        username: response.data.username,
        displayName: response.data.displayName,
        email: response.data.primaryEmail || "",
        role: response.data.role,
      },
    };
  },
};

export const actionMappingsApi = {
  list: async () => {
    const response = await apiClient.get<ActionUiMappingListResponse>(
      "/api/v1/admin/action-mappings",
    );
    return response.data;
  },
  upsert: async (mapping: { action: string; uiName: string }) => {
    const response = await apiClient.post<{ mapping: ActionUiMapping }>(
      "/api/v1/admin/action-mappings",
      mapping,
    );
    return response.data.mapping;
  },
};
