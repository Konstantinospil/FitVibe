import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Library from "../../src/pages/Library";
import * as api from "../../src/services/api";
import { createTestQueryClient, cleanupQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../src/store/auth.store", () => ({
  useAuthStore: (selector: (state: any) => any) => selector({ user: { id: "user-1", username: "u", email: "u@example.test" } }),
}));
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return { ...actual, listExercises: vi.fn(), listExerciseTypes: vi.fn(), deleteExercise: vi.fn() };
});
vi.mock("../../src/components/composites/ExerciseCreator", () => ({
  default: ({ open, exercise }: { open: boolean; exercise?: api.Exercise | null }) => open ? <div>{exercise ? "creator-edit" : "creator-create"}</div> : null,
}));
vi.mock("../../src/components/composites/WorkoutEditor", () => ({
  default: ({ open, initialExercise }: { open: boolean; initialExercise?: Pick<api.Exercise, "id" | "name"> | null }) => open ? <div>{initialExercise ? "workout-seeded" : "workout-empty"}</div> : null,
}));

describe("Library", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.mocked(api.listExerciseTypes).mockResolvedValue([{ code: "strength", name: "Strength" }]);
    vi.mocked(api.listExercises).mockResolvedValue({
      data: [
        { id:"g", name:"Global", type_code:"strength", owner_id:null, muscle_group:null, equipment:null, tags:[], is_public:true, description_en:null, description_de:null },
        { id:"m", name:"Mine", type_code:"strength", owner_id:"user-1", muscle_group:null, equipment:null, tags:[], is_public:false, description_en:null, description_de:null },
        { id:"p", name:"Public", type_code:"strength", owner_id:"user-2", muscle_group:null, equipment:null, tags:[], is_public:true, description_en:null, description_de:null },
      ],
      total: 3,
      limit: 20,
      offset: 0,
    });
  });
  afterEach(async () => { await cleanupQueryClient(queryClient); vi.clearAllMocks(); });

  const renderLibrary = () => render(<QueryClientProvider client={queryClient}><Library /></QueryClientProvider>);

  it("renders global, owned and public exercises distinctly", async () => {
    renderLibrary();
    expect(await screen.findByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("librarySurface.source.global")).toBeInTheDocument();
    expect(screen.getByText("librarySurface.source.mine")).toBeInTheDocument();
    expect(screen.getByText("librarySurface.source.public")).toBeInTheDocument();
  });

  it("uses the canonical server search query", async () => {
    renderLibrary();
    await screen.findByText("Global");
    fireEvent.change(screen.getByLabelText("librarySurface.filters.search"), { target: { value: "squat" } });
    await waitFor(() => expect(vi.mocked(api.listExercises)).toHaveBeenLastCalledWith(expect.objectContaining({ q: "squat", limit: 20, offset: 0 })));
  });

  it("opens recovered creator and workout editor workflows", async () => {
    renderLibrary();
    await screen.findByText("Global");
    fireEvent.click(screen.getByRole("button", { name: "librarySurface.actions.createExercise" }));
    expect(screen.getByText("creator-create")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "librarySurface.actions.addToWorkout" })[0]);
    expect(screen.getByText("workout-seeded")).toBeInTheDocument();
  });
});
export {};
