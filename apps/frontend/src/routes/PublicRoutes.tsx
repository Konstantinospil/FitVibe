import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PublicPageLayout from "../components/PublicPageLayout";
import Login from "../pages/Login";
import { LoadingFallback } from "../components/LoadingFallback";
import { loadFullTranslations } from "../i18n/config";

const TwoFactorVerificationLogin = lazy(() => import("../pages/TwoFactorVerificationLogin"));
const Register = lazy(() => import("../pages/Register"));
const VerifyEmail = lazy(() => import("../pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
// ResetPassword uses keys from common.json, which the minimal login bundle omits.
// Load its translations before mounting the public route, without inflating login.
const ResetPassword = lazy(async () => {
  const [module] = await Promise.all([import("../pages/ResetPassword"), loadFullTranslations()]);
  return module;
});
const Terms = lazy(() => import("../pages/Terms"));
const Privacy = lazy(() => import("../pages/Privacy"));
const Cookie = lazy(() => import("../pages/Cookie"));
const Contact = lazy(() => import("../pages/Contact"));
const TermsReacceptance = lazy(() => import("../pages/TermsReacceptance"));

const PublicRoutes: React.FC = () => (
  <Suspense fallback={<LoadingFallback />}>
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
        path="/cookie"
        element={
          <PublicPageLayout>
            <Cookie />
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
