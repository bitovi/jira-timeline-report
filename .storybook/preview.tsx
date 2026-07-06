import type { Preview } from '@storybook/react-vite';

// Import the pre-compiled Tailwind + status-color CSS so `color-text-and-bg-*` and utility
// classes render in stories. This is the SAME stylesheet the running app loads (both
// index.html and dev.html link `/dist/production.css`); the app never processes Tailwind
// source through Vite, and the repo's `postcss.config` file has a non-standard name that
// Vite/PostCSS won't auto-detect — so importing the `@tailwind` source here would leave
// utilities like `absolute`/`flex` uncompiled. Rebuild via `npm run build:css` if styles
// look stale.
import '../dist/production.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
