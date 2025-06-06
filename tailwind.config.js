module.exports = {
  content: ['./src/**/*.{js,tsx,ts}', './**.html'],
  safelist: ['pl-2', 'pl-4', 'pl-6', 'pl-8', 'border-neutral-301'],
  theme: {
    fontFamily: {
      sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      bitovipoppins:
        'Poppins, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    },
    extend: {
      borderRadius: {
        jirasm: '3px',
      },
      blur: {
        xs: '2px',
      },
      fontSize: {
        xxs: ['0.5rem', '0.75rem'],
      },
      colors: {
        blue: {
          500: '#0747A6',
          400: '#0052CC', // primary color
          300: '#0065FF', // this is what we use
          200: '#4C9AFF',
          101: '#E9F2FF',
          // 100: '#4C9AFF',
          75: '#B3D4FF', // highlight effect
          50: '#cadefc',
        },
        green: {
          500: '#006644',
          400: '#00875A',
          300: '#36B37E',
          200: '#57D9A3',
          // 100: '#79F2C0',
          75: '#ABF5D1',
        },
        red: {
          500: '#BF2600',
        },
        yellow: {
          500: '#FF8B00',
          300: '#FFAB00',
        },
        neutral: {
          801: '#44546F',
          800: '#172B4D',
          600: '#344563',
          300: '#5E6C84',
          200: '#6B778C',
          100: '#7A869A',
          80: '#091E4224', // was "#97A0AF" ... now is 14% alpha of Nuetral300
          50: '#C1C7D0',
          40: '#DFE1E6', // secondary button color
          41: '#DCDFE4', // accent.gray.subtler
          30: '#EBECF0',
          20: '#F1F2F4', // stripe color
          10: '#FAFBFC', //
          301: '#091E4224',
          201: '#091E420F', // NEW nuetral 6% opacity
        },
        orange: {
          400: '#F5532D', // Bitovi color
        },
        slate: {
          400: '#505F79',
          300: '#44546F',
        },
      },
      spacing: {
        112: '28rem',
        128: '32rem',
      },
      width: {
        128: '28rem',
      },
    },
  },
  plugins: [require('@tailwindcss/container-queries')],
};
