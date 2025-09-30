import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";

// Import pages
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Account from "./pages/Account.jsx";

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("access"));

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar authed={authed} onLogout={() => setAuthed(false)} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login onAuthed={() => setAuthed(true)} />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/account" element={<Account />} />
          <Route
            path="*"
            element={
              <div className="container">
                <div className="card">Not found</div>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="text-center text-sm text-gray-500 py-4">
        © {new Date().getFullYear()} FitVibe
      </footer>
    </div>
  );
}