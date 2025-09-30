import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

// --- Token Handling ---
let accessToken = localStorage.getItem("access") || null;
let refreshToken = localStorage.getItem("refresh") || null;

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh || refreshToken;
  localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

function auth() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// --- Axios instance ---
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// --- Refresh logic ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const r = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        setTokens(r.data.accessToken, r.data.refreshToken);

        api.defaults.headers.common["Authorization"] =
          "Bearer " + r.data.accessToken;

        processQueue(null, r.data.accessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// --- API functions ---

// Auth
export async function login(username, password) {
  const r = await api.post("/auth/login", { username, password });
  setTokens(r.data.accessToken, r.data.refreshToken);
  return r.data;
}

export async function logout() {
  if (refreshToken) {
    await api.post("/auth/logout", { refreshToken });
  }
  clearTokens();
}

export async function register(payload) {
  const r = await api.post("/auth/register", payload);
  return r.data;
}

// Exercises
export async function listExercises() {
  const r = await api.get("/exercises");
  return r.data;
}

// Sessions
export async function createSession(payload) {
  const r = await api.post("/sessions", payload, { headers: auth() });
  return r.data;
}

export async function addExerciseToSession(id, payload) {
  const r = await api.post(`/sessions/${id}/exercise`, payload, {
    headers: auth(),
  });
  return r.data;
}

export async function completeSession(id, subjective_day_fitness) {
  const r = await api.post(
    `/sessions/${id}/complete`,
    { subjective_day_fitness },
    { headers: auth() }
  );
  return r.data;
}

export async function mySessions() {
  const r = await api.get("/sessions/mine", { headers: auth() });
  return r.data;
}

// Feed
export async function getFeed() {
  const r = await api.get("/feed");
  return r.data;
}

// Account
export async function getAccount() {
  const r = await api.get("/account", { headers: auth() });
  return r.data;
}

export async function updateAccount(profile) {
  const r = await api.put("/account", profile, { headers: auth() });
  return r.data;
}

export async function getAccountSessions() {
  const r = await api.get("/account/sessions", { headers: auth() });
  return r.data;
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);
  const r = await api.post("/account/avatar", formData, {
    headers: { ...auth(), "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function addRecoveryEmail(email) {
  const r = await api.post("/account/recovery-email", { email }, {
    headers: auth(),
  });
  return r.data;
}

export async function deleteAccount() {
  const r = await api.delete("/account", { headers: auth() });
  clearTokens();
  return r.data;
}
