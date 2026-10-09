import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Button } from "@fitvibe/ui";
import { loadLanguageTranslations } from "../i18n/config";

/**
 * Deterministic flag rendering:
 * - Always uses inline SVGs so national flag colors do not vary by OS/browser emoji artwork.
 * - Flag colors are reference data and intentionally remain independent from FitVibe theme tokens.
 */

type LangCode = "en" | "de" | "fr" | "es" | "el";

type LanguageOption = {
  code: LangCode;
  displayCode: string;
  labelKey: string;
  Svg: React.FC<{ size?: number; style?: React.CSSProperties }>;
};

// --- Inline SVG fallbacks (simple, lightweight) ---
const FLAG_COLORS = {
  gbBlue: "#012169", // architecture-token: data-value -- Official UK flag color is reference data, not a FitVibe theme color.
  white: "#fff", // architecture-token: data-value -- Official flag white is reference data, not a FitVibe theme color.
  gbRed: "#C8102E", // architecture-token: data-value -- Official UK flag color is reference data, not a FitVibe theme color.
  deBlack: "#000", // architecture-token: data-value -- Official German flag color is reference data, not a FitVibe theme color.
  deRed: "#DD0000", // architecture-token: data-value -- Official German flag color is reference data, not a FitVibe theme color.
  deGold: "#FFCE00", // architecture-token: data-value -- Official German flag color is reference data, not a FitVibe theme color.
  frBlue: "#002654", // architecture-token: data-value -- Official French flag color is reference data, not a FitVibe theme color.
  frRed: "#ED2939", // architecture-token: data-value -- Official French flag color is reference data, not a FitVibe theme color.
  esRed: "#AA151B", // architecture-token: data-value -- Official Spanish flag color is reference data, not a FitVibe theme color.
  esGold: "#F1BF00", // architecture-token: data-value -- Official Spanish flag color is reference data, not a FitVibe theme color.
  grBlue: "#0D5EAF", // architecture-token: data-value -- Official Greek flag color is reference data, not a FitVibe theme color.
} as const;

const GbFlag: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={(size * 3) / 4}
    viewBox="0 0 60 40"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{
      display: "inline-block",
      verticalAlign: "-0.2em",
      // architecture-token: data-value -- Flag corner rounding is intrinsic SVG glyph geometry, not application UI radius.
      borderRadius: 2,
      ...style,
    }}
  >
    <clipPath id="gb-clip">
      <rect width="60" height="40" rx="2" ry="2" />
    </clipPath>
    <g clipPath="url(#gb-clip)">
      <rect width="60" height="40" fill={FLAG_COLORS.gbBlue} />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke={FLAG_COLORS.white} strokeWidth="8" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke={FLAG_COLORS.gbRed} strokeWidth="4" />
      <path d="M30,0 v40 M0,20 h60" stroke={FLAG_COLORS.white} strokeWidth="13" />
      <path d="M30,0 v40 M0,20 h60" stroke={FLAG_COLORS.gbRed} strokeWidth="8" />
    </g>
  </svg>
);

const DeFlag: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={(size * 3) / 5}
    viewBox="0 0 3 2"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{
      display: "inline-block",
      verticalAlign: "-0.2em",
      // architecture-token: data-value -- Flag corner rounding is intrinsic SVG glyph geometry, not application UI radius.
      borderRadius: 2,
      ...style,
    }}
  >
    <rect width="3" height="2" fill={FLAG_COLORS.deBlack} />
    <rect width="3" height="1.3333" y="0.6667" fill={FLAG_COLORS.deRed} />
    <rect width="3" height="0.6667" y="1.3333" fill={FLAG_COLORS.deGold} />
  </svg>
);

const FrFlag: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={(size * 3) / 5}
    viewBox="0 0 3 2"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{
      display: "inline-block",
      verticalAlign: "-0.2em",
      // architecture-token: data-value -- Flag corner rounding is intrinsic SVG glyph geometry, not application UI radius.
      borderRadius: 2,
      ...style,
    }}
  >
    <rect width="1" height="2" fill={FLAG_COLORS.frBlue} />
    <rect width="1" height="2" x="1" fill={FLAG_COLORS.white} />
    <rect width="1" height="2" x="2" fill={FLAG_COLORS.frRed} />
  </svg>
);

const EsFlag: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={(size * 3) / 5}
    viewBox="0 0 3 2"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{
      display: "inline-block",
      verticalAlign: "-0.2em",
      // architecture-token: data-value -- Flag corner rounding is intrinsic SVG glyph geometry, not application UI radius.
      borderRadius: 2,
      ...style,
    }}
  >
    <rect width="3" height="0.5" fill={FLAG_COLORS.esRed} />
    <rect width="3" height="1" y="0.5" fill={FLAG_COLORS.esGold} />
    <rect width="3" height="0.5" y="1.5" fill={FLAG_COLORS.esRed} />
  </svg>
);

