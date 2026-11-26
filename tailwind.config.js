import daisyui from 'daisyui';

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
  plugins: [daisyui],
  daisyui: {
    darkTheme: 'nanocore',
    themes: [{
      nanocore: {
        primary: '#ffb454',
        'primary-content': '#1a1206',
        secondary: '#64d2a4',
        'secondary-content': '#0d0f13',
        accent: '#ffb454',
        'accent-content': '#1a1206',
        neutral: '#1d222b',
        'neutral-content': '#e6e9ef',
        'base-100': '#0d0f13',
        'base-200': '#161a21',
        'base-300': '#2a3140',
        'base-content': '#e6e9ef',
        info: '#64d2a4',
        success: '#64d2a4',
        warning: '#ffb454',
        error: '#ff6b6b',
      },
    }],
  },
};
