import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  getAccount,
  getAccountSessions,
  updateAccount,
  uploadAvatar,
  deleteAccount,
  addRecoveryEmail,
} from "../api.js";
import { useNavigate } from "react-router-dom";

export default function Account() {
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [form, setForm] = useState({});
  const [sessions, setSessions] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    getAccount()
      .then((data) => {
        setProfile(data.profile);
        setForm(data.profile);
        setBadges(data.badges);
      })
      .catch(() => setProfile({}));

    getAccountSessions().then(setSessions).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const updated = await updateAccount(form);
    setProfile(updated);
    alert("Profile updated!");
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadAvatar(file);
    setForm({ ...form, photo_url: url });
    setProfile({ ...profile, photo_url: url });
  }

  async function handleRecoveryEmail(e) {
    e.preventDefault();
    const email = prompt("Enter a recovery email:");
    if (email) {
      await addRecoveryEmail(email);
      alert("Recovery email added!");
    }
  }

  async function confirmDelete() {
    await deleteAccount();
    localStorage.clear();
    alert("Your account has been deleted.");
    nav("/login");
  }

  function renderDay(date) {
    const daySessions = sessions.filter((s) => {
      const day = new Date(s.completed_at || s.planned_for);
      return (
        day.getFullYear() === date.getFullYear() &&
        day.getMonth() === date.getMonth() &&
        day.getDate() === date.getDate()
      );
    });

    if (daySessions.length === 0) return null;

    return (
      <div className="flex flex-col space-y-1 mt-1">
        {daySessions.map((s) => (
          <div
            key={s.id}
            className={`text-xs rounded px-1 py-0.5 text-white ${
              s.status === "completed"
                ? "bg-green-600"
                : "bg-gradient-to-r from-indigo-500 to-purple-600"
            }`}
          >
            {s.title}
          </div>
        ))}
      </div>
    );
  }

  if (!profile) return <div className="container">Loading...</div>;

  return (
    <div className="container grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Profile Form */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Avatar Upload */}
          <div className="flex items-center space-x-4">
            {form.photo_url ? (
              <img
                src={form.photo_url}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-sm text-gray-500">No Photo</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleAvatarChange} />
          </div>

          <input
            value={form.alias || ""}
            onChange={(e) => setForm({ ...form, alias: e.target.value })}
            className="w-full border rounded p-2"
            placeholder="Alias"
          />
          <input
            type="number"
            step="0.1"
            value={form.weight || ""}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            className="w-full border rounded p-2"
            placeholder="Weight"
          />
          <select
            value={form.fitness_level || ""}
            onChange={(e) => setForm({ ...form, fitness_level: e.target.value })}
            className="w-full border rounded p-2"
          >
            <option value="">Fitness Level</option>
            <option>beginner</option>
            <option>intermediate</option>
            <option>advanced</option>
          </select>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded">
            Save
          </button>
        </form>

        {/* Recovery Email */}
        <button
          onClick={handleRecoveryEmail}
          className="mt-2 text-sm text-blue-600 underline"
        >
          Add Recovery Email
        </button>
      </div>

      {/* Badges */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Badges</h2>
        {badges.length === 0 && <p>No badges yet.</p>}
        <ul className="space-y-2">
          {badges.map((b) => (
            <li key={b.id} className="border rounded p-2">
              <strong>{b.name}</strong>
              <p className="text-sm text-gray-600">{b.description}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Calendar */}
      <div className="card lg:col-span-2">
        <h2 className="text-xl font-semibold mb-2">My Sessions Calendar</h2>
        <Calendar
          tileContent={({ date }) => renderDay(date)}
          className="rounded-lg shadow-md w-full"
        />
      </div>

      {/* Delete Account */}
      <div className="card lg:col-span-2 text-center">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">
              Are you sure you want to delete your account?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded bg-red-600 text-white"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
