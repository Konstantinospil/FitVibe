import React from "react";
import AppRouter from "./routes/AppRouter";
import { ToastProvider } from "./contexts/ToastContext";
import { CustomScrollbar } from "./components/CustomScrollbar";

const App: React.FC = () => (
  <ToastProvider>
    <CustomScrollbar className="app-page-scrollbar" label="Page content">
      <AppRouter />
    </CustomScrollbar>
  </ToastProvider>
);

export default App;
