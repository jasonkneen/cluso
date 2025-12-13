/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        cluso: {
          blue: '#3b82f6',
          purple: '#9333ea',
          amber: '#f59e0b',
          green: '#22c55e',
        },
      },
    },
  },
  plugins: [],
}
