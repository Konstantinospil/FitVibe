import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  category?: string;
}

export interface KeyboardShortcutsProps {
  shortcuts?: KeyboardShortcut[];
  triggerLabel?: string;
}

/**
 * KeyboardShortcuts component - Display keyboard shortcuts help.
 * Provides accessible keyboard shortcuts reference (WCAG 2.2 AA).
 */
export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  shortcuts,
  triggerLabel,
}) => {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);

  const defaultShortcuts: KeyboardShortcut[] = [
    {
      keys: ["/"],
      description: t("keyboardShortcuts.focusSearch") || "Focus search",
      category: t("keyboardShortcuts.navigation") || "Navigation",
    },
    {
      keys: ["Esc"],
      description: t("keyboardShortcuts.closeModal") || "Close modal or dialog",
      category: t("keyboardShortcuts.navigation") || "Navigation",
    },
    {
      keys: ["?", "Shift", "?"],
      description: t("keyboardShortcuts.showShortcuts") || "Show keyboard shortcuts",
      category: t("keyboardShortcuts.navigation") || "Navigation",
    },
    {
      keys: ["Arrow", "Up"],
      description: t("keyboardShortcuts.moveUp") || "Move item up (in lists)",
      category: t("keyboardShortcuts.actions") || "Actions",
    },
    {
      keys: ["Arrow", "Down"],
      description: t("keyboardShortcuts.moveDown") || "Move item down (in lists)",
      category: t("keyboardShortcuts.actions") || "Actions",
    },
    {
      keys: ["Enter"],
      description: t("keyboardShortcuts.activate") || "Activate or select item",
      category: t("keyboardShortcuts.actions") || "Actions",
    },
  ];

  const shortcutsToDisplay = shortcuts || defaultShortcuts;
  const categories = Array.from(new Set(shortcutsToDisplay.map((s) => s.category || ""))).filter(
    Boolean,
  );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        leftIcon={<Keyboard size={18} />}
        aria-label={triggerLabel || t("keyboardShortcuts.show") || "Show keyboard shortcuts"}
      >
        {triggerLabel || t("keyboardShortcuts.shortcuts") || "Shortcuts"}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("keyboardShortcuts.title") || "Keyboard Shortcuts"}
        size="lg"
      >
        <div className="flex flex--column flex--gap-lg">
          {categories.length > 0 ? (
            categories.map((category) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-md">{category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex--column flex--gap-md">
                    {shortcutsToDisplay
                      .filter((s) => (s.category || "") === category)
                      .map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex flex--align-center flex--justify-between"
                          style={{
                            padding: "var(--space-sm)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                          }}
                        >
                          <span className="text-sm">{shortcut.description}</span>
                          <div className="flex flex--gap-xs">
                            {shortcut.keys
                              .filter((k) => k !== "Arrow")
                              .map((key, keyIndex) => (
                                <kbd
                                  key={keyIndex}
                                  className="text-xs font-weight-600"
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    background: "var(--color-surface)",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: "var(--radius-sm)",
                                    fontFamily: "var(--font-family-mono)",
                                  }}
                                >
                                  {key}
                                </kbd>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex--column flex--gap-md">
              {shortcutsToDisplay.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex flex--align-center flex--justify-between"
                  style={{
                    padding: "var(--space-sm)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span className="text-sm">{shortcut.description}</span>
                  <div className="flex flex--gap-xs">
                    {shortcut.keys.map((key, keyIndex) => (
                      <kbd
                        key={keyIndex}
                        className="text-xs font-weight-600"
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                          fontFamily: "var(--font-family-mono)",
                        }}
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
