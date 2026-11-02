import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "./ui/Button";
import { useUiText } from "../i18n/ui";

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
  const t = useUiText();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [totpCode, setTotpCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(totpCode) || pending) {
      return;
    }
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
      onCancel={(event) => {
        // Escape closes the challenge only through the controlled parent.
        // Prevent native close events from effect cleanup from cancelling a
        // replacement challenge during React StrictMode remounting.
        event.preventDefault();
        if (!pending) {
          onCancel();
        }
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
        <h2 id="fresh-totp-title">{t("mfa.title")}</h2>
        <p id="fresh-totp-description">
          {t("mfa.description", { action: actionLabel })}
        </p>
        <label htmlFor="fresh-totp-input">{t("mfa.code")}</label>
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
          onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={pending}
        />
        {error ? (
          <p role="alert">{t("mfa.error")}</p>
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
