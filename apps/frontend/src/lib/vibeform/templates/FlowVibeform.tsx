import type { VibeformTemplateProps } from "./VibeformTemplate";
import { useTranslation } from "react-i18next";
import { toVibeformCssVariables } from "../css-variables";

export function FlowVibeform({
  parameters,
  motionEnabled,
  style,
  ...svgProps
}: VibeformTemplateProps) {
  const { t } = useTranslation();
  const variables = toVibeformCssVariables(parameters);
  const { geometry, colors } = parameters;

  return (
    <svg
      viewBox="0 0 240 320"
      role="img"
      aria-label={t("dashboard.vibeformAccessibleLabel")}
      data-vibeform-template="flow"
      data-motion-enabled={motionEnabled}
      style={{ ...variables, ...style }}
      {...svgProps}
    >
      <style>{`
        .vibeform-pulse {
          animation: vibeform-pulse var(--vibeform-pulse-duration) ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes vibeform-pulse {
          50% { scale: calc(1 + var(--vibeform-pulse-amplitude)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vibeform-pulse { animation: none; }
        }
      `}</style>
      <g
        className={motionEnabled ? "vibeform-pulse" : undefined}
        transform={`translate(120 160) rotate(${geometry.forwardLeanDeg}) scale(1 ${geometry.heightScale}) translate(-120 -160)`}
      >
        <circle cx="120" cy="48" r="23" fill={colors.head} />
        <path
          d="M44 122 C78 82 100 88 120 116 C140 88 162 82 196 122"
          fill="none"
          stroke={colors.agility.oklch}
          strokeWidth={18 * geometry.strokeScale * colors.agility.weight}
          strokeLinecap="round"
          transform={`translate(120 122) scale(${geometry.upperScale * geometry.shoulderScale} 1) translate(-120 -122)`}
        />
        <path
          d="M120 105 C88 154 92 204 58 278"
          fill="none"
          stroke={colors.endurance.oklch}
          strokeWidth={20 * geometry.strokeScale * colors.endurance.weight}
          strokeLinecap="round"
        />
        <path
          d="M120 105 C154 154 146 210 184 276"
          fill="none"
          stroke={colors.explosivity.oklch}
          strokeWidth={20 * geometry.strokeScale * colors.explosivity.weight}
          strokeLinecap="round"
          transform={`translate(120 210) scale(${geometry.lowerScale * geometry.hipScale} 1) translate(-120 -210)`}
        />
      </g>
    </svg>
  );
}
