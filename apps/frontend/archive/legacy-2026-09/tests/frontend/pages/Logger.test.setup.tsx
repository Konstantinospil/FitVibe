import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import Logger from "../../src/pages/Logger";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { ToastProvider } from "../../src/contexts/ToastContext";

// Mock navigate
export const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Initialize i18n for tests
export const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "logger.eyebrow": "Workout",
        "logger.title": "Logger",
        "logger.description": "Log your workout",
        "common.loading": "Loading...",
        "logger.repsPlaceholder": "Reps",
        "logger.weightPlaceholder": "Weight",
        "logger.rpePlaceholder": "RPE",
        "logger.visibilitySettings": "Session Visibility",
        "logger.currentVisibility": "Current visibility",
        "logger.visibilityUpdated": "Session visibility updated",
        "logger.visibilityUpdateFailed": "Failed to update visibility",
        "logger.visibilityLabel": "Change session visibility",
        "logger.visibilityPrivate": "Private",
        "logger.visibilityLink": "Link only",
        "logger.visibilityPublic": "Public",
        "logger.visibilityHelp":
          "Private sessions are only visible to you. Link sessions can be shared via link. Public sessions appear in the community feed.",
      },
    },
  },
});

export const renderLogger = (sessionId: string = "test-session-id") => {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/logger/${sessionId}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/logger/:sessionId" element={<Logger />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    </ToastProvider>,
  );
};

export const mockSessionData = {
  id: "test-session-id",
  owner_id: "user-1",
  title: "Test Workout",
  planned_at: "2024-01-15T10:00:00Z",
  status: "planned" as const,
  visibility: "private" as const,
  exercises: [
    {
      id: "ex-1",
      exercise_id: "bench-press",
      order_index: 0,
      notes: "Warm up first",
      planned: {
        sets: 3,
        reps: 10,
        load: 80,
        rpe: 7,
      },
      sets: [],
    },
  ],
};
