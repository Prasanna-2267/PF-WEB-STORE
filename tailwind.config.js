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
        obsidian: {
          950: '#09090B',
          900: '#111827',
          850: '#18181B',
          800: '#27272A',
          700: '#3F3F46',
        },
        brand: {
          blue: '#4F8CFF',
          accent: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 10px 30px -5px rgba(0, 0, 0, 0.8)',
      },
    },
  },
  plugins: [],
}
