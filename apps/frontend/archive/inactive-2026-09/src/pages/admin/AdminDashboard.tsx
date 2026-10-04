import React from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { Users, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import PageIntro from "../../components/PageIntro";
import { Card, CardContent } from "../../components/ui/Card";

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname.includes(path);

  const navItems = [
    {
      path: "/admin/reports",
      label: "Content Reports",
      icon: <AlertTriangle size={20} />,
      description: "Review and moderate reported content",
    },
    {
      path: "/admin/users",
      label: "User Management",
      icon: <Users size={20} />,
      description: "Manage user accounts and permissions",
    },
    {
      path: "/admin/system",
      label: "System Controls",
      icon: <SettingsIcon size={20} />,
      description: "System configuration and maintenance",
    },
  ];

  return (
    <PageIntro
      eyebrow="Admin Dashboard"
      title="FitVibe Administration"
      description="Manage users, moderate content, and control system settings"
    >
      <div className="grid grid--gap-15">
        {/* Admin Navigation */}
        <Card>
          <CardContent>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1rem",
              }}
            >
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => void navigate(item.path)}
                  style={{
                    padding: "1.5rem",
                    borderRadius: "12px",
                    border: `2px solid ${isActive(item.path) ? "var(--color-accent)" : "var(--color-border)"}`,
                    background: isActive(item.path)
                      ? "var(--surface-success-subtle)"
                      : "var(--surface-muted-subtle)",
                    color: "var(--color-text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive(item.path)) {
                      e.currentTarget.style.background = "var(--color-surface-muted)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive(item.path)) {
                      e.currentTarget.style.background = "var(--surface-muted-subtle)";
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        color: isActive(item.path)
                          ? "var(--color-accent)"
                          : "var(--color-text-secondary)",
                      }}
                    >
                      {item.icon}
                    </div>
                    <h3 className="text-11 font-weight-600 m-0">{item.label}</h3>
                  </div>
                  <p
                    style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", margin: 0 }}
                  >
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Render active admin page */}
        <Outlet />
      </div>
    </PageIntro>
  );
};

export default AdminDashboard;
