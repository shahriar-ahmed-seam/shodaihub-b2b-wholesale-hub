import type { Config } from 'tailwindcss';

/**
 * Design-system tokens transcribed verbatim from design.md → Frontend Design → Design System Tokens.
 * Colors, typography, spacing (4px scale), radius, and shadow are encoded here so every component
 * consumes the same restrained teal/amber B2B palette rather than ad-hoc values.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // deep teal — trust, commerce
          primary: '#0F5C4D',
          'primary-600': '#0C4D40',
          'primary-700': '#093B31',
          'primary-300': '#3E8676',
          'primary-100': '#E4EFEC',
          // amber — CTAs, highlights
          accent: '#F2A516',
          'accent-600': '#D38E0B',
          'accent-100': '#FCEFCF',
          // near-black text
          ink: '#11201C',
          'ink-muted': '#52645E',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F6F8F7',
          sunken: '#EEF2F0',
        },
        line: '#DCE5E1',
        success: '#1B8A5A',
        warning: '#C97A00',
        danger: '#C0392B',
        info: '#2B6CB0',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Sora', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        bengali: ['var(--font-bengali)', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // 4px base scale (4,8,12,16,24,32,48,64)
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(17, 32, 28, 0.06), 0 1px 3px 0 rgba(17, 32, 28, 0.08)',
        md: '0 4px 12px -2px rgba(17, 32, 28, 0.10), 0 2px 6px -2px rgba(17, 32, 28, 0.08)',
        lg: '0 16px 40px -8px rgba(17, 32, 28, 0.18), 0 6px 14px -6px rgba(17, 32, 28, 0.12)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(242, 165, 22, 0.45)' },
          '70%': { boxShadow: '0 0 0 8px rgba(242, 165, 22, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(242, 165, 22, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
