import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'out');
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'));

const raw = (f) => statSync(resolve(OUT, f)).size;
const gz = (f) => gzipSync(readFileSync(resolve(OUT, f))).length; // zlib default level (6)
const KB = (n) => Math.round(n / 1024);

// ---- Build chunk graph ---------------------------------------------------
const chunks = manifest; // keyed by fileName
const entries = Object.values(chunks).filter((c) => c.isEntry);

// edges = static imports + dynamic imports (both are "this report's code")
const edges = (c) => [...(c.imports || []), ...(c.dynamicImports || [])];

// For each entry, compute the set of chunks reachable (transitively).
// reachedBy[chunkFile] = Set of entry names that can reach it (incl. the entry itself).
const reachedBy = {};
for (const f of Object.keys(chunks)) reachedBy[f] = new Set();

for (const entry of entries) {
  const seen = new Set();
  const stack = [entry.fileName];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const c = chunks[f];
    if (!c) continue;
    for (const dep of edges(c)) stack.push(dep);
  }
  for (const f of seen) reachedBy[f].add(entry.name);
}

// ---- CSS assets: reach = union of reach of chunks importing them ----------
const cssReach = {};
const cssImportedByCount = {};
for (const c of Object.values(chunks)) {
  for (const css of c.importedCss || []) {
    cssReach[css] = cssReach[css] || new Set();
    for (const e of reachedBy[c.fileName]) cssReach[css].add(e);
    cssImportedByCount[css] = (cssImportedByCount[css] || 0) + 1;
  }
}

// ---- Classify every chunk & css: unique-to-one-report vs shared ----------
const SHARED = { js: [], css: [] };
const perReport = {}; // name -> {js:[], css:[]}
for (const e of entries) perReport[e.name] = { js: [], css: [] };

for (const [f, set] of Object.entries(reachedBy)) {
  if (set.size >= 2) SHARED.js.push(f);
  else if (set.size === 1) perReport[[...set][0]].js.push(f);
  // size 0 => unreachable orphan (shouldn't happen); ignore
}
for (const [css, set] of Object.entries(cssReach)) {
  if (set.size >= 2) SHARED.css.push(css);
  else if (set.size === 1) perReport[[...set][0]].css.push(css);
}

// ---- Dependency fingerprinting (label heavy chunks) ----------------------
const fingerprint = (f) => {
  const src = readFileSync(resolve(OUT, f), 'utf8');
  const hits = [];
  const test = (label, re) => { if (re.test(src)) hits.push(label); };
  test('recharts', /recharts|Recharts|generateCategoricalChart/);
  test('d3', /d3-(scale|shape|array|time|interpolate|path)|victory-vendor/);
  test('jstat', /jStat|jstat/);
  test('@atlaskit', /@atlaskit|atlaskit|ak-|@compiled\/react/);
  test('react-dom', /react-dom|scheduler\.production|__SECRET_INTERNALS/);
  test('react-query', /QueryClient|useQuery|@tanstack/);
  test('react-hook-form', /react-hook-form|useForm|Controller/);
  return hits;
};

// size a chunk with fingerprint (only worthwhile for larger chunks)
const chunkInfo = (f) => ({
  file: f,
  rawKB: KB(raw(f)),
  gzKB: KB(gz(f)),
  raw: raw(f),
  gzip: gz(f),
  libs: raw(f) > 8 * 1024 ? fingerprint(f) : [],
});

// ---- Totals --------------------------------------------------------------
function sumFiles(files, kind) {
  let r = 0, g = 0;
  for (const f of files) { r += raw(f); g += gz(f); }
  return { raw: r, gzip: g, rawKB: KB(r), gzKB: KB(g) };
}

