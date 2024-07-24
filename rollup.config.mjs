import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
    {
      input: './public/main.js',
      output: {
        file: './public/dist/main.js',
		format: 'esm'
      },
      plugins: [
        nodeResolve(),
        commonjs()
      ]
    },
    {
      input: './public/main.js',
      output: {
        file: './public/dist/main.min.js',
		format: 'esm'
      },
      plugins: [
        nodeResolve(),
        commonjs(),
        terser()
      ]
    }
  ];
