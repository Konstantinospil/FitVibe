import messages from "./login-shell-text.json";

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

const preferredLanguage =
  window.localStorage.getItem("fitvibe:language")?.slice(0, 2).toLowerCase() ||
  document.documentElement.lang.slice(0, 2).toLowerCase() ||
  window.navigator.language.slice(0, 2).toLowerCase();
const loginText = messages[preferredLanguage as keyof typeof messages] ?? messages.en;

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
      toggleButton.textContent = loginText.hide;
      toggleButton.setAttribute("aria-label", loginText.hidePassword);
    } else {
      passwordInput.type = "password";
      toggleButton.textContent = loginText.show;
      toggleButton.setAttribute("aria-label", loginText.showPassword);
    }
    passwordInput.focus();
  });

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!emailInput.value || !passwordInput.value) {
      setError(loginText.missingFields);
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
        throw new Error(loginText.invalidCredentials);
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
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : loginText.invalidCredentials,
      );
      submitButton?.removeAttribute("disabled");
      submitButton?.classList.remove("login-fallback__button--loading");
    }
  };

  form.addEventListener("submit", (event) => {
    void handleSubmit(event);
  });
}

export {};
