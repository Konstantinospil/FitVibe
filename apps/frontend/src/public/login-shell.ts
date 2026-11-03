import english from "../i18n/locales/en/auth.json";
import german from "../i18n/locales/de/auth.json";
import french from "../i18n/locales/fr/auth.json";
import spanish from "../i18n/locales/es/auth.json";
import greek from "../i18n/locales/el/auth.json";

const authCatalog = { en: english, de: german, fr: french, es: spanish, el: greek };

function localizedAuth() {
  let preference: string | null = null;
  try {
    preference = window.localStorage.getItem("fitvibe:language");
  } catch {
    // Storage may be unavailable in restricted browsing environments.
  }
  const code = (preference || navigator.language || "en").slice(0, 2).toLowerCase();
  return authCatalog[code as keyof typeof authCatalog] ?? authCatalog.en;
}

type LoginResponse =
  | {
      requires2FA: false;
      user: unknown;
      session: unknown;
    }
  | {
      requires2FA: true;
      pendingSessionId: string;
    };

const form = document.getElementById("login-form") as HTMLFormElement | null;
const shell = document.getElementById("login-shell");
const AUTH_STORAGE_KEY = "fitvibe:auth";

const loadSpa = async () => {
  await import("../main");
};

if (!form || !shell) {
  void loadSpa();
} else {
  const emailInput = form.elements.namedItem("email") as HTMLInputElement;
  const passwordInput = form.elements.namedItem("password") as HTMLInputElement;
  const toggleButton = form.querySelector<HTMLButtonElement>("[data-role='toggle-password']");
  const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit']");
  const errorRegion = form.querySelector<HTMLDivElement>(".login-fallback__error");

  const setError = (message: string | null) => {
    if (!errorRegion) {
      return;
    }
    if (message) {
      errorRegion.hidden = false;
      errorRegion.textContent = message;
    } else {
      errorRegion.hidden = true;
      errorRegion.textContent = "";
    }
  };

  toggleButton?.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggleButton.textContent = localizedAuth().auth.login.hidePasswordShort;
      toggleButton.setAttribute("aria-label", localizedAuth().auth.hidePassword);
    } else {
      passwordInput.type = "password";
      toggleButton.textContent = localizedAuth().auth.login.showPasswordShort;
      toggleButton.setAttribute("aria-label", localizedAuth().auth.showPassword);
    }
    passwordInput.focus();
  });

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!emailInput.value || !passwordInput.value) {
      setError(localizedAuth().auth.register.fillAllFields);
      return;
    }

    setError(null);
    submitButton?.setAttribute("disabled", "true");
    submitButton?.classList.add("login-fallback__button--loading");

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: emailInput.value,
          password: passwordInput.value,
        }),
      });

      if (!response.ok) {
        throw new Error(localizedAuth().auth.login.error);
      }

      const data = (await response.json()) as LoginResponse;

      if ("requires2FA" in data && data.requires2FA) {
        const searchParams = new URLSearchParams({
          pendingSessionId: data.pendingSessionId,
        });
        window.location.assign(`/login/verify-2fa?${searchParams.toString()}`);
        return;
      }

      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
      }
      window.location.assign("/");
    } catch {
      setError(localizedAuth().auth.login.error);
      submitButton?.removeAttribute("disabled");
      submitButton?.classList.remove("login-fallback__button--loading");
    }
  };

  form.addEventListener("submit", (event) => {
    void handleSubmit(event);
  });
}

export {};
