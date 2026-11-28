import type React from "react";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import LoginFormContent from "./LoginFormContent";

const Login: React.FC = () => {
  const { t } = useTranslation();

  return (
    <AuthPageLayout title={t("auth.login.title")} description={t("auth.login.description")}>
      <LoginFormContent />
    </AuthPageLayout>
  );
};

export default Login;
