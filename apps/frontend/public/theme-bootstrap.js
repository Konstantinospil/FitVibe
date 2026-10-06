(() => {
  const storageKey = "fitvibe:theme";
  const root = document.documentElement;

  const storedTheme = (() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const value = parsed?.state?.theme;
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  })();

  const theme =
    storedTheme ??
    (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");

  root.setAttribute("data-theme", theme);

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.href = theme === "light" ? "/fitvibe-mark-light.svg" : "/fitvibe-mark-dark.svg";
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  const bootstrapBackground = getComputedStyle(root).getPropertyValue("--bootstrap-bg").trim();
  if (themeColor && bootstrapBackground) {
    themeColor.setAttribute("content", bootstrapBackground);
  }
})();
