import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import {
  Users,
  Settings as SettingsIcon,
  AlertTriangle,
  Languages,
  Mail,
  ListChecks,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

const AdminDashboardV2: React.FC = () => {
  const location = useLocation();
  const role = useAuthStore((state) => state.user?.role);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const items = [
    {
      path: "/admin/reports",
      label: "Content Reports",
      icon: <AlertTriangle size={20} />,
      description: "Moderate reported content and policy violations.",
    },
    {
      path: "/audit-logs",
      label: "Audit Logs",
      icon: <ListChecks size={20} />,
      description: "Review system actions, incidents, and severity trends.",
    },
    {
      path: "/messages",
      label: "Message Board",
      icon: <Mail size={20} />,
      description: "Track incoming user messages and follow-ups.",
    },
    {
      path: "/users",
      label: "User Management",
      icon: <Users size={20} />,
      description: "Audit accounts, roles, and account health status.",
    },
    {
      path: "/settings",
      label: "System Controls",
      icon: <SettingsIcon size={20} />,
      description: "Adjust platform configuration and runtime controls.",
    },
    {
      path: "/translations",
      label: "Translation",
      icon: <Languages size={20} />,
      description: "Maintain language keys and content consistency.",
    },
    {
      path: "/legal-publications",
      label: "Legal Publications",
      icon: <FileCheck2 size={20} />,
      description: "Publish immutable legal document versions from reviewed translations.",
    },
  ];

  if (role === "superadmin") {
    items.splice(5, 0, {
      path: "/superadmin/privileges",
      label: "Privilege Management",
      icon: <ShieldCheck size={20} />,
      description: "Manage superadmin privileges with sudo and fresh TOTP approval.",
    });
  }

  return (
    <div className="grid grid--gap-md">
      <div>
        <h2 style={{ marginBottom: "0.35rem" }}>Admin Dashboard</h2>
      </div>

      <div
        className="grid grid--gap-sm"
        style={{
          maxHeight: "calc(100vh - 260px)",
          overflowY: "auto",
          paddingRight: "0.25rem",
        }}
      >
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const isExpanded = hoveredPath === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onMouseEnter={() => setHoveredPath(item.path)}
              onMouseLeave={() => setHoveredPath(null)}
              style={{
                padding: isExpanded ? "1rem" : "0.8rem",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-border)"}`,
                background: isActive
                  ? "var(--surface-success-subtle)"
                  : "var(--color-surface-glass)",
                color: "inherit",
                display: "grid",
                gap: "0.5rem",
                transition: "all 160ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span
                  style={{
                    color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                  }}
                >
                  {item.icon}
                </span>
                <span className="text-09 font-weight-600">{item.label}</span>
              </div>
              <span
                className="text-08 text-secondary"
                style={{
                  maxHeight: isExpanded ? "120px" : "0",
                  opacity: isExpanded ? "var(--opacity-full)" : "var(--opacity-disabled)",
                  overflow: "hidden",
                  transition: "max-height 160ms ease, opacity 160ms ease",
                }}
              >
                {item.description}
              </span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboardV2;
