import { vi } from "vitest";
import type * as api from "../../src/services/api";

/**
 * Create a mock API object with all API methods mocked
 * This provides a consistent way to mock the API across tests
 */
export function createMockApi() {
  return {
    // Session methods
    getSession: vi.fn<Parameters<typeof api.getSession>, ReturnType<typeof api.getSession>>(),
    updateSession: vi.fn<
      Parameters<typeof api.updateSession>,
      ReturnType<typeof api.updateSession>
    >(),
    createSession: vi.fn<
      Parameters<typeof api.createSession>,
      ReturnType<typeof api.createSession>
    >(),
    deleteSession: vi.fn<
      Parameters<typeof api.deleteSession>,
      ReturnType<typeof api.deleteSession>
    >(),
    listSessions: vi.fn<Parameters<typeof api.listSessions>, ReturnType<typeof api.listSessions>>(),

    // Exercise methods
    getExercise: vi.fn<Parameters<typeof api.getExercise>, ReturnType<typeof api.getExercise>>(),
    createExercise: vi.fn<
      Parameters<typeof api.createExercise>,
      ReturnType<typeof api.createExercise>
    >(),
    updateExercise: vi.fn<
      Parameters<typeof api.updateExercise>,
      ReturnType<typeof api.updateExercise>
    >(),
    deleteExercise: vi.fn<
      Parameters<typeof api.deleteExercise>,
      ReturnType<typeof api.deleteExercise>
    >(),
    listExercises: vi.fn<
      Parameters<typeof api.listExercises>,
      ReturnType<typeof api.listExercises>
    >(),

    // Auth methods
    login: vi.fn<Parameters<typeof api.login>, ReturnType<typeof api.login>>(),
    startRegistration: vi.fn<
      Parameters<typeof api.startRegistration>,
      ReturnType<typeof api.startRegistration>
    >(),
    getRegistrationIntent: vi.fn<
      Parameters<typeof api.getRegistrationIntent>,
      ReturnType<typeof api.getRegistrationIntent>
    >(),
    completeRegistration: vi.fn<
      Parameters<typeof api.completeRegistration>,
      ReturnType<typeof api.completeRegistration>
    >(),
    logout: vi.fn<Parameters<typeof api.logout>, ReturnType<typeof api.logout>>(),
    refreshToken: vi.fn<Parameters<typeof api.refreshToken>, ReturnType<typeof api.refreshToken>>(),
    resendVerificationEmail: vi.fn<
      Parameters<typeof api.resendVerificationEmail>,
      ReturnType<typeof api.resendVerificationEmail>
    >(),

    // User methods
    getCurrentUser: vi.fn<
      Parameters<typeof api.getCurrentUser>,
      ReturnType<typeof api.getCurrentUser>
    >(),
    updateUser: vi.fn<Parameters<typeof api.updateUser>, ReturnType<typeof api.updateUser>>(),
    deleteUser: vi.fn<Parameters<typeof api.deleteUser>, ReturnType<typeof api.deleteUser>>(),

    // Dashboard/Analytics methods
    getDashboardAnalytics: vi.fn<
      Parameters<typeof api.getDashboardAnalytics>,
      ReturnType<typeof api.getDashboardAnalytics>
    >(),
    getProgress: vi.fn<Parameters<typeof api.getProgress>, ReturnType<typeof api.getProgress>>(),
    getInsights: vi.fn<Parameters<typeof api.getInsights>, ReturnType<typeof api.getInsights>>(),

    // Feed methods
    getFeed: vi.fn<Parameters<typeof api.getFeed>, ReturnType<typeof api.getFeed>>(),
    createFeedPost: vi.fn<
      Parameters<typeof api.createFeedPost>,
      ReturnType<typeof api.createFeedPost>
    >(),

    // Plan methods
    getPlan: vi.fn<Parameters<typeof api.getPlan>, ReturnType<typeof api.getPlan>>(),
    createPlan: vi.fn<Parameters<typeof api.createPlan>, ReturnType<typeof api.createPlan>>(),
    updatePlan: vi.fn<Parameters<typeof api.updatePlan>, ReturnType<typeof api.updatePlan>>(),
    deletePlan: vi.fn<Parameters<typeof api.deletePlan>, ReturnType<typeof api.deletePlan>>(),
    listPlans: vi.fn<Parameters<typeof api.listPlans>, ReturnType<typeof api.listPlans>>(),

    // Health check
    getHealthStatus: vi.fn<
      Parameters<typeof api.getHealthStatus>,
      ReturnType<typeof api.getHealthStatus>
    >(),
  };
}

/**
 * Reset all mocks in a mock API object
 * Useful in beforeEach hooks
 */
export function resetMockApi(mocks: ReturnType<typeof createMockApi>): void {
  Object.values(mocks).forEach((mock) => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
}
