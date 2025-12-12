/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './types/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input, var(--border)) / <alpha-value>)',
        ring: 'rgb(var(--ring, var(--primary)) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary, var(--muted)) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground, var(--foreground)) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive, 239 68 68) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground, 255 255 255) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent, var(--muted)) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground, var(--foreground)) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover, var(--background)) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground, var(--foreground)) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card, var(--background)) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground, var(--foreground)) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius, 0.5rem)',
        md: 'calc(var(--radius, 0.5rem) - 2px)',
        sm: 'calc(var(--radius, 0.5rem) - 4px)',
      },
    },
  },
  plugins: [],
}

