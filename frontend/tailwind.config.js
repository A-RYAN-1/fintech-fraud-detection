/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand: a clear sky blue, close to PayPal's own blue so the two sit well together.
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        // A second, cooler accent for the brand gradient and AI surfaces.
        accent: {
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
        },
        // Cool greys (zinc). Same lightness steps as before, so the contrast audit still holds.
        neutral: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          925: "#111113",
          950: "#09090b",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 4px 16px -4px rgba(0, 0, 0, 0.06)",
        "soft-lg":
          "0 10px 40px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        // A one-pixel top highlight that lifts dark surfaces off the page.
        "inset-hi": "inset 0 1px 0 0 rgba(255, 255, 255, 0.04)",
        glow: "0 0 0 1px rgba(14, 165, 233, 0.25), 0 8px 32px -8px rgba(14, 165, 233, 0.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
        "dot-grid":
          "radial-gradient(circle at 1px 1px, rgba(127, 127, 127, 0.18) 1px, transparent 0)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        flow: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s infinite",
        flow: "flow 2.4s ease-in-out infinite",
        in: "fadeIn 0.2s ease-out",
        "slide-in-from-top-2": "slideDownAndFade 0.3s ease-out",
        "slide-in-from-bottom-2": "slideUpAndFade 0.3s ease-out",
        "slide-in-from-left-2": "slideRightAndFade 0.3s ease-out",
        "slide-in-from-right-2": "slideLeftAndFade 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
