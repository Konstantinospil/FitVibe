import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, type User } from "../services/api";
import { useAuthStore } from "../store/auth.store";
import { useThemeColors } from "../hooks/useThemeColors";

type UserFilter = "all" | "registered" | "unverified" | "blacklisted";

const UsersPage: React.FC = () => {
  const colors = useThemeColors();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const availableRoles = ["admin", "coach", "athlete", "support"];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["users", search, filter],
    queryFn: () => usersApi.search(search || "a", 100, filter === "blacklisted" ? true : undefined), // Search for "a" if empty to get all users
    enabled: isAuthenticated && !!user, // Only run query when authenticated and user is loaded
  });

  const queryClient = useQueryClient();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const extractErrorMessage = (error: unknown): string => {
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response?: { data?: { error?: { message?: string }; message?: string } };
      };
      return (
        axiosError.response?.data?.error?.message ||
        axiosError.response?.data?.message ||
        (error instanceof Error ? error.message : "Unknown error")
      );
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "Unknown error";
  };

  const actionMutation = useMutation({
    mutationFn: ({
      userId,
      action,
    }: {
      userId: string;
      action: "blacklist" | "unblacklist" | "delete";
    }) => usersApi.action(userId, action, actionReason || undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(null);
      setActionReason("");
      setErrorMessage(null);
      void refetch();
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      // Clear error after 5 seconds
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      usersApi.changeRole(userId, role, actionReason || undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(null);
      setActionReason("");
      setShowRoleModal(false);
      setSelectedRole("");
      setErrorMessage(null);
      void refetch();
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      // Clear error after 5 seconds
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const sendVerificationEmailMutation = useMutation({
    mutationFn: (userId: string) => usersApi.sendVerificationEmail(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setErrorMessage(null);
      alert("Verification email sent successfully");
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const sendPasswordResetMutation = useMutation({
    mutationFn: (userId: string) => usersApi.sendPasswordReset(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setErrorMessage(null);
      alert("Password reset email sent successfully");
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      usersApi.deleteAvatar(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(null);
      setActionReason("");
      setErrorMessage(null);
      alert("Avatar deleted successfully");
      void refetch();
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const deleteDisplayNameMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      usersApi.deleteDisplayName(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(null);
      setActionReason("");
      setErrorMessage(null);
      alert("Display name deleted successfully");
      void refetch();
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleAction = (user: User, action: "blacklist" | "unblacklist" | "delete") => {
    setSelectedUser(user);
    const actionText =
      action === "delete" ? "delete" : action === "blacklist" ? "blacklist" : "unblacklist";
    const label = user.display_name || user.username;
    if (confirm(`Are you sure you want to ${actionText} user ${label}?`)) {
      actionMutation.mutate({ userId: user.id, action });
    }
  };

  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role_code || "");
    setShowRoleModal(true);
  };

  const handleConfirmRoleChange = () => {
    if (selectedUser && selectedRole) {
      changeRoleMutation.mutate({ userId: selectedUser.id, role: selectedRole });
    }
  };

  const handleDelete = (user: User) => {
    handleAction(user, "delete");
  };

  const handleSendVerificationEmail = (user: User) => {
    const label = user.display_name || user.username;
    if (confirm(`Send verification email to ${label}?`)) {
      sendVerificationEmailMutation.mutate(user.id);
    }
  };

  const handleSendPasswordReset = (user: User) => {
    const label = user.display_name || user.username;
    if (confirm(`Send password reset email to ${label}?`)) {
      sendPasswordResetMutation.mutate(user.id);
    }
  };

  const handleDeleteAvatar = (user: User) => {
    const label = user.display_name || user.username;
    const reason = prompt(`Delete avatar for ${label}? Enter reason (optional):`);
    if (reason !== null) {
      deleteAvatarMutation.mutate({ userId: user.id, reason: reason || undefined });
    }
  };

  const handleDeleteDisplayName = (user: User) => {
    const label = user.display_name || user.username;
    const reason = prompt(`Delete display name for ${label}? Enter reason (optional):`);
    if (reason !== null) {
      deleteDisplayNameMutation.mutate({ userId: user.id, reason: reason || undefined });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "var(--color-success-text)";
      case "banned":
        return "var(--color-danger-text)";
      case "suspended":
        return "var(--color-warning-text)";
      case "pending_verification":
        return "var(--color-info-text)";
      default:
        return colors.text;
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "pending_verification":
        return "Unverified";
      case "active":
        return "Active";
      case "banned":
        return "Banned";
      case "suspended":
        return "Suspended";
      default:
        return status;
    }
  };

  // Filter users based on selected filter
  const filteredUsers =
    data?.users.filter((user) => {
      if (filter === "registered") {
        return user.status === "active" && !user.deactivated_at;
      }
      if (filter === "unverified") {
        return user.status === "pending_verification";
      }
      if (filter === "blacklisted") {
        return !!user.deactivated_at;
      }
      return true; // "all" - show all users
    }) || [];

  return (
    <div>
      <h1 style={{ color: colors.text, marginBottom: "2rem", fontSize: "2rem" }}>
        User Management
      </h1>

      <div style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "0.5rem 1rem",
              background: filter === "all" ? colors.surfaceMuted : "transparent",
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            All Users
          </button>
          <button
            onClick={() => setFilter("registered")}
            style={{
              padding: "0.5rem 1rem",
              background: filter === "registered" ? colors.surfaceMuted : "transparent",
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Registered (Active)
          </button>
          <button
            onClick={() => setFilter("unverified")}
            style={{
              padding: "0.5rem 1rem",
              background: filter === "unverified" ? colors.surfaceMuted : "transparent",
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Unverified
          </button>
          <button
            onClick={() => setFilter("blacklisted")}
            style={{
              padding: "0.5rem 1rem",
              background: filter === "blacklisted" ? colors.surfaceMuted : "transparent",
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Blacklisted
          </button>
        </div>

        {/* Search Input */}
        <input
          type="text"
          placeholder="Search users by username or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "500px",
            padding: "0.75rem",
            background: "var(--color-input-bg)",
            border: `1px solid ${colors.border}`,
            borderRadius: "4px",
            color: colors.text,
            fontSize: "1rem",
          }}
        />
      </div>

      {errorMessage && (
        <div
          style={{
            background: "var(--color-danger-bg)",
            color: "var(--color-danger-text)",
            padding: "1rem",
            borderRadius: "4px",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: colors.text,
              cursor: "pointer",
              fontSize: "1.25rem",
              padding: "0 0.5rem",
            }}
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ color: colors.text }}>Loading...</div>
      ) : error ? (
        <div style={{ color: "var(--color-danger-text)", padding: "2rem" }}>
          Error loading users: {error instanceof Error ? error.message : String(error)}
        </div>
      ) : (
        <>
          <div
            style={{
              background: colors.surface,
              borderRadius: "8px",
              overflow: "hidden",
              border: `1px solid ${colors.border}`,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: colors.surfaceMuted }}>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                      width: "60px",
                    }}
                  >
                    Avatar
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Username
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Role
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Created
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Deactivated
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const API_URL =
                    import.meta.env.VITE_API_URL ||
                    (import.meta.env.DEV ? "" : "http://localhost:4000");
                  let avatarUrl: string | null = null;
                  if (user.avatar_url) {
                    if (user.avatar_url.startsWith("http")) {
                      avatarUrl = user.avatar_url;
                    } else if (user.avatar_url.startsWith("/users/avatar/")) {
                      // Convert /users/avatar/{userId} to /api/v1/users/avatar/{userId}
                      const userId = user.avatar_url.replace("/users/avatar/", "");
                      avatarUrl = `${API_URL}/api/v1/users/avatar/${userId}`;
                    } else {
                      avatarUrl = `${API_URL}${user.avatar_url}`;
                    }
                  }
                  const nameForInitials = user.display_name || user.username;
                  const initials = nameForInitials
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);
                  const displayName = user.display_name || user.username;
                  const showUsername = displayName !== user.username;

                  return (
                    <tr key={user.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: "1rem" }}>
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={user.username}
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector(".avatar-initials")) {
                                const initialsDiv = document.createElement("div");
                                initialsDiv.className = "avatar-initials";
                                initialsDiv.textContent = initials;
                                initialsDiv.style.cssText = `
                                width: 40px;
                                height: 40px;
                                borderRadius: 50%;
                                display: flex;
                                alignItems: center;
                                justifyContent: center;
                                background: ${colors.border};
                                color: ${colors.text};
                                fontSize: 0.875rem;
                                fontWeight: 600;
                              `;
                                parent.appendChild(initialsDiv);
                              }
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: colors.border,
                              color: colors.text,
                              fontSize: "0.875rem",
                              fontWeight: "600",
                            }}
                          >
                            {initials}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "1rem", color: colors.text }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{displayName}</span>
                          {showUsername && (
                            <span style={{ color: colors.textSecondary, fontSize: "0.8rem" }}>
                              @{user.username}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "1rem", color: colors.text }}>{user.email}</td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ color: getStatusColor(user.status) }}>
                          {formatStatus(user.status)}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", color: colors.text }}>
                        {user.role_code || "N/A"}
                      </td>
                      <td style={{ padding: "1rem", color: colors.text }}>
                        {user.created_at
                          ? (() => {
                              try {
                                const date = new Date(user.created_at);
                                if (isNaN(date.getTime())) {
                                  return user.created_at; // Fallback to raw value if invalid
                                }
                                return date.toLocaleDateString();
                              } catch {
                                return user.created_at || "N/A";
                              }
                            })()
                          : "N/A"}
                      </td>
                      <td style={{ padding: "1rem", color: colors.text }}>
                        {user.deactivated_at
                          ? (() => {
                              try {
                                const date = new Date(user.deactivated_at);
                                if (isNaN(date.getTime())) {
                                  return user.deactivated_at; // Fallback to raw value if invalid
                                }
                                return date.toLocaleDateString();
                              } catch {
                                return user.deactivated_at || "N/A";
                              }
                            })()
                          : "—"}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          {!user.deactivated_at ? (
                            <button
                              onClick={() => handleAction(user, "blacklist")}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "var(--color-primary)",
                                color: "var(--color-primary-on)",
                                border: "1px solid var(--color-primary)",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.875rem",
                                fontWeight: "500",
                              }}
                            >
                              Blacklist
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(user, "unblacklist")}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "var(--color-secondary)",
                                color: "var(--color-secondary-on)",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.875rem",
                                fontWeight: "500",
                              }}
                            >
                              Unblacklist
                            </button>
                          )}
                          <button
                            onClick={() => handleChangeRole(user)}
                            style={{
                              padding: "0.5rem 1rem",
                              background: colors.surfaceMuted,
                              color: colors.text,
                              border: `1px solid ${colors.border}`,
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                            }}
                          >
                            Change Role
                          </button>
                          <button
                            onClick={() => handleSendVerificationEmail(user)}
                            disabled={sendVerificationEmailMutation.isPending}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "var(--color-info-text)",
                              color: "var(--color-secondary-on)",
                              border: "1px solid var(--color-info-text)",
                              borderRadius: "4px",
                              cursor: sendVerificationEmailMutation.isPending
                                ? "not-allowed"
                                : "pointer",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              opacity: sendVerificationEmailMutation.isPending ? 0.6 : 1,
                            }}
                          >
                            {sendVerificationEmailMutation.isPending
                              ? "Sending..."
                              : "Send Verification Email"}
                          </button>
                          <button
                            onClick={() => handleSendPasswordReset(user)}
                            disabled={sendPasswordResetMutation.isPending}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "var(--color-warning-text)",
                              color: "var(--color-secondary-on)",
                              border: "1px solid var(--color-warning-text)",
                              borderRadius: "4px",
                              cursor: sendPasswordResetMutation.isPending
                                ? "not-allowed"
                                : "pointer",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              opacity: sendPasswordResetMutation.isPending ? 0.6 : 1,
                            }}
                          >
                            {sendPasswordResetMutation.isPending ? "Sending..." : "Reset Password"}
                          </button>
                          <button
                            onClick={() => handleDeleteAvatar(user)}
                            disabled={deleteAvatarMutation.isPending}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "var(--color-primary)",
                              color: "var(--color-primary-on)",
                              border: "1px solid var(--color-primary)",
                              borderRadius: "4px",
                              cursor: deleteAvatarMutation.isPending ? "not-allowed" : "pointer",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              opacity: deleteAvatarMutation.isPending ? 0.6 : 1,
                            }}
                          >
                            {deleteAvatarMutation.isPending ? "Deleting..." : "Delete Avatar"}
                          </button>
                          {showUsername && (
                            <button
                              onClick={() => handleDeleteDisplayName(user)}
                              disabled={deleteDisplayNameMutation.isPending}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "var(--color-primary)",
                                color: "var(--color-primary-on)",
                                border: "1px solid var(--color-primary)",
                                borderRadius: "4px",
                                cursor: deleteDisplayNameMutation.isPending
                                  ? "not-allowed"
                                  : "pointer",
                                fontSize: "0.875rem",
                                fontWeight: "500",
                                opacity: deleteDisplayNameMutation.isPending ? 0.6 : 1,
                              }}
                            >
                              {deleteDisplayNameMutation.isPending
                                ? "Deleting..."
                                : "Delete Display Name"}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(user)}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "var(--color-primary)",
                              color: "var(--color-primary-on)",
                              border: "1px solid var(--color-primary)",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div style={{ color: colors.text, textAlign: "center", padding: "2rem" }}>
              No users found
            </div>
          )}
        </>
      )}

      {/* Change Role Modal */}
      {showRoleModal && selectedUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--modal-backdrop)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={() => {
            setShowRoleModal(false);
            setSelectedUser(null);
            setSelectedRole("");
          }}
        >
          <div
            style={{
              background: colors.surface,
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              maxWidth: "500px",
              width: "100%",
              padding: "2rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: colors.text, marginBottom: "1.5rem", fontSize: "1.5rem" }}>
              Change Role for {selectedUser.display_name || selectedUser.username}
            </h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: colors.text,
                  fontSize: "0.875rem",
                }}
              >
                Select Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "var(--color-input-bg)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "4px",
                  color: colors.text,
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: colors.text,
                  fontSize: "0.875rem",
                }}
              >
                Reason (optional)
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter reason for role change..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "var(--color-input-bg)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "4px",
                  color: colors.text,
                  fontSize: "1rem",
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                  setSelectedRole("");
                  setActionReason("");
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "transparent",
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRoleChange}
                disabled={changeRoleMutation.isPending || !selectedRole}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: colors.border,
                  color: colors.text,
                  border: "none",
                  borderRadius: "4px",
                  cursor: changeRoleMutation.isPending || !selectedRole ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  opacity: changeRoleMutation.isPending || !selectedRole ? 0.6 : 1,
                }}
              >
                {changeRoleMutation.isPending ? "Changing..." : "Change Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
