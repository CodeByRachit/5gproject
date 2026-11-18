/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        campus: {
          dark: '#0b1320',
          card: '#111d32',
          border: '#1f2e4a',
          accent: '#2563eb',
          accentHover: '#1d4ed8'
        }
      }
    },
  },
  plugins: [],
}
