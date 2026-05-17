/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        mono: ["'Geist Mono'", "'Fira Code'", "monospace"],
        sans: ["'Geist'", "-apple-system", "sans-serif"],
      },
      colors: {
        bg: {
          0: "#F7F5F0",
          1: "#F0EDE6",
          2: "#E8E4DC",
          3: "#DDD8CE",
        },
        border: {
          0: "#E2DDD4",
          1: "#CFC9BD",
          2: "#B8B0A0",
        },
        text: {
          0: "#1C1916",
          1: "#635D54",
          2: "#9E9589",
        },
        severity: {
          critical: { text: "#9B3B28", border: "#C89080", bg: "#FBF1EE" },
          high:     { text: "#8A5C10", border: "#C8A055", bg: "#FBF6EC" },
          medium:   { text: "#4D6E25", border: "#92B065", bg: "#F3F7ED" },
          low:      { text: "#2B6494", border: "#7AAAC8", bg: "#EEF3F9" },
        },
      },
      animation: {
        blink: "blink 0.9s step-end infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
}
