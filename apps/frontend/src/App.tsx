import React from "react";
import AppRouter from "./routes/AppRouter";
import CookieConsent from "./components/CookieConsent";
import { ToastProvider } from "./contexts/ToastContext";

const App: React.FC = () => (
  <ToastProvider>
    <AppRouter />
    <CookieConsent />
  </ToastProvider>
);

export default App;
