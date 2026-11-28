/**
 * Styles for HTML email. Mail clients ignore stylesheets, so templates inline
 * these strings instead of repeating literal colours and sizes.
 *
 * Colours mirror the light theme in apps/frontend/src/styles/themes.css
 * ([data-theme="light"]): emails render on a white page.
 */
export const EMAIL_COLORS = {
  // --color-primary / --color-primary-on: 4.87:1 contrast.
  action: "#4F7282",
  actionText: "#FAF8F4",
  // --color-text-secondary: meets WCAG AA on white.
  secondaryText: "#59676C",
} as const;

export const EMAIL_STYLES = {
  container: "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;",
  button:
    "display: inline-block; padding: 12px 24px; " +
    `background-color: ${EMAIL_COLORS.action}; color: ${EMAIL_COLORS.actionText}; ` +
    "text-decoration: none; border-radius: 6px;",
  rawLink: `color: ${EMAIL_COLORS.secondaryText}; word-break: break-all;`,
  smallPrint: `color: ${EMAIL_COLORS.secondaryText}; font-size: 12px;`,
  footer: `color: ${EMAIL_COLORS.secondaryText}; font-size: 12px; margin-top: 32px;`,
} as const;
