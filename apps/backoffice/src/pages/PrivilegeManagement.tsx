import React, { useEffect, useState } from "react";
import { InputControl, TextareaControl } from "@fitvibe/ui";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { superadminApi, type PrivilegedAdmin } from "../services/api";
import { useAuthStore } from "../store/auth.store";

const PrivilegeManagementPage: React.FC = () => {
  const currentUser = useAuthStore((state) => state.user);
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
    return <p>Superadmin privileges are required.</p>;
  }

  const activateSudo = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await superadminApi.sudo(password);
      setSudoUntil(result.expiresAt);
      setPassword("");
      setMessage("Sudo authorization active for 5 minutes.");
    } catch {
      setMessage("Sudo reauthentication failed.");
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
      setMessage("Role change committed. The target user's sessions were revoked.");
      await refresh();
    } catch {
      setMessage("Role change failed. Check sudo state, TOTP, prerequisites and justification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid--gap-lg">
      <Card>
        <CardHeader>
          <CardTitle>Superadmin privilege management</CardTitle>
          <CardDescription>
            Privileged role changes require a recent sudo password reauthentication and a fresh
            authenticator TOTP for every committed change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label>
            Sudo password
            <InputControl
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <Button onClick={() => void activateSudo()} isLoading={loading} disabled={!password}>
            Reauthenticate
          </Button>
          {sudoUntil ? <p>Sudo valid until {new Date(sudoUntil).toLocaleTimeString()}.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrators</CardTitle>
          <CardDescription>
            Promotion requires an active admin with verified authenticator TOTP. The final
            superadmin cannot be demoted.
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
                  {user.role} · {user.status} · TOTP {user.totpVerified ? "verified" : "missing"}
                </div>
              </div>
              <Button
                variant={user.role === "superadmin" ? "danger" : "secondary"}
                onClick={() => setSelected(user)}
                disabled={user.id === currentUser.id && user.role === "superadmin"}
              >
                {user.role === "admin" ? "Promote" : "Demote"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Confirm {selected.role === "admin" ? "promotion" : "demotion"}</CardTitle>
            <CardDescription>
              {selected.username ?? selected.email ?? selected.id}: {selected.role} →{" "}
              {selected.role === "admin" ? "superadmin" : "admin"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label>
              Justification
              <TextareaControl
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
              />
            </label>
            <label>
              Fresh authenticator code
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
                Commit role change
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Cancel
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
