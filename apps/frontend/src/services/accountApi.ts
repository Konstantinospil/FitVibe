import type {
  MeasurementSystem,
  SessionVisibility,
  UpdateUserPreferences,
  UserLanguage,
  UserPreferences as SharedUserPreferences,
  UserStatus,
} from "@fitvibe/contracts";
import { apiClient, rawHttpClient } from "./httpApi";

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  username: string;
  terms_accepted: boolean;
  profile?: {
    display_name?: string;
  };
};

export type UserResponse = {
  id: string;
  username: string;
  email: string;
  role?: string;
};

// User Profile API
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  bio?: string | null;
  alias?: string | null;
  avatarUrl?: string | null;
  weight?: number | null;
  weightUnit?: "kg" | "lb" | null;
  fitnessLevel?: string | null;
  trainingFrequency?: string | null;
  locale?: string;
  preferredLang?: UserLanguage;
  defaultVisibility?: SessionVisibility;
  units?: MeasurementSystem;
  role?: string;
  status?: UserStatus;
  isOwnProfile?: boolean;
  isFollowing?: boolean;
  followersCount?: number;
  followingCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  alias?: string;
  weight?: number;
  weightUnit?: "kg" | "lb";
  fitnessLevel?: "beginner" | "intermediate" | "advanced" | "elite";
  trainingFrequency?: "rarely" | "1_2_per_week" | "3_4_per_week" | "5_plus_per_week";
}

interface UserDetail {
  id: string;
  username: string;
  displayName: string;
  locale: string;
  preferredLang: UserLanguage;
  defaultVisibility: SessionVisibility;
  units: MeasurementSystem;
  role: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  primaryEmail: string | null;
  phoneNumber?: string | null;
  avatar?: {
    url: string | null;
    mimeType: string | null;
    bytes: number | null;
    updatedAt: string | null;
  } | null;
  contacts?: Array<{
    id: string;
    type: string;
    value: string;
    verified: boolean;
  }>;
  profile?: {
    alias: string | null;
    bio: string | null;
    weight: number | null;
    weightUnit: "kg" | "lb" | null;
    fitnessLevel: string | null;
    trainingFrequency: string | null;
  };
}

/**
 * Get current user profile
 */
