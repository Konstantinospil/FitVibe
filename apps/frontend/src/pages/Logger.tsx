import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pause, Check, Clock, ChevronDown, ChevronUp, Eye } from "lucide-react";
import PageIntro from "../components/PageIntro";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { VisibilityBadge } from "../components/ui";
import {
  getSession,
  updateSession,
  type SessionWithExercises,
  type SessionExerciseInput,
} from "../services/api";
import { logger } from "../utils/logger";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { SessionVisibility } from "@fitvibe/contracts";
import { InputControl, SelectControl } from "@fitvibe/ui";

interface LoggedSet {
  order: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  notes: string | null;
  completed: boolean;
}

interface ExerciseLog {
  exercise_id: string | null;
  order: number;
  notes: string | null;
  sets: LoggedSet[];
  completed: boolean;
  collapsed: boolean;
}

const Logger: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  // Session data
  const [session, setSession] = useState<SessionWithExercises | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionVisibility, setSessionVisibility] = useState<SessionVisibility>("private");
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  // Timer state
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);

  // Rest timer
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [restDuration] = useState(90); // default rest period
  const restIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Confirmation dialog state
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Load session
  useEffect(() => {
    if (!sessionId) {
      void navigate("/sessions");
      return;
    }

    const loadSession = async () => {
      try {
        const data = await getSession(sessionId);
        setSession(data);

        // Initialize exercise logs from planned session
        const logs: ExerciseLog[] = data.exercises.map((ex) => ({
          exercise_id: ex.exercise_id || null,
          order: ex.order_index,
          notes: ex.notes || null,
          sets:
            ex.sets && ex.sets.length > 0
              ? ex.sets.map((set) => ({
                  order: set.order_index,
                  reps: set.reps || null,
                  weight_kg: set.weight_kg || null,
                  rpe: set.rpe || null,
                  notes: set.notes || null,
                  completed: false,
                }))
              : Array.from({ length: ex.planned?.sets || 3 }, (_, i) => ({
                  order: i,
                  reps: ex.planned?.reps || null,
                  weight_kg: ex.planned?.load || null,
                  rpe: ex.planned?.rpe || null,
                  notes: null,
                  completed: false,
                })),
          completed: false,
          collapsed: false,
        }));
        setExerciseLogs(logs);

        // Set visibility state
        if (data.visibility) {
          setSessionVisibility(data.visibility as SessionVisibility);
        }

        // Start session timer if not already started. Use Date.now() so visual
        // tests can freeze elapsed time without replacing the Date constructor.
        if (data.status === "planned") {
          const now = new Date(Date.now());
          setSessionStartTime(now);
          await updateSession(sessionId, {
            status: "in_progress",
            started_at: now.toISOString(),
          });
        } else if (data.started_at) {
          setSessionStartTime(new Date(data.started_at));
        }
      } catch (error) {
        logger.apiError("Failed to load session", error, `/api/v1/sessions/${sessionId}`, "GET");
        toast.error("Failed to load session");
        void navigate("/sessions");
      } finally {
        setLoading(false);
      }
    };

    void loadSession();
  }, [sessionId, navigate, toast]);

  // Session timer
  useEffect(() => {
    if (!sessionStartTime) {
      return;
    }

    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - sessionStartTime.getTime()) / 1000));
      setSessionElapsedSeconds(elapsed);
    };
    tick();
    sessionIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
      }
    };
  }, [sessionStartTime]);

  // Rest timer
  useEffect(() => {
    if (!restTimerActive) {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
      }
      return;
    }

    restIntervalRef.current = setInterval(() => {
      setRestSecondsRemaining((prev) => {
        if (prev <= 1) {
          setRestTimerActive(false);
          // Play notification sound or vibrate
          if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
      }
    };
  }, [restTimerActive]);

  const startRestTimer = (seconds: number = restDuration) => {
    setRestSecondsRemaining(seconds);
    setRestTimerActive(true);
  };

  const stopRestTimer = () => {
    setRestTimerActive(false);
    setRestSecondsRemaining(0);
  };

  const updateSetData = (exerciseIndex: number, setIndex: number, updates: Partial<LoggedSet>) => {
    setExerciseLogs((logs) =>
      logs.map((log, exIdx) =>
        exIdx === exerciseIndex
          ? {
              ...log,
              sets: log.sets.map((set, setIdx) =>
                setIdx === setIndex ? { ...set, ...updates } : set,
              ),
            }
          : log,
      ),
    );
  };

  const toggleSetCompleted = (exerciseIndex: number, setIndex: number) => {
    setExerciseLogs((logs) => {
      const newLogs = logs.map((log, exIdx) =>
        exIdx === exerciseIndex
          ? {
              ...log,
              sets: log.sets.map((set, setIdx) =>
                setIdx === setIndex ? { ...set, completed: !set.completed } : set,
              ),
            }
          : log,
      );

      // Auto-start rest timer when completing a set
      const exercise = newLogs[exerciseIndex];
      const set = exercise.sets[setIndex];
      if (set.completed && !restTimerActive) {
        startRestTimer();
      }

      return newLogs;
    });
  };

  const toggleExerciseCollapsed = (exerciseIndex: number) => {
    setExerciseLogs((logs) =>
      logs.map((log, idx) => (idx === exerciseIndex ? { ...log, collapsed: !log.collapsed } : log)),
    );
  };

  const handleCompleteSession = () => {
    setShowCompleteConfirm(true);
  };

  const confirmCompleteSession = async () => {
    if (!session || !sessionId) {
      return;
    }

    setShowCompleteConfirm(false);
    setIsSaving(true);
    setSaveError(null);

    try {
      // Build session exercises with actual logged data
      const sessionExercises: SessionExerciseInput[] = exerciseLogs.map((log) => ({
        exercise_id: log.exercise_id,
        order: log.order,
        notes: log.notes,
        sets: log.sets.map((set) => ({
          order: set.order,
          reps: set.reps,
          weight_kg: set.weight_kg,
          rpe: set.rpe,
          notes: set.notes || null,
        })),
      }));

      await updateSession(sessionId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        exercises: sessionExercises,
      });

      toast.success("Session completed successfully!");
      void navigate("/sessions");
    } catch (error) {
      logger.apiError(
        "Failed to complete session",
        error,
        `/api/v1/sessions/${sessionId}`,
        "PATCH",
      );
      setSaveError("Failed to complete session. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const handleVisibilityChange = async (newVisibility: SessionVisibility) => {
    if (!sessionId || newVisibility === sessionVisibility) {
      return;
    }

    setIsUpdatingVisibility(true);
    try {
      await updateSession(sessionId, {
        visibility: newVisibility,
      });
      setSessionVisibility(newVisibility);
      toast.success(t("logger.visibilityUpdated"));
    } catch (error) {
      logger.apiError(
        "Failed to update session visibility",
        error,
        `/api/v1/sessions/${sessionId}`,
        "PATCH",
      );
      toast.error(t("logger.visibilityUpdateFailed"));
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  if (loading) {
    return (
      <PageIntro
        eyebrow={t("logger.eyebrow")}
        title={t("logger.title")}
        description={t("logger.description")}
      >
        <Card>
          <CardContent>
            <div className="empty-state">{t("common.loading")}</div>
          </CardContent>
        </Card>
      </PageIntro>
    );
  }

  if (!session) {
    return null;
  }

  const completedSetsCount = exerciseLogs.reduce(
    (sum, log) => sum + log.sets.filter((s) => s.completed).length,
    0,
  );
  const totalSetsCount = exerciseLogs.reduce((sum, log) => sum + log.sets.length, 0);

  return (
    <PageIntro
      eyebrow={t("logger.eyebrow")}
      title={session.title || "Workout Session"}
      description={`${exerciseLogs.length} exercises • ${completedSetsCount}/${totalSetsCount} sets completed`}
    >
      <div className="grid grid--gap-15">
        {/* Session Info Bar */}
        <Card>
          <CardContent>
            <div className="flex flex--align-center flex--justify-between flex--wrap flex--gap-md">
              <div className="flex flex--align-center flex--gap-15">
                <div>
                  <div className="text-085 text-secondary mb-025">Session Time</div>
                  <div
                    className="text-xl font-weight-600"
                    style={{ fontFamily: "monospace" }}
                    data-testid="session-elapsed-time"
                  >
                    {formatTime(sessionElapsedSeconds)}
                  </div>
                </div>

                {restTimerActive && (
                  <div>
                    <div className="text-085 text-secondary mb-025">Rest Timer</div>
                    <div
                      className="text-xl font-weight-600 text-accent"
                      style={{ fontFamily: "monospace" }}
                    >
                      {formatTime(restSecondsRemaining)}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex--gap-075">
                {restTimerActive ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={stopRestTimer}
                    leftIcon={<Pause size={16} />}
                  >
                    Stop Rest
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => startRestTimer()}
                    leftIcon={<Clock size={16} />}
                  >
                    Start Rest ({restDuration}s)
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleCompleteSession()}
                  isLoading={isSaving}
                  leftIcon={<Check size={16} />}
                  disabled={completedSetsCount === 0}
                >
                  Complete Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {saveError && <div className="alert alert--error p-md rounded-md">{saveError}</div>}

        {/* Session Visibility Settings */}
        <Card>
          <CardHeader>
            <div className="flex flex--align-center flex--gap-sm">
              <Eye size={20} />
              <CardTitle>{t("logger.visibilitySettings")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex--align-center flex--justify-between flex--wrap flex--gap-md">
              <div>
                <div className="text-085 text-secondary mb-025">
                  {t("logger.currentVisibility")}
                </div>
                <VisibilityBadge level={sessionVisibility} />
              </div>
              <SelectControl
                value={sessionVisibility}
                onChange={(e) => void handleVisibilityChange(e.target.value as SessionVisibility)}
                disabled={isUpdatingVisibility}
                className="form-input"
                style={{ background: "var(--color-surface)", minWidth: "150px" }}
                aria-label={t("logger.visibilityLabel")}
              >
                <option value="private">{t("logger.visibilityPrivate")}</option>
                <option value="followers">{t("visibility.labels.followers")}</option>
                <option value="link">{t("logger.visibilityLink")}</option>
                <option value="public">{t("logger.visibilityPublic")}</option>
              </SelectControl>
            </div>
            <p className="mt-05 text-085 text-muted">{t("logger.visibilityHelp")}</p>
          </CardContent>
        </Card>

        {/* Exercise List */}
        {exerciseLogs.map((exerciseLog, exerciseIndex) => {
          const completedSets = exerciseLog.sets.filter((s) => s.completed).length;
          const totalSets = exerciseLog.sets.length;

          return (
            <Card key={exerciseIndex}>
              <CardHeader>
                <div className="flex flex--align-center flex--justify-between">
                  <div className="flex-1">
                    <CardTitle>
                      {exerciseIndex + 1}. {exerciseLog.exercise_id || "Custom Exercise"}
                    </CardTitle>
                    <div className="text-085 text-secondary mt-025">
                      {completedSets} / {totalSets} sets completed
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExerciseCollapsed(exerciseIndex)}
                    aria-label={exerciseLog.collapsed ? "Expand" : "Collapse"}
                    style={{
                      color: "var(--color-text-secondary)",
                      padding: "0.5rem",
                      lineHeight: 0,
                      boxShadow: "none",
                    }}
                  >
                    {exerciseLog.collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                  </Button>
                </div>
              </CardHeader>

              {!exerciseLog.collapsed && (
                <CardContent>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {/* Set Headers */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 1fr 1fr 1fr 40px",
                        gap: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "var(--color-text-secondary)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <div>Set</div>
                      <div>Reps</div>
                      <div>Weight (kg)</div>
                      <div>RPE</div>
                      <div></div>
                    </div>

                    {/* Sets */}
                    {exerciseLog.sets.map((set, setIndex) => (
                      <div
                        key={setIndex}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "40px 1fr 1fr 1fr 40px",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          background: set.completed
                            ? "var(--surface-accent-subtle)"
                            : "var(--color-surface-muted)",
                          borderRadius: "12px",
                          border: `1px solid ${set.completed ? "var(--border-accent-subtle)" : "var(--color-border)"}`,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 600, textAlign: "center" }}>{setIndex + 1}</div>

                        <InputControl
                          type="number"
                          min="0"
                          value={set.reps ?? ""}
                          onChange={(e) =>
                            updateSetData(exerciseIndex, setIndex, {
                              reps: parseInt(e.target.value) || null,
                            })
                          }
                          placeholder={t("logger.repsPlaceholder")}
                          disabled={set.completed}
                          className="logger-set-input"
                          style={{
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: set.completed
                              ? "var(--control-disabled-bg)"
                              : "var(--color-surface)",
                            color: "var(--color-text-primary)",
                            textAlign: "center",
                          }}
                        />

                        <InputControl
                          type="number"
                          step="0.5"
                          min="0"
                          value={set.weight_kg ?? ""}
                          onChange={(e) =>
                            updateSetData(exerciseIndex, setIndex, {
                              weight_kg: parseFloat(e.target.value) || null,
                            })
                          }
                          placeholder={t("logger.weightPlaceholder")}
                          disabled={set.completed}
                          className="logger-set-input"
                          style={{
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: set.completed
                              ? "var(--control-disabled-bg)"
                              : "var(--color-surface)",
                            color: "var(--color-text-primary)",
                            textAlign: "center",
                          }}
                        />

                        <InputControl
                          type="number"
                          min="1"
                          max="10"
                          value={set.rpe ?? ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateSetData(exerciseIndex, setIndex, {
                              rpe: val >= 1 && val <= 10 ? val : null,
                            });
                          }}
                          placeholder={t("logger.rpePlaceholder")}
                          disabled={set.completed}
                          className="logger-set-input"
                          style={{
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: set.completed
                              ? "var(--control-disabled-bg)"
                              : "var(--color-surface)",
                            color: "var(--color-text-primary)",
                            textAlign: "center",
                          }}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSetCompleted(exerciseIndex, setIndex)}
                          aria-label={set.completed ? "Mark incomplete" : "Mark complete"}
                          aria-pressed={set.completed}
                          style={{
                            width: "36px",
                            height: "36px",
                            padding: 0,
                            borderRadius: "8px",
                            border: set.completed ? "none" : "2px solid var(--color-border)",
                            background: set.completed ? "var(--color-accent)" : "transparent",
                            color: set.completed
                              ? "var(--color-accent-on)"
                              : "var(--color-text-secondary)",
                            boxShadow: "none",
                          }}
                        >
                          {set.completed && <Check size={18} />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Bottom Actions */}
        <Card>
          <CardContent>
            <div className="flex flex--wrap flex--justify-between flex--gap-md">
              <Button variant="secondary" onClick={() => void navigate("/sessions")}>
                Save & Exit
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleCompleteSession();
                }}
                isLoading={isSaving}
                leftIcon={<Check size={18} />}
                disabled={completedSetsCount === 0}
              >
                {isSaving ? "Completing..." : "Complete Session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showCompleteConfirm}
        title="Complete Session"
        message="Are you sure you want to complete this session? This action cannot be undone."
        confirmLabel="Yes, Complete Session"
        cancelLabel="Cancel"
        variant="info"
        onConfirm={() => void confirmCompleteSession()}
        onCancel={() => setShowCompleteConfirm(false)}
      />
    </PageIntro>
  );
};

export default Logger;
