import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Settings from "../../src/pages/Settings";
import {
  addBodyWeight,
  apiClient,
  changePassword,
  deleteAccount,
  deleteBodyProgressPhoto,
  disable2FA,
  exportUserData,
  get2FAStatus,
  getBodyProgress,
  getCurrentUser,
  getPrivacySettings,
  getUserPreferences,
  listAuthSessions,
  revokeAuthSessions,
  setup2FA,
  updatePrivacySettings,
  updateUserPreferences,
  updateProfile,
  uploadBodyProgressPhoto,
  verify2FA,
} from "../../src/services/api";
import { ToastProvider } from "../../src/contexts/ToastContext";
import { AuthProvider } from "../../src/contexts/AuthContext";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18n from "i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../helpers/testQueryClient";
import enCommon from "../../src/i18n/locales/en/common.json";
import enAuth from "../../src/i18n/locales/en/auth.json";

vi.mock("../../src/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: "http://localhost:3000" },
  },
  getCurrentUser: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  setup2FA: vi.fn(),
  verify2FA: vi.fn(),
  disable2FA: vi.fn(),
  get2FAStatus: vi.fn(),
  listAuthSessions: vi.fn(),
  revokeAuthSessions: vi.fn(),
  getPrivacySettings: vi.fn(),
  updatePrivacySettings: vi.fn(),
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
  exportUserData: vi.fn(),
  deleteAccount: vi.fn(),
  getBodyProgress: vi.fn(),
  addBodyWeight: vi.fn(),
  uploadBodyProgressPhoto: vi.fn(),
  deleteBodyProgressPhoto: vi.fn(),
}));

export const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

export const mockUserData = {
  id: "user-1",
  username: "testuser",
  displayName: "Test User",
  email: "user@example.com",
  alias: "testalias",
  bio: "Training consistently",
  avatarUrl: null,
  weight: 75.5,
  weightUnit: "kg",
  fitnessLevel: "intermediate",
  trainingFrequency: "3_4_per_week",
  locale: "en",
  preferredLang: "en",
  defaultVisibility: "private",
  units: "metric",
  role: "athlete",
  status: "active",
};

const enResources = { ...enCommon, ...enAuth };
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  defaultNS: "translation",
  fallbackNS: "common",
  ns: ["translation", "common"],
  resources: { en: { translation: enResources, common: enResources } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export const renderSettings = () => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={testI18n}>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter>
              <Settings />
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

export const setupSettingsTests = () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();

  vi.mocked(getCurrentUser).mockResolvedValue(mockUserData);
  vi.mocked(updateProfile).mockImplementation(async (payload) => ({ ...mockUserData, ...payload }));
  vi.mocked(changePassword).mockResolvedValue(undefined);
  vi.mocked(get2FAStatus).mockResolvedValue({ enabled: false });
  vi.mocked(setup2FA).mockResolvedValue({
    qrCode: "data:image/png;base64,mock-qr-code",
    secret: "mock-secret",
    backupCodes: ["CODE1", "CODE2", "CODE3"],
    message: "2FA setup initiated",
  });
  vi.mocked(verify2FA).mockResolvedValue({ success: true, message: "2FA enabled successfully" });
  vi.mocked(disable2FA).mockResolvedValue({ success: true, message: "2FA disabled successfully" });
  vi.mocked(listAuthSessions).mockResolvedValue({ sessions: [] });
  vi.mocked(revokeAuthSessions).mockResolvedValue({ revoked: 0 });
  vi.mocked(getUserPreferences).mockResolvedValue({
    language: "en",
    measurementSystem: "metric",
  });
  vi.mocked(updateUserPreferences).mockImplementation(async (payload) => ({
    language: payload.language ?? "en",
    measurementSystem: payload.measurementSystem ?? "metric",
  }));
  vi.mocked(getPrivacySettings).mockResolvedValue({
    defaultVisibility: "private",
    allowFollowers: true,
    showEmail: false,
    showWeight: false,
    showFitnessLevel: false,
  });
  vi.mocked(updatePrivacySettings).mockImplementation(async (payload) => ({
    defaultVisibility: payload.defaultVisibility ?? "private",
    allowFollowers: payload.allowFollowers ?? true,
    showEmail: payload.showEmail ?? false,
    showWeight: payload.showWeight ?? false,
    showFitnessLevel: payload.showFitnessLevel ?? false,
  }));
  vi.mocked(exportUserData).mockResolvedValue(new Blob(["export"]));
  vi.mocked(deleteAccount).mockResolvedValue({
    status: "pending_deletion",
    scheduledAt: new Date().toISOString(),
    purgeDueAt: new Date().toISOString(),
    backupPurgeDueAt: new Date().toISOString(),
  });
  vi.mocked(getBodyProgress).mockResolvedValue({ weights: [], photos: [] });
  vi.mocked(addBodyWeight).mockResolvedValue({
    id: "weight-1",
    weightKg: 80,
    measuredAt: new Date().toISOString(),
  });
  vi.mocked(uploadBodyProgressPhoto).mockResolvedValue({
    id: "photo-1",
    fileUrl: "/api/v1/users/me/body-progress/photo/photo-1",
    mimeType: "image/jpeg",
    bytes: 1024,
    createdAt: new Date().toISOString(),
  });
  vi.mocked(deleteBodyProgressPhoto).mockResolvedValue(undefined);

  vi.mocked(apiClient.get).mockResolvedValue({ data: mockUserData });
  vi.mocked(apiClient.patch).mockResolvedValue({ data: mockUserData });
  vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
  vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

  return {
    mockGet: vi.mocked(apiClient.get),
    mockPatch: vi.mocked(apiClient.patch),
    mockPost: vi.mocked(apiClient.post),
    mockDelete: vi.mocked(apiClient.delete),
    mockGetCurrentUser: vi.mocked(getCurrentUser),
    mockUpdateProfile: vi.mocked(updateProfile),
    mockGet2FAStatus: vi.mocked(get2FAStatus),
    mockGetPrivacySettings: vi.mocked(getPrivacySettings),
    mockGetUserPreferences: vi.mocked(getUserPreferences),
    mockGetBodyProgress: vi.mocked(getBodyProgress),
  };
};
