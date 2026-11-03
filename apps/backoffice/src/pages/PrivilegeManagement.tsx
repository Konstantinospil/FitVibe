import React, { useEffect, useState } from "react";
import { useUiText } from "../i18n/ui";
import { InputControl, TextareaControl } from "@fitvibe/ui";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { superadminApi, type PrivilegedAdmin } from "../services/api";
import { useAuthStore } from "../store/auth.store";

const PrivilegeManagementPage: React.FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const t = useUiText();
  const [users, setUsers] = useState<PrivilegedAdmin[]>([]);
  const [password, setPassword] = useState("");
  const [sudoUntil, setSudoUntil] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [selected, setSelected] = useState<PrivilegedAdmin | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    setUsers(await superadminApi.listAdmins());
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (currentUser?.role !== "superadmin") {
    return <p>{t("privileges.required")}</p>;
  }

  const activateSudo = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await superadminApi.sudo(password);
      setSudoUntil(result.expiresAt);
      setPassword("");
      setMessage(t("privileges.sudoActive"));
    } catch {
      setMessage(t("privileges.sudoFailed"));
    } finally {
      setLoading(false);
    }
  };

  const commitRoleChange = async () => {
    if (!selected) {
      return;
    }
    const nextRole = selected.role === "admin" ? "superadmin" : "admin";
    setLoading(true);
    setMessage(null);
    try {
      await superadminApi.changeRole(selected.id, nextRole, reason, totpCode);
      setSelected(null);
      setReason("");
      setTotpCode("");
      setMessage(t("privileges.changed"));
      await refresh();
    } catch {
      setMessage(t("privileges.changeFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid--gap-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t("privileges.title")}</CardTitle>
          <CardDescription>
            {t("privileges.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label>
            {t("privileges.sudoPassword")}
            <InputControl
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <Button onClick={() => void activateSudo()} isLoading={loading} disabled={!password}>
            {t("privileges.reauthenticate")}
          </Button>
          {sudoUntil ? <p>{t("privileges.sudoUntil", { time: new Date(sudoUntil).toLocaleTimeString() })}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("privileges.administrators")}</CardTitle>
          <CardDescription>
            {t("privileges.adminDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-md)",
                borderBottom: "1px solid var(--color-border)",
                paddingBottom: "var(--space-md)",
              }}
            >
              <div>
                <strong>{user.username ?? user.email ?? user.id}</strong>
                <div>
                  {t(`privileges.role.${user.role}`)} · {user.status} · {t("privileges.totp")} {user.totpVerified ? t("privileges.verified") : t("privileges.missing")}
                </div>
              </div>
              <Button
                variant={user.role === "superadmin" ? "danger" : "secondary"}
                onClick={() => setSelected(user)}
                disabled={user.id === currentUser.id && user.role === "superadmin"}
              >
                {user.role === "admin" ? t("privileges.promote") : t("privileges.demote")}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("privileges.confirm", { action: selected.role === "admin" ? t("privileges.promotion") : t("privileges.demotion") })}</CardTitle>
            <CardDescription>
              {t("privileges.roleChange", { user: selected.username ?? selected.email ?? selected.id, from: t(`privileges.role.${selected.role}`), to: selected.role === "admin" ? t("privileges.role.superadmin") : t("privileges.role.admin") })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label>
              {t("privileges.justification")}
              <TextareaControl
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
              />
            </label>
            <label>
              {t("privileges.freshCode")}
              <InputControl
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <Button
                variant="primary"
                onClick={() => void commitRoleChange()}
                isLoading={loading}
                disabled={!reason.trim() || totpCode.length !== 6}
              >
                {t("privileges.commit")}
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
    </div>
  );
};

export default PrivilegeManagementPage;
