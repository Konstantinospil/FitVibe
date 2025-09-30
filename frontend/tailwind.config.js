export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#667eea",
        secondary: "#764ba2",
        accentGreen: "#34d399",
        accentPink: "#f472b6",
        accentOrange: "#f97316",
      },
      borderRadius: { '2xl': '1rem' }
    }
  },
  plugins: []
};
