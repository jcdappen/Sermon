/** @type {import('tailwindcss').Config} */
// Farben, Schriften und Formen nach dem Konkordia-Styleguide.
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    // Styleguide: geometrische Formen mit klaren Kanten – nur Kreise bleiben rund.
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      full: '9999px',
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: '#bb2232', // Logo-Rot
          dark: '#70141e',    // Dunkelrot
          light: '#ebbdc2',   // Hellrosa
        },
        kk: {
          'gold-dark': '#8e7629',
          gold: '#edc544',
          'gold-light': '#f4dc8f',
          creme: '#faeec7',
          olive: '#677d46',
          green: '#abd075',
          'green-light': '#cde3ac',
          mint: '#e6f1d6',
          'teal-dark': '#147067',
          teal: '#22bbac',
          'teal-light': '#7ad6cd',
          aqua: '#bdebe6',
          rosa: '#d67a84',
          'grey-dark': '#4d4d4d',
          grey: '#999999',
          'grey-light': '#e6e6e6',
        },
      },
      fontFamily: {
        sans: ['Gothic720', 'system-ui', 'sans-serif'],
        heading: ['Grotesque', 'Gothic720', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
