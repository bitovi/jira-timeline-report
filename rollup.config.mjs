import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import babel from "@rollup/plugin-babel";

const babelProd = {
  exclude: "node_modules/**",
  plugins: ["@babel/plugin-transform-react-jsx"],
  babelHelpers: "bundled",
};

const warn = {
  onwarn(warning, warn) {
    // ignores any 'use client' directive warnings
    if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
      return;
    }

    warn(warning);
  },
};

export default [
  {
    input: "./public/oauth-callback.js",
    output: {
      file: "./public/dist/oauth-callback.js",
      format: "esm",
    },
    plugins: [nodeResolve(), commonjs(), typescript(), babel(babelProd)],
    ...warn,
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
        plugins: ["@babel/plugin-transform-react-jsx-development"],
        babelHelpers: "bundled",
      }),
    ],
    ...warn,
  },
  {
    input: "./public/hosted-main.js",
    output: {
      file: "./public/dist/hosted-main.min.js",
      format: "esm",
    },
    plugins: [nodeResolve(), commonjs(), terser(), typescript(), babel(babelProd)],
    ...warn,
  },
  {
    input: "./public/connect-main.js",
    output: {
      file: "./public/dist/connect-main.min.js",
      format: "esm",
    },
    plugins: [nodeResolve(), commonjs(), terser(), typescript(), babel(babelProd)],
    ...warn,
  },
];
