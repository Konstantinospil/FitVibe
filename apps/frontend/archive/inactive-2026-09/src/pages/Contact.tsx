import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { useAuthStore } from "../store/auth.store";
import PageIntro from "../components/PageIntro";
import { Card, CardContent, Button } from "../components/ui";
import { rawHttpClient, type SubmitContactResponse } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

const Contact: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);

  const [email, setEmail] = useState(user?.email || "");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fetch CSRF token when component mounts to establish the cookie session
  // This ensures the HttpOnly cookie containing the CSRF secret is set
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        // This request sets the HttpOnly cookie with the CSRF secret
        // The cookie must be set before we can use CSRF tokens
        await rawHttpClient.get<{ csrfToken: string }>("/api/v1/csrf-token", {
          withCredentials: true,
        });
      } catch (err) {
        // Log but don't block - we'll fetch fresh token on submission
        console.warn("Failed to pre-fetch CSRF token:", err);
      }
    };
    void fetchCsrfToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim()) {
      setError(t("contact.form.emailRequired", { defaultValue: "Email is required" }));
      return;
    }

    if (!topic.trim()) {
      setError(t("contact.form.topicRequired", { defaultValue: "Topic is required" }));
      return;
    }

    if (!message.trim()) {
      setError(t("contact.form.messageRequired", { defaultValue: "Message is required" }));
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(
        t("contact.form.invalidEmail", { defaultValue: "Please enter a valid email address" }),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // CSRF protection uses double-submit cookie pattern:
      // 1. Backend sets HttpOnly cookie with secret (__Host-fitvibe-csrf)
      // 2. Backend creates token from that secret
      // 3. We send token in header/body, backend verifies it matches cookie secret

      // Fetch fresh CSRF token - this request sets the HttpOnly cookie
      // Note: The cookie name uses __Host- prefix which requires Secure flag
      // In development, this might cause issues if not using HTTPS
      let csrfToken: string;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          const csrfResponse = await rawHttpClient.get<{ csrfToken: string }>("/api/v1/csrf-token");
          csrfToken = csrfResponse.data.csrfToken;

          if (!csrfToken || typeof csrfToken !== "string") {
            throw new Error("Invalid CSRF token received");
          }

          // Small delay to ensure cookie is set in browser
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Submit contact form with CSRF token
          // The HttpOnly cookie should be sent automatically (withCredentials: true)
          const response = await rawHttpClient.post<SubmitContactResponse>(
            "/api/v1/contact",
            {
              email: email.trim(),
              topic: topic.trim(),
              message: message.trim(),
              _csrf: csrfToken, // Include in body
            },
            {
              headers: {
                "x-csrf-token": csrfToken, // Also in header
              },
            },
          );

          if (response.data.success) {
            toast.success(
              t("contact.form.success", {
                defaultValue: "Your message has been sent successfully!",
              }),
            );
          }

          // Reset form on success
          setEmail(user?.email || "");
          setTopic("");
          setMessage("");
          return; // Success, exit retry loop
        } catch (submitError: unknown) {
          // Check if it's a CSRF error and we can retry
          const isCsrfError =
            submitError &&
            typeof submitError === "object" &&
            "response" in submitError &&
            (submitError as { response?: { data?: { error?: { code?: string } } } }).response?.data
              ?.error?.code === "CSRF_TOKEN_INVALID";

          if (isCsrfError && retryCount < maxRetries) {
            retryCount++;
            console.warn(`CSRF token error, retrying (${retryCount}/${maxRetries})...`);
            // Clear any cached token to force fresh fetch
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }

          // Not a retryable CSRF error or max retries reached
          throw submitError;
        }
      }
    } catch (err) {
      console.error("Contact form submission error:", err);

      // Check if it's a network/connection error
      if (err && typeof err === "object" && "code" in err && err.code === "ERR_NETWORK") {
        const networkError = t("contact.form.networkError", {
          defaultValue: "Cannot connect to server. Please check your connection and try again.",
        });
        setError(networkError);
        toast.error(networkError);
        return;
      }

      // Check for CSRF token error specifically
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error
          ?.code === "CSRF_TOKEN_INVALID"
      ) {
        // CSRF token error - likely cookie not set or not sent
        // Try to refresh the page token and retry once
        console.error("CSRF token validation failed. Possible causes:");
        console.error("1. Cookie not set (check browser console for cookie issues)");
        console.error("2. Cookie not sent with request (check withCredentials)");
        console.error("3. Token/secret mismatch");

        const csrfError = t("contact.form.csrfError", {
          defaultValue:
            "Security token error. Please refresh the page and try again. If the problem persists, check your browser's cookie settings.",
        });
        setError(csrfError);
        toast.error(csrfError);
        return;
      }

      // Generic error handling
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data
              ?.error?.message ||
            t("contact.form.error", { defaultValue: "Failed to send message. Please try again." })
          : t("contact.form.error", { defaultValue: "Failed to send message. Please try again." });
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageIntro
      eyebrow={t("contact.eyebrow", { defaultValue: "Contact" })}
      title={t("contact.title", { defaultValue: "Contact Us" })}
      description={t("contact.description", {
        defaultValue: "Get in touch with the FitVibe team.",
      })}
    >
      <Card className="contact-form-container">
        <CardContent className="contact-form-content line-height-15 text-primary text-md">
          <div className="mb-15">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Home size={16} />}
              onClick={() => {
                void navigate(isAuthenticated ? "/" : "/login");
              }}
            >
              {isAuthenticated
                ? t("navigation.home", { defaultValue: "Home" })
                : t("auth.login.title", { defaultValue: "Login" })}
            </Button>
          </div>
          <form
            ref={formRef}
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="form form--gap-lg"
          >
            <div className="form-label">
              <label htmlFor="contact-email" className="form-label-text">
                {t("contact.form.emailLabel", { defaultValue: "Email" })}
              </label>
              <input
                id="contact-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || !!user?.email}
                required
                aria-required="true"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "contact-error" : undefined}
              />
            </div>

            <div className="form-label">
              <label htmlFor="contact-topic" className="form-label-text">
                {t("contact.form.topicLabel", { defaultValue: "Topic" })}
              </label>
              <input
                id="contact-topic"
                type="text"
                className="form-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isSubmitting}
                required
                maxLength={200}
                aria-required="true"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "contact-error" : undefined}
              />
            </div>

            <div className="form-label">
              <label htmlFor="contact-message" className="form-label-text">
                {t("contact.form.messageLabel", { defaultValue: "Message" })}
              </label>
              <textarea
                id="contact-message"
                className="form-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                required
                rows={8}
                maxLength={5000}
                style={{
                  resize: "vertical",
                  minHeight: "120px",
                }}
                aria-required="true"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "contact-error" : undefined}
              />
              <small className="text-muted mt-075">
                {message.length} / 5000{" "}
                {t("contact.form.characters", { defaultValue: "characters" })}
              </small>
            </div>

            {error && (
              <div id="contact-error" className="form-error" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-fallback__button w-full mt-075"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t("contact.form.submitting", { defaultValue: "Sending..." })
                : t("contact.form.submit", { defaultValue: "Send Message" })}
            </button>
          </form>
        </CardContent>
      </Card>
    </PageIntro>
  );
};

export default Contact;
