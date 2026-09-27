import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";
import { useThemeColors } from "../hooks/useThemeColors";
import ThemeToggle from "../components/ThemeToggle";
import { authApi } from "../services/api";
import logoFull from "../assets/logo_full.png";
import logoFullDark from "../assets/logo_full_dark.png";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);
  const theme = useThemeStore((state) => state.theme);
  const colors = useThemeColors();

  const logo = useMemo<string>(() => {
    return theme === "dark" ? logoFullDark : logoFull;
  }, [theme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.login(email, password);
      const user = response.user;
      if (user && ["admin", "superadmin"].includes(user.role)) {
        signIn({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
        });
        void navigate("/");
      } else {
        setError("Access denied. Admin role required.");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: colors.bg,
      }}
    >
      <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem" }}>
        <ThemeToggle />
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2rem",
          background: colors.surface,
          borderRadius: "8px",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <img src={logo} alt="FitVibe Logo" style={{ height: "60px" }} loading="eager" />
        </div>
        <h1
          style={{
            color: colors.text,
            marginBottom: "1.5rem",
            fontSize: "1.5rem",
            textAlign: "center",
          }}
        >
          FitVibe Backoffice
        </h1>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: colors.text, marginBottom: "0.5rem" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                background: theme === "light" ? "#F5F5F5" : "#1A1A1A",
                border: `1px solid ${colors.border}`,
                borderRadius: "4px",
                color: colors.text,
                fontSize: "1rem",
              }}
            />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", color: colors.text, marginBottom: "0.5rem" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                background: theme === "light" ? "#F5F5F5" : "#1A1A1A",
                border: `1px solid ${colors.border}`,
                borderRadius: "4px",
                color: colors.text,
                fontSize: "1rem",
              }}
            />
          </div>
          {error && (
            <div style={{ color: colors.error, marginBottom: "1rem", fontSize: "0.875rem" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: loading ? colors.border : colors.accent,
              color: "#FFFFFF",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
