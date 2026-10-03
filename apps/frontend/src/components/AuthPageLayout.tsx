import React from "react";
import PageIntro from "./PageIntro";
import Footer from "./Footer";
import BrandLogo from "./BrandLogo";
import HeaderUtilitiesBar from "./HeaderUtilities";
import { PageShell } from "../layouts/PageShell";

interface AuthPageLayoutProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

const AuthPageLayout: React.FC<AuthPageLayoutProps> = ({ title, description, children }) => (
  <PageShell header={<HeaderUtilitiesBar />} footer={<Footer />}>
    <PageIntro title={title} description={description} priorityLcp brand={<BrandLogo priority />}>
      {children}
    </PageIntro>
  </PageShell>
);

export default AuthPageLayout;
