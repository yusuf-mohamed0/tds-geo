/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

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
        // Clean sans stacks. Both fall back to Polaris' system font so any
        // custom Tailwind components stay visually consistent inside Shopify.
        heading: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};