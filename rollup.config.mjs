import terser from '@rollup/plugin-terser';
import del from 'rollup-plugin-delete';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';


const minify = process.env.BUILD_MINIFY !== "NO" ? [terser()] : [];

// rollup.config.mjs
export default {
	input: './public/main.js',
	output: {
		dir: './public/dist',
		format: 'es',
        plugins: minify
	},
    plugins: [
        nodeResolve(),
        commonjs(),
        del({ targets: './public/dist/*'})
    ]
};