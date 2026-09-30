import React from "react";
import { NavLink } from "react-router-dom";
import PageIntro from "../components/PageIntro";
import { useTranslation } from "react-i18next";

const NotFound: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageIntro
      eyebrow={t("notFound.eyebrow")}
      title={t("notFound.title")}
      description={t("notFound.description")}
    >
      <div className="flex flex--gap-md flex--wrap">
        <NavLink
          to="/dashboard"
          className="rounded-xl font-weight-600"
          style={{
            padding: "0.9rem 1.4rem",
            background: "var(--color-accent)",
            color: "var(--color-primary-on)",
            letterSpacing: "0.02em",
          }}
        >
          {t("notFound.takeMeHome")}
        </NavLink>
        <NavLink
          to="/"
          className="rounded-xl font-weight-600 text-secondary"
          style={{
            padding: "0.9rem 1.4rem",
            background: "var(--surface-muted-subtle)",
            border: "1px solid var(--color-border)",
            letterSpacing: "0.02em",
          }}
        >
          {t("notFound.goToLanding")}
        </NavLink>
      </div>
    </PageIntro>
  );
};

export default NotFound;
