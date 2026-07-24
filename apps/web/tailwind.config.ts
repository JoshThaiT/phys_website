import type { Config } from 'tailwindcss';

/**
 * Design tokens. A raw hex or a magic pixel value in a component is a review
 * finding — extend this instead.
 *
 * Direction: a clinic, not a spa. The palette is drawn from the room itself —
 * clinical teal from kinesiology tape, a warm balm tone that marks the massage
 * side of the practice, and paper rather than cream so it reads as a treatment
 * note instead of a wellness brochure.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0f1c1e', muted: '#54686b', faint: '#8b9a9c', inverse: '#f4f7f6' },
        paper: { DEFAULT: '#f4f6f5', raised: '#ffffff', sunk: '#e8edec' },
        line: { DEFAULT: '#d6dedd', strong: '#b3c0bf' },
        // physiotherapy — the regulated, clinical half of the practice
        clinic: { DEFAULT: '#0d6f7d', deep: '#0a4c56', wash: '#e0eff1' },
        // remedial massage — the self-regulated half, warmer by design
        balm: { DEFAULT: '#a06a2c', deep: '#7a4f1f', wash: '#f2e9dc' },
        alert: '#a3341f',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
        display: ['clamp(2.5rem, 7vw, 5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        title: ['clamp(1.75rem, 3.5vw, 2.75rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
      },
      spacing: { gutter: '1.25rem', section: 'clamp(3.5rem, 9vw, 7rem)' },
      borderRadius: { card: '0.375rem' },
      maxWidth: { measure: '38rem', shell: '78rem' },
    },
  },
  plugins: [],
} satisfies Config;
