import React, { createContext, useContext, useState } from "react";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

const tabsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-sm)",
  borderBottom: "1px solid var(--color-border)",
  marginBottom: "var(--space-md)",
};

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
  style,
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = controlledValue ?? internalValue;

  const setActiveTab = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div
        className={className}
        style={{
          ...tabsStyle,
          ...style,
        }}
        role="tablist"
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className, style, ...props }) => {
  return (
    <div
      className={className}
      style={{
        ...listStyle,
        ...style,
      }}
      role="tablist"
      {...props}
    >
      {children}
    </div>
  );
};

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

const triggerBaseStyle: React.CSSProperties = {
  padding: "var(--space-sm) var(--space-md)",
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "var(--font-size-md)",
  transition: "color 150ms ease, border-color 150ms ease",
  position: "relative",
  bottom: "-1px",
};

const triggerActiveStyle: React.CSSProperties = {
  color: "var(--color-text-primary)",
  borderBottomColor: "var(--color-primary)",
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  className,
  style,
  ...props
}) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  const handleClick = () => {
    setActiveTab(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveTab(value);
    }
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      className={className}
      style={{
        ...triggerBaseStyle,
        ...(isActive ? triggerActiveStyle : {}),
        ...style,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </button>
  );
};

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className,
  style,
  ...props
}) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }

  const { activeTab } = context;
  const isActive = activeTab === value;

  if (!isActive) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={className}
      style={{
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
