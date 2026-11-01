import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "./ui/Button";

type Props = {
  actionLabel: string;
  onConfirm: (totpCode: string) => Promise<void>;
  onCancel: () => void;
};

/**
 * Issue 557: One-time MFA challenge for identity-impacting administrator actions.
 * Native modal focus management avoids password or TOTP codes in URLs/storage.
 */
export function FreshTotpDialog({ actionLabel, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [totpCode, setTotpCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\\d{6}$/.test(totpCode) || pending) return;
    setPending(true);
    setError(false);
    try {
      await onConfirm(totpCode);
    } catch {
      setError(true);
      setTotpCode("");
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      aria-labelledby="fresh-totp-title"
      aria-describedby="fresh-totp-description"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        maxWidth: "min(90vw, 28rem)",
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="grid grid--gap-md">
        <h2 id="fresh-totp-title">Confirm administrator action</h2>
        <p id="fresh-totp-description">
          {actionLabel} requires a new code from your authenticator. A code can only be used once.
        </p>
        <label htmlFor="fresh-totp-input">Authenticator code</label>
        <input
          id="fresh-totp-input"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoFocus
          required
          value={totpCode}
          onChange={(event) => setTotpCode(event.target.value.replace(/\\D/g, "").slice(0, 6))}
          disabled={pending}
        />
        {error ? (
          <p role="alert">The action could not be authorized. Check the code and try again.</p>
        ) : null}
        <div className="flex flex--gap-sm">
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || totpCode.length !== 6} isLoading={pending}>
            Confirm action
          </Button>
        </div>
      </form>
    </dialog>
  );
}
