import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, InputField, TextareaField } from "@fitvibe/ui";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
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
      setError(t("contact.form.emailRequired"));
      return;
    }
    if (!topic.trim()) {
      setError(t("contact.form.topicRequired"));
      return;
    }
    if (!message.trim()) {
      setError(t("contact.form.messageRequired"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(
        t("contact.form.invalidEmail"),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const maxCsrfRetries = 2;
      let attempt = 0;

      while (attempt <= maxCsrfRetries) {
        try {
          const csrfResponse = await rawHttpClient.get<{ csrfToken: string }>(
            "/api/v1/csrf-token",
            { withCredentials: true },
          );
          const csrfToken = csrfResponse.data.csrfToken;

          if (!csrfToken || typeof csrfToken !== "string") {
            throw new Error("Invalid CSRF token received");
          }

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
              t("contact.form.success"),
            );
            if (!user?.email) {
              setEmail("");
            }
            setTopic("");
            setMessage("");
          }
          return;
        } catch (submitError: unknown) {
          const csrfError =
            submitError &&
            typeof submitError === "object" &&
            "response" in submitError &&
            (submitError as { response?: { data?: { error?: { code?: string } } } }).response?.data
              ?.error?.code === "CSRF_TOKEN_INVALID";

          if (csrfError && attempt < maxCsrfRetries) {
            attempt += 1;
            continue;
          }

          throw submitError;
        }
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "ERR_NETWORK") {
        const networkError = t("contact.form.networkError");
        setError(networkError);
        toast.error(networkError);
        return;
      }

      let responseError: { code?: string; message?: string } | undefined;
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        };
        responseError = axiosError.response?.data?.error;
      }

      const messageValue =
        responseError?.code === "CSRF_TOKEN_INVALID"
          ? t("contact.form.csrfError")
          : t("contact.form.error");

      setError(messageValue);
      toast.error(messageValue);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageIntro
      eyebrow={t("contact.eyebrow")}
      title={t("contact.title")}
      description={t("contact.description")}
    >
      <FormStack
        ref={formRef}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <InputField
          label={t("contact.form.emailLabel")}
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
          label={t("contact.form.topicLabel")}
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          disabled={isSubmitting}
          required
          maxLength={200}
          error={Boolean(error)}
        />

        <TextareaField
          label={t("contact.form.messageLabel")}
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={isSubmitting}
          required
          rows={8}
          maxLength={5000}
          error={Boolean(error)}
          helperText={`${message.length} / 5000 ${t("contact.form.characters")}`}
        />

        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}

        <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting
            ? t("contact.form.submitting")
            : t("contact.form.submit")}
        </Button>
      </FormStack>
    </PageIntro>
  );
};

export default Contact;
