import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

export default [
  {
    input: './public/oauth-callback.js',
    output: {
      file: "./public/dist/oauth-callback.js",
      format: 'esm'
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript()
    ]
  },
    {
      input: './public/hosted-main.js',
      output: {
        file: './public/dist/hosted-main.js',
		    format: 'esm'
      },
      plugins: [
        nodeResolve(),
        commonjs(),
        typescript()
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
        terser(),
        typescript()
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
        terser(),
        typescript()
      ]
    }
  ];
