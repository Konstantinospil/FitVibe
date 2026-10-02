import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Button } from "@fitvibe/ui";
import { loadLanguageTranslations } from "../i18n/config";

/**
 * Reliable flag rendering:
 * - Tries native emoji flags first (fastest).
 * - Falls back to inline SVGs when the platform/font cannot render emoji flags (Windows w/o color emoji fonts, some Linux distros).
 */

type LangCode = "en" | "de" | "fr" | "es" | "el";

type LanguageOption = {
  code: LangCode;
  displayCode: string;
  labelKey: string;
  // Either emoji or inline SVG renderer (fallback)
  emoji: string;
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
    <rect width="1" height="2" x="1" fill="var(--color-on-color)" />
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
    <rect y="2" width="27" height="2" fill="var(--color-on-color)" />
    <rect y="6" width="27" height="2" fill="var(--color-on-color)" />
    <rect y="10" width="27" height="2" fill="var(--color-on-color)" />
    <rect y="14" width="27" height="2" fill="var(--color-on-color)" />
    <rect width="10" height="10" fill={FLAG_COLORS.grBlue} />
    <rect x="4" width="2" height="10" fill="var(--color-on-color)" />
    <rect y="4" width="10" height="2" fill="var(--color-on-color)" />
  </svg>
);

// --- Language list ---
const LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    displayCode: "EN",
    labelKey: "language.english",
    emoji: "\uD83C\uDDEC\uD83C\uDDE7",
    Svg: GbFlag,
  },
  {
    code: "de",
    displayCode: "DE",
    labelKey: "language.german",
    emoji: "\uD83C\uDDE9\uD83C\uDDEA",
    Svg: DeFlag,
  },
  {
    code: "fr",
    displayCode: "FR",
    labelKey: "language.french",
    emoji: "\uD83C\uDDEB\uD83C\uDDF7",
    Svg: FrFlag,
  },
  {
    code: "es",
    displayCode: "ES",
    labelKey: "language.spanish",
    emoji: "\uD83C\uDDEA\uD83C\uDDF8",
    Svg: EsFlag,
  },
  {
    code: "el",
    displayCode: "EL",
    labelKey: "language.greek",
    emoji: "\uD83C\uDDEC\uD83C\uDDF7",
    Svg: ElFlag,
  },
];

// --- Emoji-support detection (fast heuristic) ---
let _emojiFlagSupport: boolean | null = null;
function supportsEmojiFlag(): boolean {
  if (typeof document === "undefined") {
    _emojiFlagSupport = false;
    return _emojiFlagSupport;
  }
  if (_emojiFlagSupport !== null) {
    return _emojiFlagSupport;
  }
  try {
    // Regional-indicator pairs (GB, DE, …) look like two letters when the OS
    // has no flag emoji. A real flag glyph is ~1em; letter fallback is ~2em.
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      _emojiFlagSupport = false;
      return _emojiFlagSupport;
    }
    ctx.font =
      "16px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif";
    const flagWidth = ctx.measureText("\uD83C\uDDEC\uD83C\uDDE7").width;
    const lettersWidth = ctx.measureText("GB").width;
    _emojiFlagSupport = flagWidth > 0 && lettersWidth > 0 && flagWidth < lettersWidth * 0.8;
    return _emojiFlagSupport;
  } catch {
    _emojiFlagSupport = false;
    return _emojiFlagSupport;
  }
}

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  background: "var(--color-surface-glass)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-full)",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-sm)",
  padding: "0.35rem 0.75rem",
  cursor: "pointer",
  transition: "background 150ms ease",
  position: "relative",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 0.5rem)",
  right: 0,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--dialog-shadow)",
  minWidth: "160px",
  zIndex: 1000,
  overflow: "hidden",
};

const optionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.6rem 1rem",
  cursor: "pointer",
  transition: "background 150ms ease",
  fontSize: "var(--font-size-sm)",
  border: "none",
  background: "transparent",
  width: "100%",
  textAlign: "left",
  color: "var(--color-text-primary)",
};

function FlagIcon({ option, size = 20 }: { option: LanguageOption; size?: number }) {
  const [supportsEmoji, setSupportsEmoji] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    setSupportsEmoji(typeof document !== "undefined" ? supportsEmojiFlag() : false);
  }, []);

  // During SSR or before detection, use SVG fallback
  if (supportsEmoji === null || !supportsEmoji) {
    return <option.Svg size={size} />;
  }

  return (
    <span
      role="img"
      aria-hidden="true"
      style={{
        fontSize: size,
        // architecture-token: data-value -- Emoji line box is intrinsic icon geometry, not application typography.
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {option.emoji}
    </span>
  );
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
  const [triggerHovered, setTriggerHovered] = useState(false);
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
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        display: "inline-flex",
      }}
    >
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
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
        className={variant === "header" ? "app-header__language-control" : undefined}
        style={{
          ...buttonStyle,
          minHeight: variant === "header" ? "44px" : "40px",
          padding: "var(--space-xs) var(--space-sm)",
          borderRadius: variant === "header" ? "var(--radius-md)" : "var(--radius-full)",
          border: variant === "header" ? "none" : "1px solid var(--color-border)",
          borderColor: variant === "header" ? "transparent" : "var(--color-border)",
          background: triggerHovered
            ? "var(--color-surface-muted)"
            : variant === "header"
              ? "none"
              : "var(--color-surface-glass)",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-family-body)",
          fontWeight: "var(--font-weight-regular)",
          fontSize: "var(--type-control-size)",
          lineHeight: "var(--type-control-line-height)",
          letterSpacing: "var(--type-control-letter-spacing)",
        }}
        aria-label={t("language.label")}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-busy={isChanging}
      >
        <FlagIcon option={currentLanguage} size={variant === "header" ? 26 : 24} />
        {variant === "header" ? (
          <span className="language-switcher__code">{currentLanguage.displayCode}</span>
        ) : null}
        <ChevronDown size={16} style={{ opacity: "var(--opacity-subtle)" }} />
      </Button>

      {isOpen && (
        <div style={dropdownStyle} role="menu" aria-label={t("language.select")}>
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
              style={{
                ...optionStyle,
                background:
                  option.code === validLanguage || index === focusedIndex
                    ? "var(--color-surface-muted)"
                    : "transparent",
                fontWeight:
                  option.code === validLanguage
                    ? "var(--font-weight-semibold)"
                    : "var(--font-weight-regular)",
              }}
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
