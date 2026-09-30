import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, InputField, TextareaControl } from "@fitvibe/ui";
import PageIntro from "../components/PageIntro";
import { rawHttpClient, type SubmitContactResponse } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useAuthStore } from "../store/auth.store";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

const Contact: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);

  const [email, setEmail] = useState(user?.email ?? "");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void rawHttpClient
      .get<{ csrfToken: string }>("/api/v1/csrf-token", { withCredentials: true })
      .catch(() => undefined);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(
        t("contact.form.invalidEmail", { defaultValue: "Please enter a valid email address" }),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfResponse = await rawHttpClient.get<{ csrfToken: string }>("/api/v1/csrf-token", {
        withCredentials: true,
      });
      const csrfToken = csrfResponse.data.csrfToken;

      const response = await rawHttpClient.post<SubmitContactResponse>(
        "/api/v1/contact",
        {
          email: email.trim(),
          topic: topic.trim(),
          message: message.trim(),
          _csrf: csrfToken,
        },
        {
          headers: { "x-csrf-token": csrfToken },
          withCredentials: true,
        },
      );

      if (response.data.success) {
        toast.success(
          t("contact.form.success", {
            defaultValue: "Your message has been sent successfully!",
          }),
        );
        if (!user?.email) setEmail("");
        setTopic("");
        setMessage("");
      }
    } catch (err: unknown) {
      const responseError =
        err && typeof err === "object" && "response" in err
          ? (err as {
              response?: {
                data?: { error?: { code?: string; message?: string } };
              };
            }).response?.data?.error
          : undefined;

      const messageValue =
        responseError?.code === "CSRF_TOKEN_INVALID"
          ? t("contact.form.csrfError", {
              defaultValue: "Security token error. Please refresh the page and try again.",
            })
          : responseError?.message ||
            t("contact.form.error", {
              defaultValue: "Failed to send message. Please try again.",
            });

      setError(messageValue);
      toast.error(messageValue);
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
      <form
        ref={formRef}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="form"
      >
        <InputField
          label={t("contact.form.emailLabel", { defaultValue: "Email" })}
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting || Boolean(user?.email)}
          required
          autoComplete="email"
          error={Boolean(error)}
        />

        <InputField
          label={t("contact.form.topicLabel", { defaultValue: "Topic" })}
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          disabled={isSubmitting}
          required
          maxLength={200}
          error={Boolean(error)}
        />

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xs)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-family-body)",
            fontSize: "var(--type-control-size)",
            lineHeight: "var(--type-control-line-height)",
          }}
        >
          <span>{t("contact.form.messageLabel", { defaultValue: "Message" })}</span>
          <TextareaControl
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSubmitting}
            required
            rows={8}
            maxLength={5000}
            variant={error ? "error" : "default"}
            style={{ minHeight: "160px" }}
          />
          <span
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--type-supporting-size)",
              lineHeight: "var(--type-supporting-line-height)",
            }}
          >
            {message.length} / 5000{" "}
            {t("contact.form.characters", { defaultValue: "characters" })}
          </span>
        </label>

        {error ? (
          <div role="alert" className="form-error">
            {error}
          </div>
        ) : null}

        <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting
            ? t("contact.form.submitting", { defaultValue: "Sending..." })
            : t("contact.form.submit", { defaultValue: "Send Message" })}
        </Button>
      </form>
    </PageIntro>
  );
};

export default Contact;
