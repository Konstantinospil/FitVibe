import type React from "react";
import { Suspense, lazy } from "react";
import type { WorkoutEditorProps } from "./WorkoutEditor";

const WorkoutEditor = lazy(() => import("./WorkoutEditor"));

/**
 * The workout editor, downloaded the first time it opens. Pages that offer it
 * (Plan, Library) render it on demand, so its code (exercise picker, set fields,
 * interval and circuit blocks) stays out of their initial load and LCP path.
 */
export const LazyWorkoutEditor: React.FC<WorkoutEditorProps> = (props) =>
  props.open ? (
    <Suspense fallback={null}>
      <WorkoutEditor {...props} />
    </Suspense>
  ) : null;
