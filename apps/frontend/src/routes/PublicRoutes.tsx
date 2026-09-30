import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PublicPageLayout from "../components/PublicPageLayout";
import Login from "../pages/Login";

const TwoFactorVerificationLogin = lazy(() => import("../pages/TwoFactorVerificationLogin"));
const Register = lazy(() => import("../pages/Register"));
const VerifyEmail = lazy(() => import("../pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const Terms = lazy(() => import("../pages/Terms"));
const Privacy = lazy(() => import("../pages/Privacy"));
const Contact = lazy(() => import("../pages/Contact"));
const TermsReacceptance = lazy(() => import("../pages/TermsReacceptance"));

const fallback = (
  <div
    className="flex h-screen w-full items-center justify-center text-primary-500"
    role="status"
    aria-live="polite"
  >
    Loading…
  </div>
);

const PublicRoutes: React.FC = () => (
  <Suspense fallback={fallback}>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/verify-2fa" element={<TwoFactorVerificationLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/terms"
        element={
          <PublicPageLayout>
            <Terms />
          </PublicPageLayout>
        }
      />
      <Route
        path="/privacy"
        element={
          <PublicPageLayout>
            <Privacy />
          </PublicPageLayout>
        }
      />
      <Route
        path="/contact"
        element={
          <PublicPageLayout>
            <Contact />
          </PublicPageLayout>
        }
      />
      <Route path="/terms-reacceptance" element={<TermsReacceptance />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </Suspense>
);

export default PublicRoutes;
