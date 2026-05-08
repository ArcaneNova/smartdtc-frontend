/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a56db',
          foreground: '#ffffff',
        },
        dtc: {
          blue:   '#1a56db',
          orange: '#ff6b00',
          green:  '#16a34a',
          red:    '#dc2626',
        },
      },
    },
  },
  plugins: [],
};
