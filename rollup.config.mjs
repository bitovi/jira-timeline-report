import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
    {
      input: './public/hosted-main.js',
      output: {
        file: './public/dist/hosted-main.js',
		    format: 'esm'
      },
      plugins: [
        nodeResolve(),
        commonjs()
      ]
    },
    {
      input: './public/hosted-main.js',
      output: {
        file: './public/dist/hosted-main.min.js',
		    format: 'esm'
      },
      plugins: [
        nodeResolve(),
        commonjs(),
        terser()
      ]
    },
    {
      input: './public/connect-main.js',
      output: {
        file: './public/dist/connect-main.min.js',
		    format: 'esm'
      },
      plugins: [
        nodeResolve(),
        commonjs(),
        terser()
      ]
    }
  ];