const ElFlag: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={(size * 2) / 3}
    viewBox="0 0 27 18"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{
      display: "inline-block",
      verticalAlign: "-0.2em",
      // architecture-token: data-value -- Flag corner rounding is intrinsic SVG glyph geometry, not application UI radius.
      borderRadius: 2,
      ...style,
    }}
  >
    <rect width="27" height="18" fill={FLAG_COLORS.grBlue} />
    <rect y="2" width="27" height="2" fill={FLAG_COLORS.white} />
    <rect y="6" width="27" height="2" fill={FLAG_COLORS.white} />
    <rect y="10" width="27" height="2" fill={FLAG_COLORS.white} />
    <rect y="14" width="27" height="2" fill={FLAG_COLORS.white} />
    <rect width="10" height="10" fill={FLAG_COLORS.grBlue} />
    <rect x="4" width="2" height="10" fill={FLAG_COLORS.white} />
    <rect y="4" width="10" height="2" fill={FLAG_COLORS.white} />
  </svg>
);

// --- Language list ---
const LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    displayCode: "EN",
    labelKey: "language.english",
    Svg: GbFlag,
  },
  {
    code: "de",
    displayCode: "DE",
    labelKey: "language.german",
    Svg: DeFlag,
  },
  {
    code: "fr",
    displayCode: "FR",
    labelKey: "language.french",
    Svg: FrFlag,
  },
  {
    code: "es",
    displayCode: "ES",
    labelKey: "language.spanish",
    Svg: EsFlag,
  },
  {
    code: "el",
    displayCode: "EL",
    labelKey: "language.greek",
    Svg: ElFlag,
  },
];

function FlagIcon({ option, size = 20 }: { option: LanguageOption; size?: number }) {
  return <option.Svg size={size} />;
}

export type LanguageSwitcherVariant = "default" | "header";

type LanguageSwitcherProps = {
  variant?: LanguageSwitcherVariant;
};

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = "default" }) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isChanging, setIsChanging] = useState(false);
  const activeLanguage = (i18n.language?.slice(0, 2) || "en") as LangCode;

  // Fallback to 'en' if language is not in LANGUAGES
  const validLanguage: LangCode = LANGUAGES.find((lang) => lang.code === activeLanguage)
    ? activeLanguage
    : "en";

  const currentLanguage = LANGUAGES.find((lang) => lang.code === validLanguage) ?? LANGUAGES[0];
  const currentIndex = LANGUAGES.findIndex((lang) => lang.code === validLanguage);

  const handleLanguageChange = React.useCallback(
    (code: LangCode) => {
      if (isChanging) {
        return;
      }
      setIsOpen(false);
      setFocusedIndex(-1);
      setIsChanging(true);
      void (async () => {
        try {
          await loadLanguageTranslations(code);
          await i18n.changeLanguage(code);
        } finally {
          setIsChanging(false);
          buttonRef.current?.focus();
        }
      })();
    },
    [i18n, isChanging],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!isOpen) {
        // Open dropdown on ArrowDown, ArrowUp, Enter, or Space
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsOpen(true);
          setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
        } else if (e.key === "Escape") {
          setIsOpen(false);
          setFocusedIndex(-1);
        }
        return;
      }

      // Handle keyboard navigation when dropdown is open
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setFocusedIndex(-1);
          buttonRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev < LANGUAGES.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : LANGUAGES.length - 1));
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(LANGUAGES.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < LANGUAGES.length) {
            handleLanguageChange(LANGUAGES[focusedIndex].code);
          }
          break;
        default:
          // Close on other keys (optional - can be removed if not desired)
          if (e.key.length === 1) {
            // Single character - might be typing to search
            // For now, just close dropdown
            setIsOpen(false);
            setFocusedIndex(-1);
          }
          break;
      }
    },
    [isOpen, focusedIndex, handleLanguageChange, currentIndex],
  );

  // Focus management when dropdown opens
  useEffect(() => {
    if (isOpen && focusedIndex >= 0) {
      const optionElements =
        dropdownRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
      if (optionElements && optionElements[focusedIndex]) {
        optionElements[focusedIndex].focus();
      }
    }
  }, [isOpen, focusedIndex]);

  return (
    <div ref={dropdownRef} data-component="language-switcher" data-variant={variant}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        type="button"
        disabled={isChanging}
        onClick={() => {
          setIsOpen(!isOpen);
          setFocusedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className={variant === "header" ? "app-header__language-control" : undefined}
        data-slot="language-trigger"
        aria-label={t("language.label")}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-busy={isChanging}
      >
        <FlagIcon option={currentLanguage} size={variant === "header" ? 26 : 24} />
        {variant === "header" ? (
          <span className="language-switcher__code">{currentLanguage.displayCode}</span>
        ) : null}
        <ChevronDown size={16} data-slot="language-chevron" />
      </Button>

      {isOpen && (
        <div data-slot="language-menu" role="menu" aria-label={t("language.select")}>
          {LANGUAGES.map((option, index) => (
            <Button
              key={option.code}
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => handleLanguageChange(option.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleLanguageChange(option.code);
                }
              }}
              data-slot="language-option"
              data-selected={option.code === validLanguage ? "true" : undefined}
              data-focused={index === focusedIndex ? "true" : undefined}
              onMouseEnter={() => {
                setFocusedIndex(index);
              }}
              onFocus={() => {
                setFocusedIndex(index);
              }}
              role="menuitemradio"
              aria-checked={option.code === validLanguage}
              tabIndex={index === focusedIndex ? 0 : -1}
              disabled={isChanging}
            >
              <FlagIcon option={option} size={20} />
              <span>{t(option.labelKey)}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
