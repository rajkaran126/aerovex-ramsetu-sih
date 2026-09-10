/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aerospace dark color palette
        aerospace: {
          bg: '#050a0f',
          panel: '#0a1520',
          border: '#1a2f4a',
          accent: '#00d4ff',
          accent2: '#00ff88',
          warning: '#ffaa00',
          danger: '#ff3355',
          success: '#00ff88',
          muted: '#4a6080',
          text: '#c8d8e8',
          textDim: '#6080a0',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00d4ff44' },
          '100%': { boxShadow: '0 0 20px #00d4ff88, 0 0 40px #00d4ff22' },
        },
        scan: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
      },
    },
  },
  plugins: [],
}
