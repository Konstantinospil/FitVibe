import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { Shield, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import PageIntro from "./PageIntro";

/**
 * Admin Route Guard
 *
 * Protects admin routes by checking if the authenticated user has admin role.
 * Parses the JWT access token to verify the role claim.
 *
 * Note: This is a UI-level guard for better UX. The backend enforces actual authorization.
 */
const AdminRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  // Check if user has admin role
  const hasAdminRole = user?.role === "admin";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAdminRole) {
    return (
      <PageIntro
        eyebrow="Access Denied"
        title="Administrator Access Required"
        description="You do not have permission to access this area"
      >
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <AlertTriangle size={20} style={{ color: "var(--color-danger)" }} />
              <CardTitle style={{ color: "var(--color-danger)" }}>Unauthorized Access</CardTitle>
            </div>
            <CardDescription>This area is restricted to administrators only</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Shield
                size={64}
                style={{ margin: "0 auto 1rem", opacity: "var(--opacity-disabled)", color: "var(--color-danger)" }}
              />
              <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
                You need administrator privileges to access the admin dashboard.
              </p>
              <p style={{ fontSize: "var(--type-body-size)", color: "var(--color-text-muted)" }}>
                If you believe you should have access, please contact your system administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageIntro>
    );
  }

  return <Outlet />;
};

export default AdminRoute;
