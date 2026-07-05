/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#171414',
          accent: '#FCB900',
          text: '#FCF6F2',
          muted: '#6B7280',
          surface: '#1F1B1B',
          border: '#2D2A2A',
        },
      },
    },
  },
  plugins: [],
};
