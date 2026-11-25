/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d0f13',
        panel: '#161a21',
        'panel-2': '#1d222b',
        line: '#2a3140',
        text: '#e6e9ef',
        muted: '#8d98aa',
        accent: '#ffb454',
        'accent-2': '#64d2a4',
        danger: '#ff6b6b',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
