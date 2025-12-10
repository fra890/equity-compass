/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        slate: {
          850: '#151f32',
          900: '#0f172a',
        },
        tidemark: {
          blue: '#00558C', // PMS 7691
          navy: '#1B365D', // PMS 534
          gray: '#333333', // Black 80%
        }
      },
      screens: {
        'print': {'raw': 'print'},
      }
    },
  },
  plugins: [],
}