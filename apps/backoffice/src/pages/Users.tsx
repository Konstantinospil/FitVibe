import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, type User } from "../services/api";
import { useAuthStore } from "../store/auth.store";
import { useThemeColors } from "../hooks/useThemeColors";
import { Button } from "../components/ui/Button";
import { FreshTotpDialog } from "../components/FreshTotpDialog";
import { InputControl, SelectControl, TextareaControl } from "@fitvibe/ui";
import { useUiText } from "../i18n/ui";

type UserFilter = "all" | "registered" | "unverified" | "blacklisted";

const UsersPage: React.FC = () => {
  const t = useUiText();
  const colors = useThemeColors();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [pendingUserAction, setPendingUserAction] = useState<{
    user: User;
    action: "blacklist" | "unblacklist" | "delete";
  } | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const availableRoles = ["admin", "coach", "athlete", "support"];
  const roleTranslationKeys: Record<string, string> = {
    admin: "users.roleAdmin",
    superadmin: "users.roleSuperadmin",
    coach: "users.roleCoach",
    athlete: "users.roleAthlete",
    support: "users.roleSupport",
  };
  const formatRole = (role: string | null | undefined): string =>
    role ? (roleTranslationKeys[role] ? t(roleTranslationKeys[role]) : role) : t("users.notAvailable");

  const actionTranslationKeys = {
    blacklist: "users.blacklist",
    unblacklist: "users.unblacklist",
    delete: "users.delete",
  } as const;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["users", search, filter],
    queryFn: () => usersApi.search(search.trim(), 50, filter === "blacklisted" ? true : undefined),
    enabled: isAuthenticated && !!user, // Only run query when authenticated and user is loaded
  });

  const queryClient = useQueryClient();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The backend's raw error message can reveal internal details and may be English.
  // Display a localized generic failure; server error codes can be mapped separately.
  const extractErrorMessage = (_error: unknown): string => t("users.unknownError");

  const actionMutation = useMutation({
    mutationFn: ({
      userId,
      action,
      totpCode,
    }: {
      userId: string;
      action: "blacklist" | "unblacklist" | "delete";
      totpCode: string;
    }) => usersApi.action(userId, action, actionReason || undefined, totpCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(null);
      setActionReason("");
      setPendingUserAction(null);
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
      alert(t("users.verifySent"));
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
      alert(t("users.resetSent"));
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
      alert(t("users.avatarDeleted"));
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
      alert(t("users.displayDeleted"));
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
    setPendingUserAction({ user, action });
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
    if (confirm(t("users.verifyConfirm", { user: label }))) {
      sendVerificationEmailMutation.mutate(user.id);
    }
  };

  const handleSendPasswordReset = (user: User) => {
    const label = user.display_name || user.username;
    if (confirm(t("users.resetConfirm", { user: label }))) {
      sendPasswordResetMutation.mutate(user.id);
    }
  };

  const handleDeleteAvatar = (user: User) => {
    const label = user.display_name || user.username;
    const reason = prompt(t("users.avatarConfirm", { user: label }));
    if (reason !== null) {
      deleteAvatarMutation.mutate({ userId: user.id, reason: reason || undefined });
    }
  };

  const handleDeleteDisplayName = (user: User) => {
    const label = user.display_name || user.username;
    const reason = prompt(t("users.displayConfirm", { user: label }));
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
        return t("users.statusUnverified");
      case "active":
        return t("users.statusActive");
      case "banned":
        return t("users.statusBanned");
      case "suspended":
        return t("users.statusSuspended");
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
      {pendingUserAction ? (
        <FreshTotpDialog
          actionLabel={t("users.actionChallenge", {
             action: t(actionTranslationKeys[pendingUserAction.action]),
             user: pendingUserAction.user.display_name || pendingUserAction.user.username,
           })}
          onCancel={() => {
            setPendingUserAction(null);
            setSelectedUser(null);
          }}
          onConfirm={async (totpCode) => {
            await actionMutation.mutateAsync({
              userId: pendingUserAction.user.id,
              action: pendingUserAction.action,
              totpCode,
            });
          }}
        />
      ) : null}
      <h1
        style={{
          color: colors.text,
          marginBottom: "2rem",
          fontSize: "var(--type-page-title-size)",
        }}
      >
        {t("users.title")}
      </h1>

      <div style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {(
            [
              ["all", t("users.filterAll")],
              ["registered", t("users.filterRegistered")],
              ["unverified", t("users.filterUnverified")],
              ["blacklisted", t("users.filterBlacklisted")],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              style={{
                background: filter === value ? colors.surfaceMuted : "transparent",
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Search Input */}
        <InputControl
          type="search"
          aria-label={t("users.search")}
          placeholder={t("users.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: "500px" }}
        />
      </div>

      {errorMessage && (
        <div
          style={{
            background: "var(--color-danger-bg)",
            color: "var(--color-danger-text)",
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{errorMessage}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("users.dismissError")}
            onClick={() => setErrorMessage(null)}
            style={{ color: colors.text, padding: "0 0.5rem", boxShadow: "none" }}
          >
            ×
          </Button>
        </div>
      )}

      {isLoading ? (
        <div style={{ color: colors.text }}>{t("common.loading")}</div>
      ) : error ? (
        <div style={{ color: "var(--color-danger-text)", padding: "2rem" }}>
          {t("users.loadError")}
        </div>
      ) : (
        <>
          <div
            style={{
              background: colors.surface,
              borderRadius: "var(--radius-sm)",
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
                  >{t("users.avatar")}</th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >{t("users.username")}</th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >{t("users.email")}</th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >{t("users.status")}</th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >{t("users.role")}</th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >{t("users.created")}</th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >{t("users.deactivated")}</th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >{t("users.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const API_URL = import.meta.env.VITE_API_URL || "";
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
                              borderRadius: "var(--radius-full)",
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
                                borderRadius: var(--radius-full);
                                display: flex;
                                alignItems: center;
                                justifyContent: center;
                                background: ${colors.border};
                                color: ${colors.text};
                                fontSize: var(--type-supporting-size);
                                fontWeight: var(--font-weight-semibold);
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
                              borderRadius: "var(--radius-full)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: colors.border,
                              color: colors.text,
                              fontSize: "var(--type-supporting-size)",
                              fontWeight: "var(--font-weight-semibold)",
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
                            <span
                              style={{
                                color: colors.textSecondary,
                                fontSize: "var(--type-supporting-size)",
                              }}
                            >
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
                        {formatRole(user.role_code)}
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
                                return user.created_at || t("users.notAvailable");
                              }
                            })()
                          : t("users.notAvailable")}
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
                                return user.deactivated_at || t("users.notAvailable");
                              }
                            })()
                          : "—"}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          {!user.deactivated_at ? (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleAction(user, "blacklist")}
                            >{t("users.blacklist")}</Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleAction(user, "unblacklist")}
                            >{t("users.unblacklist")}</Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleChangeRole(user)}
                            style={{
                              background: colors.surfaceMuted,
                              color: colors.text,
                              border: `1px solid ${colors.border}`,
                            }}
                          >{t("users.changeRole")}</Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSendVerificationEmail(user)}
                            disabled={sendVerificationEmailMutation.isPending}
                            isLoading={sendVerificationEmailMutation.isPending}
                            style={{
                              background: "var(--color-info-text)",
                              color: "var(--color-secondary-on)",
                              border: "1px solid var(--color-info-text)",
                            }}
                          >{t("users.verifyEmail")}</Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSendPasswordReset(user)}
                            disabled={sendPasswordResetMutation.isPending}
                            isLoading={sendPasswordResetMutation.isPending}
                            style={{
                              background: "var(--color-warning-text)",
                              color: "var(--color-secondary-on)",
                              border: "1px solid var(--color-warning-text)",
                            }}
                          >{t("users.resetPassword")}</Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleDeleteAvatar(user)}
                            disabled={deleteAvatarMutation.isPending}
                            isLoading={deleteAvatarMutation.isPending}
                          >{t("users.deleteAvatar")}</Button>
                          {showUsername && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleDeleteDisplayName(user)}
                              disabled={deleteDisplayNameMutation.isPending}
                              isLoading={deleteDisplayNameMutation.isPending}
                            >{t("users.deleteDisplay")}</Button>
                          )}
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleDelete(user)}
                          >{t("users.delete")}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div style={{ color: colors.text, textAlign: "center", padding: "2rem" }}>{t("users.none")}</div>
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
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${colors.border}`,
              maxWidth: "500px",
              width: "100%",
              padding: "2rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                color: colors.text,
                marginBottom: "1.5rem",
                fontSize: "var(--type-section-title-size)",
              }}
            >
              {t("users.changeRoleFor", { user: selectedUser.display_name || selectedUser.username })}
            </h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: colors.text,
                  fontSize: "var(--type-supporting-size)",
                }}
              >{t("users.selectRole")}</label>
              <SelectControl
                aria-label={t("users.selectRole")}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </SelectControl>
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: colors.text,
                  fontSize: "var(--type-supporting-size)",
                }}
              >{t("users.reasonOptional")}</label>
              <TextareaControl
                aria-label={t("users.reasonLabel")}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={t("users.reasonPlaceholder")}
                rows={3}
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                  setSelectedRole("");
                  setActionReason("");
                }}
                style={{ color: colors.text, border: `1px solid ${colors.border}` }}
              >{t("common.cancel")}</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleConfirmRoleChange}
                disabled={changeRoleMutation.isPending || !selectedRole}
                isLoading={changeRoleMutation.isPending}
                style={{ background: colors.border, color: colors.text }}
              >{t("users.changeRole")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
