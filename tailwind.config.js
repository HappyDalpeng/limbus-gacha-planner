/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