export async function getCurrentUser(): Promise<UserProfile> {
  const res = await apiClient.get<UserDetail>("/api/v1/users/me");
  const data = res.data;
  return {
    id: data.id,
    username: data.username,
    displayName: data.displayName,
    email: data.primaryEmail || undefined,
    avatarUrl: data.avatar?.url ?? null,
    bio: data.profile?.bio ?? null,
    alias: data.profile?.alias ?? null,
    weight: data.profile?.weight ?? null,
    weightUnit: data.profile?.weightUnit ?? null,
    fitnessLevel: data.profile?.fitnessLevel ?? null,
    trainingFrequency: data.profile?.trainingFrequency ?? null,
    locale: data.locale,
    preferredLang: data.preferredLang,
    defaultVisibility: data.defaultVisibility,
    units: data.units,
    role: data.role,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Update user profile
 */
export async function updateProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
  const res = await apiClient.patch<UserDetail>("/api/v1/users/me", payload);
  const data = res.data;
  return {
    id: data.id,
    username: data.username,
    displayName: data.displayName,
    email: data.primaryEmail || undefined,
    avatarUrl: data.avatar?.url ?? null,
    bio: data.profile?.bio ?? null,
    alias: data.profile?.alias ?? null,
    weight: data.profile?.weight ?? null,
    weightUnit: data.profile?.weightUnit ?? null,
    fitnessLevel: data.profile?.fitnessLevel ?? null,
    trainingFrequency: data.profile?.trainingFrequency ?? null,
    locale: data.locale,
    preferredLang: data.preferredLang,
    defaultVisibility: data.defaultVisibility,
    units: data.units,
    role: data.role,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export interface BodyWeightEntry {
  id: string;
  weightKg: number;
  measuredAt: string;
}

export interface BodyProgressPhoto {
  id: string;
  fileUrl: string;
  mimeType: string | null;
  bytes: number | null;
  createdAt: string;
}

export interface BodyProgressResponse {
  weights: BodyWeightEntry[];
  photos: BodyProgressPhoto[];
}

export async function getBodyProgress(): Promise<BodyProgressResponse> {
  const res = await apiClient.get<BodyProgressResponse>("/api/v1/users/me/body-progress");
  return res.data;
}

export async function addBodyWeight(payload: {
  weightKg: number;
  measuredAt?: string;
}): Promise<BodyWeightEntry> {
  const res = await apiClient.post<BodyWeightEntry>(
    "/api/v1/users/me/body-progress/weight",
    payload,
  );
  return res.data;
}

export async function uploadBodyProgressPhoto(file: File): Promise<BodyProgressPhoto> {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await apiClient.post<BodyProgressPhoto>(
    "/api/v1/users/me/body-progress/photo",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function deleteBodyProgressPhoto(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/users/me/body-progress/photo/${id}`);
}

export type LoginResponse =
  | {
      requires2FA: false;
      user: UserResponse;
      session: unknown;
    }
  | {
      requires2FA: true;
      pendingSessionId: string;
    };

export type RegisterResponse = {
  user: UserResponse;
  session: unknown;
};

export type Verify2FAResponse = {
  user: UserResponse;
  session: unknown;
};

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  // Backend sets HttpOnly cookies (accessToken, refreshToken) and returns user data
  const res = await rawHttpClient.post<LoginResponse>("/api/v1/auth/login", payload);
  return res.data;
}

export type Verify2FALoginRequest = {
  pendingSessionId: string;
  code: string;
};

export async function verify2FALogin(payload: Verify2FALoginRequest): Promise<Verify2FAResponse> {
  // Backend sets HttpOnly cookies (accessToken, refreshToken) and returns user data
  const res = await rawHttpClient.post<Verify2FAResponse>("/api/v1/auth/login/verify-2fa", payload);
  return res.data;
}

export async function register(payload: RegisterRequest): Promise<RegisterResponse> {
  // Backend sets HttpOnly cookies (accessToken, refreshToken) and returns user data
  const res = await rawHttpClient.post<RegisterResponse>("/api/v1/auth/register", payload);
  return res.data;
}

export type AcceptTermsRequest = {
  terms_accepted: boolean;
};

export type AcceptTermsResponse = {
  message: string;
};

export async function acceptTerms(payload: AcceptTermsRequest): Promise<AcceptTermsResponse> {
  const res = await apiClient.post<AcceptTermsResponse>("/api/v1/auth/terms/accept", payload);
  return res.data;
}

export type RevokeTermsResponse = {
  message: string;
};

export async function revokeTerms(): Promise<RevokeTermsResponse> {
  const res = await apiClient.post<RevokeTermsResponse>("/api/v1/auth/terms/revoke");
  return res.data;
}

export type AcceptPrivacyPolicyRequest = {
  privacy_policy_accepted: boolean;
};

export type AcceptPrivacyPolicyResponse = {
  message: string;
};

export async function acceptPrivacyPolicy(
  payload: AcceptPrivacyPolicyRequest,
): Promise<AcceptPrivacyPolicyResponse> {
  const res = await apiClient.post<AcceptPrivacyPolicyResponse>(
    "/api/v1/auth/privacy/accept",
    payload,
  );
  return res.data;
}

export type RevokePrivacyPolicyResponse = {
  message: string;
};

export async function revokePrivacyPolicy(): Promise<RevokePrivacyPolicyResponse> {
  const res = await apiClient.post<RevokePrivacyPolicyResponse>("/api/v1/auth/privacy/revoke");
  return res.data;
}

export interface LegalDocumentsStatus {
  terms: {
    accepted: boolean;
    acceptedAt: string | null;
    acceptedVersion: string | null;
    currentVersion: string;
    requiredVersion: string | null;
    requiredAction: "none" | "acknowledge" | "accept" | "renew_consent";
    needsAcceptance: boolean;
  };
  privacy: {
    accepted: boolean;
    acceptedAt: string | null;
    acceptedVersion: string | null;
    currentVersion: string;
    requiredVersion: string | null;
    requiredAction: "none" | "acknowledge" | "accept" | "renew_consent";
    needsAcceptance: boolean;
  };
}

export async function getLegalDocumentsStatus(): Promise<LegalDocumentsStatus> {
  const res = await apiClient.get<LegalDocumentsStatus>("/api/v1/auth/legal-documents/status");
  return res.data;
}

export interface LegalDocumentVersions {
  terms: string;
  privacy: string;
  cookie: string;
}

export async function getLegalDocumentVersions(): Promise<LegalDocumentVersions> {
  const res = await apiClient.get<LegalDocumentVersions>("/api/v1/auth/legal-documents/versions");
  return res.data;
}

export interface PublishedLegalDocumentContent {
  documentType: "terms" | "privacy" | "cookie";
  version: string;
  changeClass: "legacy" | "editorial" | "material";
  userAction: "none" | "acknowledge" | "accept" | "renew_consent";
  effectiveAt: string;
  publishedAt: string;
  language: string;
  content: Record<string, unknown> | null;
  legacyWithoutSnapshot: boolean;
}

export async function getPublishedLegalDocument(
  documentType: "terms" | "privacy" | "cookie",
  language: string,
): Promise<PublishedLegalDocumentContent> {
  const res = await rawHttpClient.get<PublishedLegalDocumentContent>(
    `/api/v1/legal/documents/${documentType}`,
    { params: { language } },
  );
  return res.data;
}

export type ResendVerificationRequest = {
  email: string;
};

export type ResendVerificationResponse = {
  message: string;
};

export async function resendVerificationEmail(
  payload: ResendVerificationRequest,
): Promise<ResendVerificationResponse> {
  const res = await rawHttpClient.post<ResendVerificationResponse>(
    "/api/v1/auth/verify/resend",
    payload,
  );
  return res.data;
}

export async function verifyEmailToken(token: string): Promise<void> {
  await rawHttpClient.get("/api/v1/auth/verify", { params: { token } });
}

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
};

export async function forgotPassword(
  payload: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> {
  const res = await rawHttpClient.post<ForgotPasswordResponse>(
    "/api/v1/auth/password/forgot",
    payload,
  );
  return res.data;
}

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const res = await rawHttpClient.post<ResetPasswordResponse>(
    "/api/v1/auth/password/reset",
    payload,
  );
  return res.data;
}

/**
 * Logout function - calls backend to invalidate session and clear cookies
 * Backend clears HttpOnly cookies automatically
 */
export async function logout(): Promise<void> {
  await rawHttpClient.post("/api/v1/auth/logout");
}

// Session Management API
export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

export interface AuthSessionsListResponse {
  sessions: SessionInfo[];
}

export interface RevokeSessionsRequest {
  sessionId?: string | null;
  revokeAll?: boolean;
  revokeOthers?: boolean;
}

export interface RevokeSessionsResponse {
  revoked: number;
}

/**
 * List all active sessions for the current user
 */
export async function listAuthSessions(): Promise<AuthSessionsListResponse> {
  const res = await apiClient.get<AuthSessionsListResponse>("/api/v1/auth/sessions");
  return res.data;
}

/**
 * Revoke one or more sessions
 */
export async function revokeAuthSessions(
  payload: RevokeSessionsRequest,
): Promise<RevokeSessionsResponse> {
  const res = await apiClient.post<RevokeSessionsResponse>("/api/v1/auth/sessions/revoke", payload);
  return res.data;
}

// Two-Factor Authentication API
export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  message: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  backupCodesRemaining?: number;
}

export async function setup2FA(): Promise<TwoFactorSetupResponse> {
  const res = await apiClient.get<TwoFactorSetupResponse>("/api/v1/auth/2fa/setup");
  return res.data;
}

export async function verify2FA(code: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    "/api/v1/auth/2fa/verify",
    { code },
  );
  return res.data;
}

export interface TwoFactorStepUpRequest {
  password: string;
  code: string;
}

export async function disable2FA(
  payload: TwoFactorStepUpRequest,
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    "/api/v1/auth/2fa/disable",
    payload,
  );
  return res.data;
}

export async function regenerate2FABackupCodes(
  payload: TwoFactorStepUpRequest,
): Promise<{ message: string; backupCodes: string[] }> {
  const res = await apiClient.post<{ message: string; backupCodes: string[] }>(
    "/api/v1/auth/2fa/backup-codes/regenerate",
    payload,
  );
  return res.data;
}

export async function restart2FASetup(
  payload: TwoFactorStepUpRequest,
): Promise<TwoFactorSetupResponse> {
  const res = await apiClient.post<TwoFactorSetupResponse>("/api/v1/auth/2fa/setup", payload);
  return res.data;
}

export async function get2FAStatus(): Promise<TwoFactorStatusResponse> {
  const res = await apiClient.get<TwoFactorStatusResponse>("/api/v1/auth/2fa/status");
  return res.data;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  await apiClient.post("/api/v1/users/change-password", payload);
}

export type UserPreferences = SharedUserPreferences;

export type UpdatePreferencesRequest = UpdateUserPreferences;

export async function getUserPreferences(): Promise<UserPreferences> {
  const res = await apiClient.get<UserPreferences>("/api/v1/users/me/preferences");
  return res.data;
}

export async function updateUserPreferences(
  payload: UpdatePreferencesRequest,
): Promise<UserPreferences> {
  const res = await apiClient.patch<UserPreferences>("/api/v1/users/me/preferences", payload);
  return res.data;
}

export interface PrivacySettings {
  defaultVisibility: SessionVisibility;
  allowFollowers: boolean;
  showEmail: boolean;
  showWeight: boolean;
  showFitnessLevel: boolean;
}

export async function getPrivacySettings(): Promise<PrivacySettings> {
  const res = await apiClient.get<PrivacySettings>("/api/v1/users/me/privacy");
  return res.data;
}

export async function updatePrivacySettings(
  payload: Partial<PrivacySettings>,
): Promise<PrivacySettings> {
  const res = await apiClient.patch<PrivacySettings>("/api/v1/users/me/privacy", payload);
  return res.data;
}

export interface DeleteAccountRequest {
  password: string;
}

export interface DeleteAccountResponse {
  status: "pending_deletion";
  scheduledAt: string;
  purgeDueAt: string;
  backupPurgeDueAt: string;
}

export async function deleteAccount(payload: DeleteAccountRequest): Promise<DeleteAccountResponse> {
  const res = await apiClient.delete<DeleteAccountResponse>("/api/v1/users/me", { data: payload });
  return res.data;
}

export async function exportUserData(): Promise<Blob> {
  const res = await apiClient.get<Blob>("/api/v1/users/me/export", {
    responseType: "blob",
  });
  return res.data;
}
