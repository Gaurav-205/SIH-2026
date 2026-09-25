/** @type {import('tailwindcss').Config} */

// Semantic colours come from CSS variables (see src/index.css), so light/dark
// themes switch by toggling the `dark` class on <html> — components never hard-code a theme.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        subtle: token("subtle"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        accent: { DEFAULT: token("accent"), fg: token("accent-fg"), soft: token("accent-soft") },
        ok: { DEFAULT: token("ok"), soft: token("ok-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)",
        pop: "0 12px 32px -8px rgb(16 24 40 / 0.18), 0 4px 8px -4px rgb(16 24 40 / 0.08)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        pulse_ring: { "0%": { transform: "scale(1)", opacity: "0.7" }, "80%,100%": { transform: "scale(2.4)", opacity: "0" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out both",
        "pulse-ring": "pulse_ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};
