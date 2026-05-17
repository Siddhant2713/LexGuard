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
          0: "#080809",
          1: "#0E0F11",
          2: "#141518",
          3: "#1C1D21",
        },
        border: {
          0: "#1F2024",
          1: "#2A2C31",
          2: "#3D4047",
        },
        text: {
          0: "#F2EDE8",
          1: "#9A9BA4",
          2: "#5A5B63",
        },
        severity: {
          critical: { text: "#E8646F", border: "#8B1A27", bg: "#100A0B" },
          high:     { text: "#D4933E", border: "#7A5410", bg: "#0F0C07" },
          medium:   { text: "#8EAA48", border: "#4A5E18", bg: "#0C0F07" },
          low:      { text: "#4D88B8", border: "#1C3E5A", bg: "#080C10" },
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
