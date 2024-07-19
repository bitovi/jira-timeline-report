import { defineConfig } from 'vite';
import terser from '@rollup/plugin-terser';
import babel from '@rollup/plugin-babel';

export default defineConfig({
  esbuild: {
    minify: false
  },
  build: {
    rollupOptions: {
      input: 'public/dist/main.js',
      output: [
        {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name]-[hash][extname]'
        },
        {
          format: 'es',
          entryFileNames: '[name].min.js',
          chunkFileNames: '[name]-[hash].min.js',
          assetFileNames: '[name]-[hash].min[extname]',
          plugins: [terser()]
        }
      ],
      plugins: [
        babel({
          babelHelpers: 'bundled',
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
          exclude: 'node_modules/**'
        })
      ]
    },
    target: 'esnext'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  }
});
