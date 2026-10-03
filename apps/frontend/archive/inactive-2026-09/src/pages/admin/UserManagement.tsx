import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Search, Ban, UserX, Trash2, Shield } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  searchUsers,
  suspendUser,
  banUser,
  activateUser,
  deleteUser,
  type UserRecord,
} from "../../services/api";
import { logger } from "../../utils/logger";
import { useToast } from "../../contexts/ToastContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";

const UserManagement: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state
  const [showActionConfirm, setShowActionConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    userId: string;
    action: "suspend" | "ban" | "delete" | "activate";
  } | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "var(--color-accent)";
      case "suspended":
        return "var(--color-warning)";
      case "banned":
        return "var(--color-danger)";
      default:
        return "var(--color-text-secondary)";
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "var(--color-danger)";
      case "coach":
        return "var(--color-focus)";
      case "support":
        return "var(--color-warning)";
      default:
        return "var(--color-text-secondary)";
    }
  };

  const handleUserAction = (userId: string, action: "suspend" | "ban" | "delete" | "activate") => {
    setPendingAction({ userId, action });
    setShowActionConfirm(true);
  };

  const confirmUserAction = async () => {
    if (!pendingAction) {
      return;
    }

    const { userId, action } = pendingAction;
    setShowActionConfirm(false);

    try {
      switch (action) {
        case "suspend":
          await suspendUser(userId);
          break;
        case "ban":
          await banUser(userId);
          break;
        case "activate":
          await activateUser(userId);
          break;
        case "delete":
          await deleteUser(userId);
          break;
      }

      toast.success(
        `User ${action}${action === "suspend" ? "ed" : action === "activate" ? "d" : action === "delete" ? "d" : "ned"} successfully`,
      );

      // Refresh search results after action
      if (searchQuery.trim()) {
        const response = await searchUsers({ q: searchQuery.trim() });
        setUsers(response.data);
      } else {
        // If no search query, just remove the user from the list
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }

      setPendingAction(null);
    } catch (err) {
      logger.apiError(`Failed to ${action} user`, err, `/api/v1/admin/users/${userId}`, "PATCH");
      toast.error(`Failed to ${action} user. Please try again.`);
      setPendingAction(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await searchUsers({ q: searchQuery.trim() });
      setUsers(response.data);
    } catch (err) {
      logger.apiError("Failed to search users", err, "/api/v1/admin/users/search", "GET");
      setError("Failed to search users. Please try again.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid--gap-15">
      <Card>
        <CardHeader>
          <div className="flex flex--align-center flex--gap-075">
            <Users size={20} />
            <CardTitle>User Management</CardTitle>
          </div>
          <CardDescription>Search and manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "1rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-danger-subtle)",
                border: "1px solid var(--border-danger-subtle)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </div>
          )}
          {/* Search Bar */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={20}
                  style={{
                    position: "absolute",
                    left: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-secondary)",
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSearch();
                    }
                  }}
                  placeholder={t("admin.userManagement.searchPlaceholder")}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem 0.75rem 3rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    fontSize: "var(--type-body-size)",
                  }}
                />
              </div>
              <Button
                variant="primary"
                onClick={() => void handleSearch()}
                isLoading={loading}
                disabled={!searchQuery.trim()}
              >
                Search
              </Button>
            </div>
          </div>

          {/* User List */}
          {loading && users.length === 0 ? (
            <div className="empty-state">
              <p className="text-secondary">Searching...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <Users size={48} className="icon icon--muted" style={{ margin: "0 auto 1rem" }} />
              <h3 className="text-125 mb-05">No users found</h3>
              <p className="text-secondary">
                {searchQuery
                  ? "No users match your search criteria. Try a different query."
                  : "Use the search bar to find users by email, username, or ID."}
              </p>
              <p
                style={{ color: "var(--color-text-muted)", fontSize: "var(--type-body-size)", marginTop: "1rem" }}
              >
                API integration pending - admin user management endpoints
              </p>
            </div>
          ) : (
            <div className="grid grid--gap-md">
              {users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--surface-muted-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <h3 style={{ fontSize: "var(--type-card-title-size)", fontWeight: "var(--font-weight-semibold)", margin: 0 }}>
                          @{user.username}
                        </h3>
                        <span
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "var(--type-supporting-size)",
                            fontWeight: "var(--font-weight-semibold)",
                            background: `${getRoleBadgeColor(user.roleCode)}33`,
                            color: getRoleBadgeColor(user.roleCode),
                            textTransform: "uppercase",
                          }}
                        >
                          {user.roleCode}
                        </span>
                        <span
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "var(--type-supporting-size)",
                            fontWeight: "var(--font-weight-semibold)",
                            background: `${getStatusColor(user.status)}33`,
                            color: getStatusColor(user.status),
                            textTransform: "capitalize",
                          }}
                        >
                          {user.status}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: "var(--type-body-size)",
                          color: "var(--color-text-secondary)",
                          marginBottom: "0.75rem",
                        }}
                      >
                        {user.email}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: "1rem",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div>
                          <div className="text-08 text-muted">Sessions</div>
                          <div className="text-11 font-weight-600">{user.sessionCount}</div>
                        </div>
                        <div>
                          <div className="text-08 text-muted">Reports</div>
                          <div
                            style={{
                              fontSize: "var(--type-card-title-size)",
                              fontWeight: "var(--font-weight-semibold)",
                              color: user.reportCount > 0 ? "var(--color-warning)" : undefined,
                            }}
                          >
                            {user.reportCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-08 text-muted">Last Login</div>
                          <div style={{ fontSize: "var(--type-body-size)" }}>
                            {user.lastLoginAt
                              ? new Date(user.lastLoginAt).toLocaleDateString()
                              : "Never"}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        marginLeft: "1rem",
                      }}
                    >
                      {user.status === "active" && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleUserAction(user.id, "suspend")}
                            leftIcon={<UserX size={16} />}
                            disabled={loading}
                          >
                            Suspend
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleUserAction(user.id, "ban")}
                            leftIcon={<Ban size={16} />}
                            disabled={loading}
                          >
                            Ban
                          </Button>
                        </>
                      )}
                      {user.status !== "active" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void handleUserAction(user.id, "activate")}
                          leftIcon={<Shield size={16} />}
                          disabled={loading}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleUserAction(user.id, "delete")}
                        leftIcon={<Trash2 size={16} />}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showActionConfirm}
        title={
          pendingAction?.action === "delete"
            ? "Delete User"
            : pendingAction?.action === "ban"
              ? "Ban User"
              : pendingAction?.action === "suspend"
                ? "Suspend User"
                : "Activate User"
        }
        message={
          pendingAction?.action === "delete"
            ? "Are you sure you want to delete this user and all their data? This action cannot be undone."
            : pendingAction?.action === "ban"
              ? "Are you sure you want to ban this user permanently? This action may be irreversible."
              : pendingAction?.action === "suspend"
                ? "Are you sure you want to suspend this user? They will not be able to access their account."
                : "Are you sure you want to activate this user? They will regain full access to their account."
        }
        confirmLabel={
          pendingAction?.action === "delete"
            ? "Yes, Delete User"
            : pendingAction?.action === "ban"
              ? "Yes, Ban User"
              : pendingAction?.action === "suspend"
                ? "Yes, Suspend User"
                : "Yes, Activate User"
        }
        cancelLabel="Cancel"
        variant={
          pendingAction?.action === "delete" || pendingAction?.action === "ban"
            ? "danger"
            : "warning"
        }
        onConfirm={() => void confirmUserAction()}
        onCancel={() => {
          setShowActionConfirm(false);
          setPendingAction(null);
        }}
      />
    </div>
  );
};

export default UserManagement;
