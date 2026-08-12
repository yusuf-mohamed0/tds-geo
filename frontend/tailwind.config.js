/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F4FBF8',
          accent: '#22E6A8',
          text: '#071013',
          muted: '#6D7E86',
          surface: '#FFFFFF',
          border: '#D9E8E2',
          navy: '#0B1F3A',
          sky: '#3BB5FF',
          graphite: '#25343A',
          peach: '#C7B8FF',
          amber: '#B7FF4A',
        },
      },
      fontFamily: {
        // Clean sans stacks. Both fall back to Polaris' system font so any
        // custom Tailwind components stay visually consistent inside Shopify.
        heading: ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};
