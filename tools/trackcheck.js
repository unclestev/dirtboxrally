// Validates track layouts: length, min corner radius, clearance between road sections, bounds.
// Usage: node tools/trackcheck.js [--svg out.svg]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'classic', 'js');
const ctx = { window: {}, Math, console, Map, Float32Array, Uint8Array, Object, Array, String, Number, JSON, isFinite };
ctx.window = ctx;
ctx.G = {};
ctx.window.G = ctx.G;
vm.createContext(ctx);
for (const f of ['config.js', 'util.js', 'tracks.js', 'track.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = ctx.G;
const MIN_SEP = 2 * (30 + 5 + 6) + 16; // two road halves + walls + gap
let ok = true;
const svgParts = [];
G.TRACKS.forEach((def, ti) => {
  const t = new G.Track(def, ti);
  let maxK = 0, maxKi = 0;
  for (let i = 0; i < t.n; i++) if (Math.abs(t.kap[i]) > maxK) { maxK = Math.abs(t.kap[i]); maxKi = i; }
  let minSep = Infinity, where = null;
  const arcGap = 260;
  for (let i = 0; i < t.n; i += 2) {
    for (let j = i + 1; j < t.n; j += 2) {
      let arc = Math.abs(i - j) * t.ds;
      arc = Math.min(arc, t.len - arc);
      if (arc < arcGap) continue;
      const d = Math.hypot(t.cx[i] - t.cx[j], t.cy[i] - t.cy[j]);
      if (d < minSep) { minSep = d; where = [i, j]; }
    }
  }
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < t.n; i++) {
    minX = Math.min(minX, t.cx[i]); maxX = Math.max(maxX, t.cx[i]);
    minY = Math.min(minY, t.cy[i]); maxY = Math.max(maxY, t.cy[i]);
  }
  const bad = [];
  if (1 / maxK < 46) bad.push('tight corner r=' + (1 / maxK).toFixed(0) + ' at f=' + (maxKi / t.n).toFixed(3) + ' xy=' + t.cx[maxKi].toFixed(0) + ',' + t.cy[maxKi].toFixed(0));
  if (minSep < MIN_SEP) bad.push('sections too close ' + minSep.toFixed(0) + ' at f=' + (where[0] / t.n).toFixed(3) + '/' + (where[1] / t.n).toFixed(3));
  if (minX < 70 || minY < 70 || maxX > 1030 || maxY > 1030) bad.push('out of bounds ' + [minX, minY, maxX, maxY].map((v) => v.toFixed(0)).join(','));
  if (bad.length) ok = false;
  console.log(`${String(ti + 1).padStart(2)} ${def.name.padEnd(18)} len=${t.len.toFixed(0).padStart(5)} minR=${(1 / maxK).toFixed(0).padStart(4)} minSep=${minSep.toFixed(0).padStart(4)} ${bad.length ? 'FAIL: ' + bad.join('; ') : 'ok'}`);

  // svg thumbnail
  const ox = (ti % 4) * 300, oy = Math.floor(ti / 4) * 330;
  const s = 0.25;
  let d = '';
  for (let i = 0; i <= t.n; i++) { const k = i % t.n; d += (i ? 'L' : 'M') + (ox + 12 + t.cx[k] * s).toFixed(1) + ' ' + (oy + 30 + t.cy[k] * s).toFixed(1); }
  svgParts.push(`<rect x="${ox + 2}" y="${oy + 2}" width="296" height="326" fill="#2a3a2a"/>`);
  svgParts.push(`<path d="${d}" fill="none" stroke="#555" stroke-width="${(2 * 41 * s).toFixed(1)}" stroke-linejoin="round"/>`);
  svgParts.push(`<path d="${d}" fill="none" stroke="#c9a06a" stroke-width="${(2 * 35 * s).toFixed(1)}" stroke-linejoin="round"/>`);
  const st = t.posAt(0, 0);
  svgParts.push(`<circle cx="${ox + 12 + st.x * s}" cy="${oy + 30 + st.y * s}" r="5" fill="#fff"/>`);
  const a = t.posAt(30, 0);
  svgParts.push(`<line x1="${ox + 12 + st.x * s}" y1="${oy + 30 + st.y * s}" x2="${ox + 12 + a.x * s}" y2="${oy + 30 + a.y * s}" stroke="#f00" stroke-width="3"/>`);
  const feat = [];
  (def.ramps || []).forEach(([f]) => feat.push([f, 0, '#f0c830', 6]));
  (def.puddles || []).forEach(([f, dd]) => feat.push([f, dd, '#4f7fbf', 4]));
  (def.oils || []).forEach(([f, dd]) => feat.push([f, dd, '#000', 4]));
  (def.boosts || []).forEach(([f, dd]) => feat.push([f, dd, '#e0501c', 4]));
  (def.items || []).forEach(([f, dd, k]) => feat.push([f, dd, k === 'upgrade' ? '#f0f' : '#fff', 3]));
  if (def.letter) feat.push([def.letter[0], def.letter[1], '#ff0', 5]);
  for (const [f, dd, col, r] of feat) {
    const p = t.posAt(f * t.len, dd);
    svgParts.push(`<circle cx="${(ox + 12 + p.x * s).toFixed(1)}" cy="${(oy + 30 + p.y * s).toFixed(1)}" r="${r}" fill="${col}" stroke="#000" stroke-width="0.5"/>`);
  }
  for (let q = 1; q < 10; q++) {
    const p = t.posAt(q / 10 * t.len, 0);
    svgParts.push(`<text x="${(ox + 12 + p.x * s).toFixed(1)}" y="${(oy + 30 + p.y * s + 3).toFixed(1)}" font-size="9" fill="#000" text-anchor="middle" font-family="monospace">${q}</text>`);
  }
  svgParts.push(`<text x="${ox + 10}" y="${oy + 20}" font-size="14" fill="#fff" font-family="monospace">${ti + 1} ${def.name}</text>`);
});
const svgIdx = process.argv.indexOf('--svg');
if (svgIdx > 0) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="660" viewBox="0 0 1200 660"><rect width="1200" height="660" fill="#111"/>${svgParts.join('')}</svg>`;
  fs.writeFileSync(process.argv[svgIdx + 1], svg);
}
process.exitCode = ok ? 0 : 1;
// ramp straightness check
G.TRACKS.forEach((def, ti) => {
  const t = new G.Track(def, ti);
  (def.ramps || []).forEach(([f]) => {
    const i = Math.floor(f * t.n);
    const k = t.maxCurv((i - 5 + t.n) % t.n, 110);
    if (1 / k < 140) console.log(`   ramp on ${def.name} at ${f} is on a curve (r=${(1 / k).toFixed(0)})`);
  });
});
