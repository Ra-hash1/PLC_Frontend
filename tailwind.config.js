/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:  '#1B4F8A',
          secondary: '#2E75B6',
          accent:    '#00C2FF',
        },
        status: {
          running:  '#22c55e',
          stopped:  '#f59e0b',
          fault:    '#ef4444',
          offline:  '#6b7280',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
