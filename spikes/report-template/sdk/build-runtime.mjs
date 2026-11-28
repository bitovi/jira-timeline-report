// Builds the host-injected runtime (what the Forge host would ship per SDK major version).
import { build } from 'esbuild';

await build({
  entryPoints: ['sdk/runtime-host.ts'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2022',
  outfile: 'dist-sdk/report-sdk-runtime.js',
  // src/shared/feature-flag.js reads localStorage at import time, which throws in a sandbox without
  // allow-same-origin. Until that is fixed in src/, give the runtime an in-memory stand-in.
  banner: {
    js: `(()=>{try{localStorage}catch{const m=new Map();Object.defineProperty(globalThis,"localStorage",{value:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}})}})();`,
  },
  logLevel: 'info',
});
