import { useState, useEffect } from "react";
import {
  getFeed,
  mySessions,
  createSession,
  addExerciseToSession,
  completeSession,
} from "../api.js"; // adjust path if needed

export default function Dashboard() {
  const [feed, setFeed] = useState([]);
  const [my, setMy] = useState([]);
  const [title, setTitle] = useState("");
  const [sid, setSid] = useState(null);
  const [ex, setEx] = useState({
    name: "",
    sets: "",
    reps: "",
    distance_m: "",
    duration_s: "",
    load_kg: "",
    rpe: "",
  });

  // Load feed and my sessions once
  useEffect(() => {
    getFeed().then(setFeed).catch(() => {});
    mySessions().then(setMy).catch(() => {});
  }, []);

  async function create() {
    try {
      const s = await createSession({ title, visibility: "public" });
      setSid(s.id);
      alert("Session created: " + s.id);
    } catch (err) {
      console.error(err);
      alert("Failed to create session");
    }
  }

  async function add() {
    if (!sid) return alert("No session created yet");
    const p = {
      name: ex.name || "Exercise",
      actual_sets: +ex.sets || null,
      actual_total_reps: +ex.reps || null,
      actual_distance_m: +ex.distance_m || null,
      actual_duration_s: +ex.duration_s || null,
      actual_avg_load_kg: +ex.load_kg || null,
      actual_rpe: +ex.rpe || null,
    };
    try {
      await addExerciseToSession(sid, p);
      alert("Exercise added");
    } catch (err) {
      console.error(err);
      alert("Failed to add exercise");
    }
  }

  async function complete() {
    if (!sid) return alert("No session created yet");
    try {
      const u = await completeSession(sid, 6); // 6 = example fitness factor
      alert("Points: " + u.points_total);
      setMy(await mySessions());
    } catch (err) {
      console.error(err);
      alert("Failed to complete session");
    }
  }

  return (
    <div className="container">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Session planning + exercise logging */}
        <div className="card md:col-span-2">
          <h3 className="font-semibold mb-2">Plan Session</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="border rounded-lg p-2"
            />
            <button
              onClick={create}
              className="bg-indigo-600 text-white rounded-lg px-3 py-2"
            >
              Create
            </button>
          </div>

          <h3 className="font-semibold mt-4 mb-2">Log Exercise</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <input
              placeholder="Name"
              value={ex.name}
              onChange={(e) => setEx({ ...ex, name: e.target.value })}
              className="border rounded-lg p-2"
            />
            <input
              placeholder="Sets"
              value={ex.sets}
              onChange={(e) => setEx({ ...ex, sets: e.target.value })}
              className="border rounded-lg p-2"
            />
            <input
              placeholder="Reps"
              value={ex.reps}
              onChange={(e) => setEx({ ...ex, reps: e.target.value })}
              className="border rounded-lg p-2"
            />
            <input
              placeholder="Dist (m)"
              value={ex.distance_m}
              onChange={(e) => setEx({ ...ex, distance_m: e.target.value })}
              className="border rounded-lg p-2"
            />
            <input
              placeholder="Dur (s)"
              value={ex.duration_s}
              onChange={(e) => setEx({ ...ex, duration_s: e.target.value })}
              className="border rounded-lg p-2"
            />
            <input
              placeholder="Load (kg)"
              value={ex.load_kg}
              onChange={(e) => setEx({ ...ex, load_kg: e.target.value })}
              className="border rounded-lg p-2"
            />
          </div>

          <div className="mt-2">
            <button
              onClick={add}
              className="bg-green-600 text-white rounded-lg px-3 py-2"
            >
              Add Exercise
            </button>
            <button
              onClick={complete}
              className="bg-purple-600 text-white rounded-lg px-3 py-2 ml-2"
            >
              Complete Session
            </button>
          </div>
        </div>

        {/* Public feed */}
        <div className="card">
          <h3 className="font-semibold mb-2">Public Feed</h3>
          <ul className="space-y-1">
            {feed.map((f) => (
              <li key={f.id}>
                <strong>{f.title}</strong> — {f.points_total ?? "pending"}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* My sessions */}
      <div className="card mt-4">
        <h3 className="font-semibold mb-2">My Sessions</h3>
        <ul className="space-y-1">
          {my.map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong> — {s.status} — pts{" "}
              {s.points_total ?? "-"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}