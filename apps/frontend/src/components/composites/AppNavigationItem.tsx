import React from "react";
import { Link } from "react-router-dom";

export interface AppNavigationItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}

export const AppNavigationItem: React.FC<AppNavigationItemProps> = ({
  to,
  label,
  icon,
  active = false,
  disabled = false,
  showLabel = true,
}) => {
  const content = (
    <>
      <span className="app-header__nav-icon" aria-hidden="true">
        {icon}
      </span>
      {showLabel ? <span className="app-header__nav-label">{label}</span> : null}
    </>
  );

  if (disabled) {
    return (
      <span
        className="app-header__nav-item"
        role="link"
        aria-label={label}
        aria-disabled="true"
        data-state="disabled"
        title={label}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      to={to}
      className="app-header__nav-item"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-state={active ? "active" : "default"}
      title={label}
    >
      {content}
    </Link>
  );
};
