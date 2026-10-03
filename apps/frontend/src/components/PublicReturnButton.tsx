import React from "react";
import { Home, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@fitvibe/ui";
import { useAuthStore } from "../store/auth.store";

const PublicReturnButton: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const Icon = isAuthenticated ? Home : LogIn;

  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={
          <Icon size={16} aria-hidden="true" data-icon={isAuthenticated ? "home" : "login"} />
        }
        onClick={() => {
          void navigate(isAuthenticated ? "/" : "/login");
        }}
      >
        {t("navigation.back")}
      </Button>
    </div>
  );
};

export default PublicReturnButton;
