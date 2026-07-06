/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F5F3F0',
          accent: '#FCB900',
          text: '#1A1A1A',
          muted: '#6B7280',
          surface: '#FFFFFF',
          border: '#E5E7EB',
        },
      },
    },
  },
  plugins: [],
};
