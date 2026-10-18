import React from "react";
import AppRouter from "./routes/AppRouter";
import { ToastProvider } from "./contexts/ToastContext";

const App: React.FC = () => (
  <ToastProvider>
    <AppRouter />
  </ToastProvider>
);

export default App;
