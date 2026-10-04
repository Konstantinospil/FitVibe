import React, { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { scheduleIdleTask } from "../utils/idleScheduler";

const headerSkeletonStyle: React.CSSProperties = {
  width: "48px",
  height: "40px",
  borderRadius: "var(--radius-full)",
  background: "var(--color-surface-muted)",
  border: "1px solid var(--color-border)",
  animation: "pulse 1.4s ease-in-out infinite",
};

const HeaderUtilities: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const { cancel } = scheduleIdleTask(() => setIsReady(true), { timeout: 300 });
    return () => cancel();
  }, []);

  if (!isReady) {
    return (
      <>
        <span aria-hidden="true" style={headerSkeletonStyle} />
        <span aria-hidden="true" style={headerSkeletonStyle} />
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
  <div
    style={{
      position: "absolute",
      top: "clamp(1rem, 3vw, 1.5rem)",
      right: "clamp(0.75rem, 3vw, 1.5rem)",
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      zIndex: 10,
      maxWidth: "calc(100% - clamp(1rem, 4vw, 1.5rem) * 2)",
    }}
  >
    <HeaderUtilities />
  </div>
);

export default HeaderUtilitiesBar;
