import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import babel from "@rollup/plugin-babel";

export default [
  {
    input: "./public/oauth-callback.js",
    output: {
      file: "./public/dist/oauth-callback.js",
      format: "esm",
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript(),
      babel({
        exclude: "node_modules/**",
        presets: ["@babel/preset-react"],
        babelHelpers: "bundled",
      }),
    ],
  },
  {
    input: "./public/hosted-main.js",
    output: {
      file: "./public/dist/hosted-main.js",
      format: "esm",
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript(),
      babel({
        exclude: "node_modules/**",
        presets: ["@babel/preset-react"],
        babelHelpers: "bundled",
      }),
    ],
  },
  {
    input: "./public/hosted-main.js",
    output: {
      file: "./public/dist/hosted-main.min.js",
      format: "esm",
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      terser(),
      typescript(),
      babel({
        exclude: "node_modules/**",
        presets: ["@babel/preset-react"],
        babelHelpers: "bundled",
      }),
    ],
  },
  {
    input: "./public/connect-main.js",
    output: {
      file: "./public/dist/connect-main.min.js",
      format: "esm",
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      terser(),
      typescript(),
      babel({
        exclude: "node_modules/**",
        presets: ["@babel/preset-react"],
        babelHelpers: "bundled",
      }),
    ],
  },
];
