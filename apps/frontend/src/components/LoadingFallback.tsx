import { useTranslation } from "react-i18next";

export function LoadingFallback() {
  const { t } = useTranslation();
  return (
    <div
      className="flex h-screen w-full items-center justify-center text-primary-500"
      data-ssr-loading-fallback="true"
      role="status"
      aria-live="polite"
    >
      {t("loading.app")}
    </div>
  );
}
