'use strict';
// Track geometry (spline centerline, queries) and the pre-rendered isometric ground.
(function () {
  const U = G.U;
  const WORLD = 1100;          // world is WORLD x WORLD units
  const DS = 4;                // centerline sample spacing
  const HW = 30;               // half width of the road surface
  const CURB = 5;              // curb strip each side (drivable)
  const WALL = 6;              // wall thickness
  const OY = 24;               // iso canvas top headroom

  // Material ids in the top-down index map.
  const M = { GROUND: 0, TRACK: 1, LINE: 2, CURB_A: 3, CURB_B: 4, WALL_A: 5, WALL_B: 6, START_A: 7, START_B: 8,
    PUDDLE: 9, OIL: 10, BOOST: 11, RAMP: 12, RAMP_B: 13, PIT: 14, BOOST_B: 15 };

  function centripetalLoop(pts, steps) {
    const n = pts.length, out = [];
    const d = (a, b) => Math.max(1e-4, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5));
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let k = 0; k < steps; k++) {
        const t = t1 + (t2 - t1) * k / steps;
        const P = [0, 1].map((j) => {
          const A1 = p0[j] * (t1 - t) / (t1 - t0) + p1[j] * (t - t0) / (t1 - t0);
          const A2 = p1[j] * (t2 - t) / (t2 - t1) + p2[j] * (t - t1) / (t2 - t1);
          const A3 = p2[j] * (t3 - t) / (t3 - t2) + p3[j] * (t - t2) / (t3 - t2);
          const B1 = A1 * (t2 - t) / (t2 - t0) + A2 * (t - t0) / (t2 - t0);
          const B2 = A2 * (t3 - t) / (t3 - t1) + A3 * (t - t1) / (t3 - t1);
          return B1 * (t2 - t) / (t2 - t1) + B2 * (t - t1) / (t2 - t1);
        });
        out.push(P);
      }
    }
    return out;
  }

  function resample(poly, ds) {
    const n = poly.length;
    const cum = [0];
    for (let i = 1; i <= n; i++) {
      const a = poly[i - 1], b = poly[i % n];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = cum[n];
    const count = Math.round(total / ds);
    const step = total / count;
    const out = [];
    let seg = 0;
    for (let k = 0; k < count; k++) {
      const s = k * step;
      while (cum[seg + 1] < s) seg++;
      const a = poly[seg], b = poly[(seg + 1) % n];
      const f = (s - cum[seg]) / (cum[seg + 1] - cum[seg]);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    return { pts: out, step };
  }

  class Track {
    constructor(def, index) {
      this.def = def;
      this.index = index || 0;
      this.theme = G.THEMES[def.theme];
      this.hw = HW;
      this.curb = CURB;
      this.wall = WALL;
      this.drivable = HW + CURB;
      this.buildGeometry();
      this.buildFeatures();
    }

    buildGeometry() {
      let dense = centripetalLoop(this.def.pts, 40);
      // relax the curve so no corner is tighter than the trucks can take
      let rs = resample(dense, DS);
      let pts = rs.pts;
      for (let it = 0; it < 60; it++) {
        const m = pts.length, nxt = new Array(m);
        for (let i = 0; i < m; i++) {
          const a = pts[(i - 1 + m) % m], b = pts[i], c = pts[(i + 1) % m];
          nxt[i] = [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4];
        }
        pts = nxt;
      }
      rs = resample(pts, DS);
      const n = rs.pts.length;
      this.n = n;
      this.ds = rs.step;
      this.len = n * rs.step;
      const cx = this.cx = new Float32Array(n), cy = this.cy = new Float32Array(n);
      const tx = this.tx = new Float32Array(n), ty = this.ty = new Float32Array(n);
      const ang = this.ang = new Float32Array(n);
      const kap = this.kap = new Float32Array(n);
      for (let i = 0; i < n; i++) { cx[i] = rs.pts[i][0]; cy[i] = rs.pts[i][1]; }
      for (let i = 0; i < n; i++) {
        const a = (i - 2 + n) % n, b = (i + 2) % n;
        const dx = cx[b] - cx[a], dy = cy[b] - cy[a];
        const l = Math.hypot(dx, dy) || 1;
        tx[i] = dx / l; ty[i] = dy / l;
        ang[i] = Math.atan2(ty[i], tx[i]);
      }
      const raw = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n, b = (i + 1) % n;
        raw[i] = U.wrapAngle(ang[b] - ang[a]) / (2 * this.ds);
      }
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = -3; k <= 3; k++) sum += raw[(i + k + n) % n];
        kap[i] = sum / 7;
      }
      // coarse grid of samples for global nearest lookups
      this.grid = new Map();
      for (let i = 0; i < n; i++) {
        const key = Math.floor(cx[i] / 64) + ',' + Math.floor(cy[i] / 64);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(i);
      }
    }

    // Nearest centerline sample. hint >= 0 searches locally.
    nearest(x, y, hint) {
      const cx = this.cx, cy = this.cy, n = this.n;
      let best = -1, bd = Infinity;
      if (hint >= 0) {
        for (let k = -14; k <= 14; k++) {
          const i = (hint + k + n) % n;
          const dx = x - cx[i], dy = y - cy[i];
          const d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = i; }
        }
        if (bd < (HW + 60) * (HW + 60)) return best;
      }
      const gx = Math.floor(x / 64), gy = Math.floor(y / 64);
      for (let r = 1; r <= 3 && best < 0; r++) {
        for (let ox = -r; ox <= r; ox++) {
          for (let oy = -r; oy <= r; oy++) {
            const list = this.grid.get((gx + ox) + ',' + (gy + oy));
            if (!list) continue;
            for (const i of list) {
              const dx = x - cx[i], dy = y - cy[i];
              const d2 = dx * dx + dy * dy;
              if (d2 < bd) { bd = d2; best = i; }
            }
          }
        }
      }
      if (best < 0) {
        for (let i = 0; i < n; i++) {
          const dx = x - cx[i], dy = y - cy[i];
          const d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = i; }
        }
      }
      return best;
    }

    // Lateral offset of (x,y) from sample i (positive = right of travel).
    lateral(x, y, i) {
      return (x - this.cx[i]) * -this.ty[i] + (y - this.cy[i]) * this.tx[i];
    }

    wrapS(s) {
      s %= this.len;
      return s < 0 ? s + this.len : s;
    }

    // Arc position of (x,y) near sample i, refined by projecting on the tangent.
    sAt(x, y, i) {
      const along = (x - this.cx[i]) * this.tx[i] + (y - this.cy[i]) * this.ty[i];
      return this.wrapS(i * this.ds + along);
    }

    posAt(s, d, out) {
      s = this.wrapS(s);
      const f = s / this.ds;
      const i = Math.floor(f) % this.n, j = (i + 1) % this.n, t = f - Math.floor(f);
      const x = this.cx[i] + (this.cx[j] - this.cx[i]) * t;
      const y = this.cy[i] + (this.cy[j] - this.cy[i]) * t;
      const nx = -(this.ty[i] + (this.ty[j] - this.ty[i]) * t);
      const ny = this.tx[i] + (this.tx[j] - this.tx[i]) * t;
      out = out || {};
      out.x = x + nx * d;
      out.y = y + ny * d;
      out.a = Math.atan2(-nx, ny);
      return out;
    }

    idxAt(s) {
      return Math.floor(this.wrapS(s) / this.ds) % this.n;
    }

    // Max |curvature| over the next `dist` units from sample i.
    maxCurv(i, dist) {
      const cnt = Math.max(1, Math.round(dist / this.ds));
      let m = 0;
      for (let k = 0; k < cnt; k++) {
        const v = Math.abs(this.kap[(i + k) % this.n]);
        if (v > m) m = v;
      }
      return m;
    }

    buildFeatures() {
      const def = this.def, L = this.len;
      const P = (f, d) => this.posAt(f * L, d || 0);
      this.puddles = (def.puddles || []).map(([f, d, r]) => Object.assign(P(f, d), { r: r || 14, s: f * L, d: d || 0, kind: 'puddle' }));
      this.oils = (def.oils || []).map(([f, d, r]) => Object.assign(P(f, d), { r: r || 11, s: f * L, d: d || 0, kind: 'oil' }));
      this.boosts = (def.boosts || []).map(([f, d]) => ({ s0: f * L, s1: f * L + 26, d: d || 0, w: 14 }));
      this.ramps = (def.ramps || []).map(([f, pit]) => ({ s0: f * L, s1: f * L + 22, pit: pit ? { s0: f * L + 30, s1: f * L + 78 } : null }));
      this.hazards = this.puddles.concat(this.oils);
    }

    // Returns feature state for a car at arc position s, lateral d, world (x,y).
    surfaceAt(s, d, x, y) {
      const res = { puddle: false, oil: false, boost: false, ramp: null, pit: false };
      for (const h of this.hazards) {
        const dx = x - h.x, dy = y - h.y;
        if (dx * dx + dy * dy < h.r * h.r) res[h.kind] = true;
      }
      for (const b of this.boosts) {
        if (this.inRange(s, b.s0, b.s1) && Math.abs(d - b.d) < b.w) res.boost = true;
      }
      for (const r of this.ramps) {
        if (this.inRange(s, r.s0, r.s1)) res.ramp = { r, t: this.wrapS(s - r.s0) / (r.s1 - r.s0) };
        if (r.pit && this.inRange(s, r.pit.s0, r.pit.s1)) res.pit = true;
      }
      return res;
    }

    inRange(s, a, b) {
      const L = this.len;
      const rel = ((s - a) % L + L) % L;
      return rel <= b - a;
    }

    pathFor(ctx, offset) {
      ctx.beginPath();
      for (let i = 0; i <= this.n; i++) {
        const k = i % this.n;
        const x = this.cx[k] - this.ty[k] * (offset || 0);
        const y = this.cy[k] + this.tx[k] * (offset || 0);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    // ---------- decoration placement ----------
    placeDecor() {
      const rnd = U.rng(1000 + this.index * 77);
      const theme = this.theme;
      const list = [];
      const total = theme.decor.reduce((a, b) => a + b[1], 0);
      const pick = () => {
        let r = rnd() * total;
        for (const [type, w] of theme.decor) { r -= w; if (r <= 0) return type; }
        return theme.decor[0][0];
      };
      const clear = HW + CURB + WALL + 12;
      const tries = Math.round(900 * (this.def.decor || 1) * (theme.decorDensity || 1));
      for (let t = 0; t < tries; t++) {
        const x = 20 + rnd() * (WORLD - 40), y = 20 + rnd() * (WORLD - 40);
        const i = this.nearest(x, y, -1);
        const dist = Math.hypot(x - this.cx[i], y - this.cy[i]);
        const type = pick();
        const need = clear + (G.DECOR_SIZE[type] || 6);
        if (dist < need) continue;
        if (list.some((o) => Math.abs(o.x - x) < 14 && Math.abs(o.y - y) < 14)) continue;
        list.push({ type, x, y, v: Math.floor(rnd() * 3) });
      }
      // grandstands and flags near the start line
      const st = this.posAt(18, 0);
      const side = HW + CURB + WALL + 18;
      if (theme.stands) {
        for (const sgn of [-1, 1]) {
          for (const off of [-60, 20]) {
            const p = this.posAt(off, sgn * side);
            const a = Math.atan2(st.y - p.y, st.x - p.x);
            list.push({ type: 'stand', x: p.x, y: p.y, v: (off > 0 ? 1 : 0), face: this.ang[this.idxAt(off)] + (sgn > 0 ? Math.PI : 0), a });
          }
        }
      }
      // remove decor overlapping stands
      const stands = list.filter((o) => o.type === 'stand');
      this.decor = list.filter((o) => o.type === 'stand' || !stands.some((s) => Math.hypot(s.x - o.x, s.y - o.y) < 26));
      for (const o of this.decor) {
        o.sx = U.isoX(o.x, o.y) + WORLD;
        o.sy = U.isoY(o.x, o.y) + OY;
      }
      this.decor.sort((a, b) => a.sy - b.sy);
    }

    // ---------- ground rendering ----------
    renderGround() {
      const theme = this.theme;
      const W = WORLD;
      const idx = new Uint8Array(W * W);
      const height = new Uint8Array(W * W);
      const mask = U.makeCanvas(W, W);
      const mctx = mask.getContext('2d', { willReadFrequently: true });
      const self = this;

      function layer(mat, draw, onPixel) {
        mctx.clearRect(0, 0, W, W);
        mctx.save();
        mctx.fillStyle = '#fff';
        mctx.strokeStyle = '#fff';
        mctx.lineJoin = 'round';
        mctx.lineCap = 'round';
        draw(mctx);
        mctx.restore();
        const data = mctx.getImageData(0, 0, W, W).data;
        for (let p = 0, q = 3; p < W * W; p++, q += 4) {
          if (data[q] >= 128) {
            idx[p] = mat;
            if (onPixel) onPixel(p);
          }
        }
      }
      const stroke = (width, dash, offset) => (c) => {
        if (dash) c.setLineDash(dash);
        c.lineWidth = width;
        self.pathFor(c, offset || 0);
        c.stroke();
      };
      const wallH = theme.wallH || 4;
      // walls (with outer half removed so the wall is one band)
      layer(M.WALL_A, stroke((HW + CURB + WALL) * 2), (p) => { height[p] = wallH; });
      layer(M.WALL_B, stroke((HW + CURB + WALL) * 2, theme.wallDash || [4, 10]), (p) => { height[p] = wallH; });
      layer(M.CURB_A, stroke((HW + CURB) * 2), (p) => { height[p] = 0; });
      layer(M.CURB_B, stroke((HW + CURB) * 2, [8, 8]));
      layer(M.TRACK, stroke(HW * 2));
      // worn lines / ruts
      if (theme.lineStyle === 'ruts') {
        for (const o of [-14, -8, 8, 14]) layer(M.LINE, stroke(2, null, o));
      } else if (theme.lineStyle === 'center') {
        layer(M.LINE, stroke(2, [14, 14], 0));
      } else if (theme.lineStyle === 'groove') {
        layer(M.LINE, stroke(16, null, 0));
      }

      // start line checkers
      layer(M.START_A, (c) => {
        const a = this.posAt(0, -HW - CURB), b = this.posAt(0, HW + CURB), a2 = this.posAt(8, -HW - CURB), b2 = this.posAt(8, HW + CURB);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(b2.x, b2.y); c.lineTo(a2.x, a2.y); c.closePath(); c.fill();
      });
      layer(M.START_B, (c) => {
        for (let row = 0; row < 2; row++) {
          for (let k = -HW - CURB; k < HW + CURB; k += 4) {
            if (((k + HW + CURB) / 4 + row) % 2 !== 0) continue;
            const s0 = row * 4, s1 = s0 + 4;
            const p1 = this.posAt(s0, k), p2 = this.posAt(s0, k + 4), p3 = this.posAt(s1, k + 4), p4 = this.posAt(s1, k);
            c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.lineTo(p3.x, p3.y); c.lineTo(p4.x, p4.y); c.closePath(); c.fill();
          }
        }
      });

      const blob = (c, h, rnd) => {
        c.beginPath();
        c.arc(h.x, h.y, h.r * 0.85, 0, U.TAU);
        c.fill();
        for (let k = 0; k < 4; k++) {
          const a = rnd() * U.TAU, r = h.r * (0.35 + rnd() * 0.3);
          c.beginPath();
          c.arc(h.x + Math.cos(a) * h.r * 0.45, h.y + Math.sin(a) * h.r * 0.45, r, 0, U.TAU);
          c.fill();
        }
      };
      const rnd = U.rng(55 + this.index);
      if (this.puddles.length) layer(M.PUDDLE, (c) => this.puddles.forEach((h) => blob(c, h, rnd)));
      if (this.oils.length) layer(M.OIL, (c) => this.oils.forEach((h) => blob(c, h, rnd)));

      const quad = (c, s0, s1, d0, d1) => {
        const p1 = this.posAt(s0, d0), p2 = this.posAt(s0, d1), p3 = this.posAt(s1, d1), p4 = this.posAt(s1, d0);
        c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.lineTo(p3.x, p3.y); c.lineTo(p4.x, p4.y); c.closePath(); c.fill();
      };
      if (this.boosts.length) {
        layer(M.BOOST, (c) => this.boosts.forEach((b) => quad(c, b.s0, b.s1, b.d - b.w, b.d + b.w)));
        layer(M.BOOST_B, (c) => this.boosts.forEach((b) => {
          for (let k = 0; k < 3; k++) {
            const s = b.s0 + 3 + k * 8;
            const tip = this.posAt(s + 6, b.d), l = this.posAt(s, b.d - b.w + 3), r = this.posAt(s, b.d + b.w - 3);
            const l2 = this.posAt(s + 3, b.d - b.w + 3), r2 = this.posAt(s + 3, b.d + b.w - 3), tip2 = this.posAt(s + 9, b.d);
            c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(tip.x, tip.y); c.lineTo(r.x, r.y); c.lineTo(r2.x, r2.y); c.lineTo(tip2.x, tip2.y); c.lineTo(l2.x, l2.y); c.closePath(); c.fill();
          }
        }));
      }
      for (const r of this.ramps) {
        if (r.pit) layer(M.PIT, (c) => quad(c, r.pit.s0, r.pit.s1, -HW - CURB, HW + CURB));
        const s0 = r.s0, len = r.s1 - r.s0;
        const tx0 = this.tx[this.idxAt(s0)], ty0 = this.ty[this.idxAt(s0)];
        const c0 = this.posAt(s0, 0);
        const rampH = (p) => {
          const px = p % W, py = (p / W) | 0;
          const t = U.clamp(((px - c0.x) * tx0 + (py - c0.y) * ty0) / len, 0, 1);
          height[p] = 1 + Math.floor(t * 6);
        };
        layer(M.RAMP, (c) => quad(c, s0, r.s1, -HW - CURB + 2, HW + CURB - 2), rampH);
        layer(M.RAMP_B, (c) => { for (let k = 0; k < 3; k++) quad(c, s0 + 3 + k * 7, s0 + 5 + k * 7, -HW - CURB + 2, HW + CURB - 2); }, rampH);
      }

      // Colors
      const pal = theme.colors;
      const toU32 = (rgb) => (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
      const mats = {};
      for (const key in M) {
        const list = (pal[key] || pal.GROUND).map((h) => U.hex(h));
        mats[M[key]] = list;
      }
      const matU32 = {}, sideU32 = {}, side2U32 = {};
      for (const k in mats) {
        matU32[k] = mats[k].map(toU32);
        sideU32[k] = toU32(U.mul(mats[k][0], 0.68));
        side2U32[k] = toU32(U.mul(mats[k][0], 0.5));
      }
      const altU32 = (pal.GROUND_ALT || pal.GROUND).map((h) => toU32(U.hex(h)));
      const detU32 = (pal.DETAIL || []).map((h) => toU32(U.hex(h)));
      const outline = toU32(U.hex(pal.WALL_EDGE || '#1c1420'));

      // coarse patches for ground variation
      const CG = 4, CW = Math.ceil(W / CG) + 2;
      const patch = new Float32Array(CW * CW);
      for (let y = 0; y < CW; y++) for (let x = 0; x < CW; x++) {
        patch[y * CW + x] = U.noise(x * CG / 46 + this.index * 13.1, y * CG / 46) * 0.7 + U.noise(x * CG / 13, y * CG / 13 + 5) * 0.3;
      }

      const IW = W * 2, IH = W + OY + 8;
      const canvas = U.makeCanvas(IW, IH);
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(IW, IH);
      const buf = new Uint32Array(img.data.buffer);
      const patchT = theme.patch === undefined ? 0.58 : theme.patch;
      const detailP = theme.detailRate || 0;

      for (let py = 0; py < IH; py++) {
        const wy0 = py - OY + 0.5;
        for (let px = 0; px < IW; px++) {
          const sx = px - W + 0.5;
          const wx = wy0 + sx * 0.5, wyy = wy0 - sx * 0.5;
          const xi = Math.floor(wx), yi = Math.floor(wyy);
          const h = U.hash2(xi, yi);
          let mat = 0, ht = 0;
          if (xi >= 0 && yi >= 0 && xi < W && yi < W) {
            const p = yi * W + xi;
            mat = idx[p];
            ht = height[p];
          }
          let col;
          if (mat === 0) {
            const pv = patch[((yi >> 2) + 1) * CW + (xi >> 2) + 1] || 0.5;
            const dither = (h - 0.5) * 0.08;
            if (pv + dither > patchT) col = altU32[(h * altU32.length) | 0];
            else col = matU32[0][(h * matU32[0].length) | 0];
            if (detailP && detU32.length && h > 1 - detailP) col = detU32[((h * 9973) | 0) % detU32.length];
          } else {
            const shades = matU32[mat];
            col = shades[(h * shades.length) | 0];
          }
          if (ht > 0) {
            // extrude: side column then top face
            const side = (mat === M.RAMP || mat === M.RAMP_B) ? sideU32[M.RAMP] : sideU32[mat];
            const side2 = (mat === M.RAMP || mat === M.RAMP_B) ? side2U32[M.RAMP] : side2U32[mat];
            for (let k = 0; k < ht; k++) {
              const yy = py - k;
              if (yy >= 0) buf[yy * IW + px] = k === 0 ? side2 : side;
            }
            if (py - ht >= 0) buf[(py - ht) * IW + px] = col;
          } else {
            buf[py * IW + px] = col;
          }
        }
      }
      // dark rim along the top edge of walls for definition
      if (theme.wallRim !== false) {
        for (let py = 1; py < IH; py++) {
          for (let px = 0; px < IW; px++) {
            const sx = px - W + 0.5, wy0 = py - OY + 0.5;
            const xi = Math.floor(wy0 + sx * 0.5), yi = Math.floor(wy0 - sx * 0.5);
            if (xi < 0 || yi < 0 || xi >= W || yi >= W) continue;
            const p = yi * W + xi;
            if (height[p] !== wallH || idx[p] < M.WALL_A || idx[p] > M.WALL_B) continue;
            // a wall pixel whose neighbour toward the viewer-top is not wall: outline its top edge
            const xb = Math.floor(wy0 - 1 + sx * 0.5), yb = Math.floor(wy0 - 1 - sx * 0.5);
            if (xb < 0 || yb < 0 || xb >= W || yb >= W) continue;
            const pb = yb * W + xb;
            if (height[pb] === 0 && py - wallH - 1 >= 0) buf[(py - wallH - 1) * IW + px] = outline;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      this.ground = canvas;
      this.groundBackup = U.makeCanvas(IW, IH);
      this.groundBackup.getContext('2d').drawImage(canvas, 0, 0);
      this.gctx = ctx;
      this.IW = IW;
      this.IH = IH;
    }

    resetGround() {
      if (!this.ground) return;
      this.gctx.clearRect(0, 0, this.IW, this.IH);
      this.gctx.drawImage(this.groundBackup, 0, 0);
    }

    // Minimap: iso-projected centerline fitted to a box.
    buildMinimap(w, h) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < this.n; i++) {
        const x = U.isoX(this.cx[i], this.cy[i]), y = U.isoY(this.cx[i], this.cy[i]);
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      const sc = Math.min((w - 6) / (maxX - minX), (h - 6) / (maxY - minY));
      const ox = (w - (maxX - minX) * sc) / 2, oy = (h - (maxY - minY) * sc) / 2;
      const map = (x, y) => [ox + (U.isoX(x, y) - minX) * sc, oy + (U.isoY(x, y) - minY) * sc];
      const c = U.makeCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1;
      for (let i = 0; i < this.n; i += 1) {
        const [x, y] = map(this.cx[i], this.cy[i]);
        ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
        ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
      }
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#d8d0b8';
      ctx.fillRect(0, 0, w, h);
      this.minimap = { canvas: c, map, w, h };
      return this.minimap;
    }
  }

  Track.WORLD = WORLD;
  Track.OY = OY;
  Track.M = M;
  G.Track = Track;
})();
