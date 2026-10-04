import React from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../store/theme.store";

type BrandLogoSize = "sm" | "lg";

const BRAND_MARK_DARK_SRC = "/fitvibe-mark-dark.svg";
const BRAND_MARK_LIGHT_SRC = "/fitvibe-mark-light.svg";

const SIZE_STYLES: Record<BrandLogoSize, React.CSSProperties> = {
  sm: {
    height: "32px",
    width: "32px",
    display: "block",
  },
  lg: {
    height: "clamp(64px, 10vw, 96px)",
    width: "clamp(64px, 10vw, 96px)",
    display: "block",
  },
};

const SIZE_DIMS: Record<BrandLogoSize, { width: number; height: number }> = {
  sm: { width: 32, height: 32 },
  lg: { width: 96, height: 96 },
};

type BrandLogoProps = {
  size?: BrandLogoSize;
  priority?: boolean;
};

const BrandLogo: React.FC<BrandLogoProps> = ({ size = "lg", priority = false }) => {
  const { t } = useTranslation();
  const theme = useThemeStore((state) => state.theme);
  const src = theme === "dark" ? BRAND_MARK_DARK_SRC : BRAND_MARK_LIGHT_SRC;
  const dims = SIZE_DIMS[size];

  return (
    <img
      src={src}
      alt={t("brand.logoAlt")}
      width={dims.width}
      height={dims.height}
      decoding={priority ? "sync" : "async"}
      loading={priority ? "eager" : "lazy"}
      style={SIZE_STYLES[size]}
      {...(priority ? { fetchPriority: "high" } : {})}
    />
  );
};

export default BrandLogo;
