import React from "react";
import Footer from "./Footer";
import HeaderUtilitiesBar from "./HeaderUtilities";
import { PageShell } from "../layouts/PageShell";

interface PublicPageLayoutProps {
  children: React.ReactNode;
}

const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({ children }) => (
  <PageShell header={<HeaderUtilitiesBar />} footer={<Footer />}>
    {children}
  </PageShell>
);

export default PublicPageLayout;