console.log('# PER-REPORT DEFERRED CODE (unique = entry chunk + chunks reachable ONLY from this report)\n');
const rows = [];
for (const e of entries) {
  const { js, css } = perReport[e.name];
  const jsTotal = sumFiles(js);
  const cssTotal = sumFiles(css);
  const rawTot = jsTotal.raw + cssTotal.raw;
  const gzTot = jsTotal.gzip + cssTotal.gzip;
  // heaviest unique deps: label each unique js chunk
  const infos = js.map(chunkInfo).sort((a, b) => b.raw - a.raw);
  rows.push({ name: e.name, rawKB: KB(rawTot), gzKB: KB(gzTot), cssKB: KB(cssTotal.raw), infos });
  console.log(`## ${e.name}: raw ${KB(rawTot)}KB / gzip ${KB(gzTot)}KB  (css raw ${KB(cssTotal.raw)}KB, ${js.length} unique js chunks)`);
  for (const i of infos) {
    console.log(`   ${i.rawKB.toString().padStart(4)}KB raw / ${i.gzKB.toString().padStart(3)}KB gz  ${i.file}  [${i.libs.join(', ')}]`);
  }
  console.log('');
}

console.log('\n# SHARED BASELINE (chunks reachable from >=2 reports)\n');
const sharedJsInfos = SHARED.js.map(chunkInfo).sort((a, b) => b.raw - a.raw);
const sharedJsTotal = sumFiles(SHARED.js);
const sharedCssTotal = sumFiles(SHARED.css);
for (const i of sharedJsInfos) {
  console.log(`   ${i.rawKB.toString().padStart(4)}KB raw / ${i.gzKB.toString().padStart(3)}KB gz  ${i.file}  [${i.libs.join(', ')}]`);
}
for (const css of SHARED.css) console.log(`   ${KB(raw(css))}KB raw / ${KB(gz(css))}KB gz  ${css}  [CSS, importedBy ${cssImportedByCount[css]}]`);
console.log(`\n  SHARED TOTAL: raw ${KB(sharedJsTotal.raw + sharedCssTotal.raw)}KB / gzip ${KB(sharedJsTotal.gzip + sharedCssTotal.gzip)}KB`);
console.log(`   (js raw ${sharedJsTotal.rawKB}KB/gz ${sharedJsTotal.gzKB}KB, css raw ${sharedCssTotal.rawKB}KB/gz ${sharedCssTotal.gzKB}KB)`);

// ---- Grand totals --------------------------------------------------------
const allReportsRaw = rows.reduce((s, r) => s + 0, 0);
let allDeferredRaw = 0, allDeferredGz = 0;
for (const e of entries) {
  const t = sumFiles(perReport[e.name].js);
  const tc = sumFiles(perReport[e.name].css);
  allDeferredRaw += t.raw + tc.raw;
  allDeferredGz += t.gzip + tc.gzip;
}
const sharedRawAll = sharedJsTotal.raw + sharedCssTotal.raw;
const sharedGzAll = sharedJsTotal.gzip + sharedCssTotal.gzip;

console.log('\n# GRAND TOTALS');
console.log(`  Baseline only (initial load if reports are lazy): raw ${KB(sharedRawAll)}KB / gzip ${KB(sharedGzAll)}KB`);
console.log(`  All reports deferred (sum of unique): raw ${KB(allDeferredRaw)}KB / gzip ${KB(allDeferredGz)}KB`);
console.log(`  Total if ALL eager (baseline + every report): raw ${KB(sharedRawAll + allDeferredRaw)}KB / gzip ${KB(sharedGzAll + allDeferredGz)}KB`);

// ---- Sanity: every js chunk classified once ------------------------------
const totalJsFiles = Object.keys(chunks).length;
const classified = SHARED.js.length + Object.values(perReport).reduce((s, r) => s + r.js.length, 0);
console.log(`\n# SANITY: ${classified}/${totalJsFiles} js chunks classified (should be equal)`);
// list any unreachable
for (const [f, set] of Object.entries(reachedBy)) if (set.size === 0) console.log('  ORPHAN (unreachable):', f, KB(raw(f)) + 'KB');
