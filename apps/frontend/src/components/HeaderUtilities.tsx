import React, { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import BrandLogo from "./BrandLogo";
import { scheduleIdleTask } from "../utils/idleScheduler";

const HeaderUtilities: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const { cancel } = scheduleIdleTask(() => setIsReady(true), { timeout: 300 });
    return () => cancel();
  }, []);

  if (!isReady) {
    return (
      <>
        <span aria-hidden="true" data-component="header-skeleton" />
        <span aria-hidden="true" data-component="header-skeleton" />
      </>
    );
  }

  return (
    <>
      <ThemeToggle />
      <LanguageSwitcher />
    </>
  );
};

const HeaderUtilitiesBar: React.FC = () => (
  <header className="public-header" data-component="public-header">
    <div className="public-header__inner">
      <BrandLogo size="sm" priority />
      <div className="public-header__utilities">
        <HeaderUtilities />
      </div>
    </div>
  </header>
);

export default HeaderUtilitiesBar;
