/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          950: "#0b0f1a",
        },
      },
    },
  },
  plugins: [],
};
