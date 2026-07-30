/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#EEEEEE',
          accent: '#F2B01C',
          text: '#1A1A1A',
          muted: '#6B7280',
          surface: '#FFFFFF',
          border: '#E5E7EB',
        },
      },
      fontFamily: {
        heading: ['Unbounded', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
