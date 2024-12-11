import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import babel from "@rollup/plugin-babel";
import alias from "@rollup/plugin-alias";

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

const aliases = {
  hosted: {
    entries: {
      '@routing-observable': `${import.meta.dirname}/public/shared/route-pushstate`,
    },
  },
  connect: {
    entries: {
      "@routing-observable": `${import.meta.dirname}/public/jira/history/observable`,
    },
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
      alias(aliases.hosted),
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
    plugins: [nodeResolve(), commonjs(), terser(), , alias(aliases.hosted), typescript(), babel(babelProd)],
    ...warn,
  },
  {
    input: "./public/connect-main.js",
    output: {
      file: "./public/dist/connect-main.min.js",
      format: "esm",
    },
    plugins: [nodeResolve(), commonjs(), terser(), alias(aliases.connect), typescript(), babel(babelProd)],
    ...warn,
  },
];
