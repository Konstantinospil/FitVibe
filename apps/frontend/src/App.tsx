import React from "react";
import { useTranslation } from "react-i18next";
import AppRouter from "./routes/AppRouter";
import { ToastProvider } from "./contexts/ToastContext";
import { CustomScrollbar } from "./components/CustomScrollbar";

const App: React.FC = () => {
  const { t } = useTranslation();
  return (
  <ToastProvider>
    <CustomScrollbar className="app-page-scrollbar" label={t("scrollbar.pageLabel")}>
      <AppRouter />
    </CustomScrollbar>
  </ToastProvider>
  );
};

export default App;
