import { useNavigate } from "react-router-dom";
import { login, setTokens } from "../api.js";   // adjust path if needed
import Register from "./Register.jsx";          // import the Register page/component

export default function Login({ onAuthed }) {
  const nav = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const r = await login(fd.get("username"), fd.get("password"));
      setTokens(r.accessToken, r.refreshToken);
      onAuthed();               // mark user as logged in
      nav("/dashboard");        // navigate to dashboard
    } catch {
      alert("Login failed");
    }
  }

  return (
    <div className="container grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Login</h2>
        <form onSubmit={onSubmit} className="space-y-2">
          <input
            name="username"
            placeholder="Username"
            className="w-full border rounded-lg p-2"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            className="w-full border rounded-lg p-2"
          />
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
            Login
          </button>
        </form>
      </div>
      <Register />
    </div>
  );
}