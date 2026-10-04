import React from "react";
import PageIntro from "./PageIntro";
import Footer from "./Footer";
import HeaderUtilitiesBar from "./HeaderUtilities";
import { PageShell } from "../layouts/PageShell";

interface AuthPageLayoutProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

const AuthPageLayout: React.FC<AuthPageLayoutProps> = ({ title, description, children }) => (
  <PageShell header={<HeaderUtilitiesBar />} footer={<Footer />}>
    <PageIntro title={title} description={description} priorityLcp>
      {children}
    </PageIntro>
  </PageShell>
);

export default AuthPageLayout;
