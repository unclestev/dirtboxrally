'use strict';
// Truck physics and the AI driver.
(function () {
  const U = G.U;
  const GRAV = 300;

  class Car {
    constructor(race, opts) {
      this.race = race;
      this.track = race.track;
      this.scheme = opts.scheme;
      this.name = opts.name;
      this.isPlayer = !!opts.isPlayer;
      this.aiDriven = !!opts.ai;
      this.level = opts.level || 0;
      this.skill = opts.skill || 1;
      this.upgrades = opts.upgrades || { engine: 0, tires: 0, turbo: 0 };
      this.ammo = opts.ammo || { missile: 0, bomb: 0, nitro: 0 };
      this.frames = G.SPR.truckFrames(this.scheme);
      this.ai = new AI(this, opts.lane || 0, opts.aggression || 0.2);
      this.rubber = 1;
      this.computeStats();
    }

    computeStats() {
      const T = G.CONFIG.TRUCK;
      if (this.isPlayer) {
        const u = this.upgrades;
        this.stats = {
          vmax: T.vmax + T.vmaxPerEngine * u.engine,
          drag: T.drag + T.dragPerTurbo * u.turbo,
          grip: T.grip + T.gripPerTires * u.tires,
          turn: T.turn + T.turnPerTires * u.tires,
        };
      } else {
        const L = this.level;
        this.stats = {
          vmax: Math.min(245, (154 + L * 5.4) * this.skill),
          drag: T.drag + Math.min(0.8, L * 0.05),
          grip: T.grip + 1 + Math.min(8, L * 0.5),
          turn: T.turn + Math.min(0.6, L * 0.04),
        };
      }
    }

    place(s, d) {
      const T = this.track;
      const p = T.posAt(s, d);
      this.x = p.x; this.y = p.y; this.z = 0;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.idx = T.nearest(this.x, this.y, -1);
      this.h = T.ang[this.idx];
      this.s = T.sAt(this.x, this.y, this.idx);
      this.d = T.lateral(this.x, this.y, this.idx);
      this.lap = this.s > T.len * 0.5 ? -1 : 0;
      this.steer = 0;
      this.spinT = 0; this.spinDir = 1; this.invulnT = 0; this.boostT = 0; this.slipT = 0;
      this.onRamp = false; this.inPit = false;
      this.finished = false; this.finishTime = 0; this.place = 0;
      this.wrongT = 0; this.wallT = 0; this.stuckT = 0;
      this.fireCd = 0; this.bombCd = 0;
      this.lastLapStart = 0; this.bestLap = Infinity;
      this.vF = 0; this.vL = 0;
      this.surf = {};
      this.skidTick = 0;
      this.splashT = 0;
    }

    get progress() {
      return this.lap * this.track.len + this.s;
    }

    get speed() {
      return Math.hypot(this.vx, this.vy);
    }

    hit(kind, by) {
      if (this.invulnT > 0) return false;
      this.spinT = kind === 'lava' ? 0.9 : 1.15;
      this.spinDir = Math.random() < 0.5 ? -1 : 1;
      this.vz = kind === 'lava' ? 70 : 125;
      this.z = Math.max(this.z, 1);
      this.vx *= 0.25; this.vy *= 0.25;
      this.invulnT = 2.3;
      this.boostT = 0;
      return true;
    }

    // inp: {steer, gas, brake}
    step(dt, inp) {
      const T = this.track, st = this.stats, race = this.race;
      this.spinT -= dt; this.invulnT -= dt; this.boostT -= dt; this.slipT -= dt;
      this.fireCd -= dt; this.bombCd -= dt; this.wallT -= dt; this.splashT -= dt;
      const stunned = this.spinT > 0;
      const air = this.z > 0.6 && !this.onRamp;
      const surf = this.surf;

      // heading
      const steerTarget = stunned ? 0 : U.clamp(inp.steer, -1, 1);
      this.steer = U.approach(this.steer, steerTarget, dt * 11);
      const fwd0 = this.vx * Math.cos(this.h) + this.vy * Math.sin(this.h);
      const sp = Math.abs(fwd0);
      let turn = st.turn * this.steer * Math.min(1, sp / 32) * (1 - 0.28 * Math.min(1, sp / st.vmax));
      if (fwd0 < -2) turn = -turn;
      if (air) turn *= 0.3;
      if (stunned) this.h += this.spinDir * 13 * dt;
      else this.h += turn * dt;
      this.h = U.wrapAngle(this.h);

      // decompose velocity in the new heading frame
      const fx = Math.cos(this.h), fy = Math.sin(this.h);
      let vF = this.vx * fx + this.vy * fy;
      let vL = -this.vx * fy + this.vy * fx;
      const boosting = this.boostT > 0;
      const vmax = st.vmax * (boosting ? 1.34 : 1) * this.rubber;
      if (!air) {
        const thr = stunned ? 0 : inp.gas;
        const brk = stunned ? 0 : inp.brake;
        const k = st.drag * (boosting ? 1.8 : 1);
        if (boosting) vF += k * (vmax - vF) * dt;
        else if (thr > 0.01 && vF < vmax) vF += k * (vmax - vF) * thr * dt;
        else vF -= vF * (vF > vmax ? 1.6 : 0.7) * dt;
        if (brk > 0.01) {
          if (vF > 4) vF = Math.max(0, vF - 280 * brk * dt);
          else vF = Math.max(-48, vF - 110 * brk * dt);
        }
        if (surf.puddle) vF -= vF * 1.6 * dt;
        if (this.inPit) vF -= vF * 3.2 * dt;
        let grip = st.grip;
        if (surf.oil || this.slipT > 0) grip *= 0.14;
        if (surf.puddle) grip *= 0.6;
        if (stunned) grip *= 0.25;
        vL *= Math.exp(-grip * dt);
      }
      this.vF = vF; this.vL = vL;
      this.vx = fx * vF - fy * vL;
      this.vy = fy * vF + fx * vL;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // track position
      this.idx = T.nearest(this.x, this.y, this.idx);
      const prevS = this.s;
      this.s = T.sAt(this.x, this.y, this.idx);
      this.d = T.lateral(this.x, this.y, this.idx);
      if (prevS > T.len * 0.75 && this.s < T.len * 0.25) this.lap++;
      else if (prevS < T.len * 0.25 && this.s > T.len * 0.75) this.lap--;

      // walls
      const lim = T.drivable - 5;
      if (Math.abs(this.d) > lim) {
        const nx = -T.ty[this.idx], ny = T.tx[this.idx];
        const sg = Math.sign(this.d);
        const over = Math.abs(this.d) - lim;
        this.x -= nx * sg * over;
        this.y -= ny * sg * over;
        const vn = this.vx * nx + this.vy * ny;
        if (vn * sg > 0) {
          // bounce off the wall; glancing contact costs little, head-on costs a lot
          const loss = Math.min(0.4, Math.abs(vn) / 320);
          this.vx -= nx * vn * 1.45;
          this.vy -= ny * vn * 1.45;
          this.vx *= 1 - loss; this.vy *= 1 - loss;
          // nudge heading toward the wall's direction
          const ta = T.ang[this.idx];
          const along = Math.cos(this.h - ta) >= 0 ? ta : ta + Math.PI;
          this.h = U.wrapAngle(this.h + U.wrapAngle(along - this.h) * 0.25);
          if (Math.abs(vn) > 25 && this.wallT <= 0) {
            this.wallT = 0.25;
            race.onWall(this, Math.abs(vn), this.x + nx * sg * 5, this.y + ny * sg * 5);
          }
        }
        this.d = sg * lim;
      }

      // surface features
      const ns = T.surfaceAt(this.s, this.d, this.x, this.y);
      if (this.z < 1) {
        if (ns.oil && !surf.oil) { this.slipT = 0.7; this.h += (Math.random() - 0.5) * 0.5; race.onSurface(this, 'oil'); }
        if (ns.puddle && !surf.puddle) race.onSurface(this, 'puddle');
        if (ns.boost && !surf.boost) { this.boostT = Math.max(this.boostT, 0.9); race.onSurface(this, 'boost'); }
      }
      this.surf = ns;

      // ramps and air
      if (ns.ramp && this.z <= 6 * ns.ramp.t + 0.6 && this.vz <= 0) {
        this.onRamp = true;
        this.z = 6 * ns.ramp.t;
        this.vz = 0;
      } else if (this.onRamp) {
        this.onRamp = false;
        if (vF > 35) {
          this.vz = vF * 0.42;
          race.onJump(this);
        }
      }
      if (!this.onRamp && (this.z > 0 || this.vz > 0)) {
        this.vz -= GRAV * dt;
        this.z += this.vz * dt;
        if (this.z <= 0) {
          this.z = 0;
          const impact = -this.vz;
          this.vz = impact > 90 ? impact * 0.22 : 0;
          if (impact > 60) race.onLand(this, impact);
        }
      }
      this.inPit = !!(ns.pit && this.z <= 0.5);
      if (this.inPit) race.onPit(this);

      // wrong-way and stuck detection
      const dirDot = Math.cos(this.h - T.ang[this.idx]);
      if (dirDot < -0.4 && Math.abs(vF) > 15) this.wrongT += dt; else this.wrongT = Math.max(0, this.wrongT - dt * 2);
      if (Math.abs(vF) < 10 && !stunned) this.stuckT += dt; else this.stuckT = 0;
    }

    draw(ctx, vx, vy, t) {
      if (this.invulnT > 0 && this.spinT <= 0 && Math.floor(t * 16) % 2 === 0) return;
      const sx = Math.round(this.x - this.y + G.Track.WORLD - vx);
      const sy = Math.round((this.x + this.y) * 0.5 + G.Track.OY - vy);
      const fr = this.frames[G.SPR.angleIndex(this.h)];
      const sink = this.inPit ? 3 : 0;
      ctx.drawImage(fr.c, sx - fr.ax, sy - fr.ay - Math.round(this.z) + sink);
    }

    drawShadow(ctx, vx, vy) {
      const sx = Math.round(this.x - this.y + G.Track.WORLD - vx);
      const sy = Math.round((this.x + this.y) * 0.5 + G.Track.OY - vy);
      const shrink = Math.min(4, Math.floor(this.z / 6));
      const sh = G.SPR.shadow(12 - shrink, 6 - (shrink >> 1));
      ctx.drawImage(sh, sx - sh.width / 2 + 0.5 | 0, sy - sh.height / 2 + 1 | 0);
    }
  }

  // ---------------- AI driver ----------------
  class AI {
    constructor(car, lane, aggression) {
      this.car = car;
      this.baseLane = lane;
      this.lane = lane;
      this.phase = Math.random() * 10;
      this.aggr = aggression;
      this.t = 0;
      this.weaponT = Math.random();
      this.reverseT = 0;
    }

    think(dt) {
      const c = this.car, T = c.track, race = c.race;
      this.t += dt;
      const out = { steer: 0, gas: 1, brake: 0, fire: false, bomb: false, boost: false };
      const sp = c.vF;
      const lim = T.drivable - 13;

      // recover from being stuck against a wall or turned around
      if (this.reverseT > 0) {
        this.reverseT -= dt;
        const toward = U.wrapAngle(T.ang[c.idx] - c.h);
        out.gas = 0; out.brake = 1;
        out.steer = -Math.sign(toward);
        return out;
      }
      // facing the wrong way after a spin: pivot around (arcade assist)
      const toward = U.wrapAngle(T.ang[c.idx] - c.h);
      if (Math.abs(toward) > 1.7 && Math.abs(sp) < 80 && c.spinT <= 0 && c.z < 1) {
        c.h = U.wrapAngle(c.h + Math.sign(toward) * Math.min(Math.abs(toward), 5 * dt));
        out.gas = 0.25;
        out.steer = Math.sign(toward);
        return out;
      }
      if (c.stuckT > 1.0 && Math.cos(c.h - T.ang[c.idx]) < 0.3) { this.reverseT = 0.7; c.stuckT = 0; }

      // lane choice: drift around a base lane, avoid hazards and bombs ahead
      let lane = this.baseLane + Math.sin(this.t * 0.45 + this.phase) * 7;
      const ahead = (s) => T.wrapS(s - c.s);
      for (const h of T.hazards) {
        const a = ahead(h.s);
        if (a > 10 && a < 150) {
          const hd = h.d;
          if (Math.abs(hd - lane) < h.r + 12) lane = hd + (lane >= hd ? 1 : -1) * (h.r + 15);
        }
      }
      for (const b of race.bombs) {
        const a = ahead(b.s);
        if (a > 5 && a < 120 && Math.abs(b.d - lane) < 20) lane = b.d + (lane >= b.d ? 1 : -1) * 22;
      }
      for (const o of race.cars) {
        if (o === c) continue;
        const a = ahead(o.s);
        if (a > 2 && a < 40 && Math.abs(o.d - lane) < 14 && o.vF < sp) lane = o.d + (lane >= o.d ? 1 : -1) * 18;
      }
      // pick up nearby ammo crates
      for (const p of race.pickups) {
        if (!p.active || p.kind !== 'ammo') continue;
        const a = ahead(p.s);
        if (a > 20 && a < 110 && Math.abs(p.d - lane) < 22) { lane = p.d; break; }
      }
      // ramps: line up straight
      let rampAhead = false;
      for (const r of T.ramps) {
        const a = ahead(r.s0);
        if (a > 0 && a < 170) { rampAhead = true; lane = U.lerp(lane, 0, 0.6); }
      }
      lane = U.clamp(lane, -lim, lim);
      this.lane = U.approach(this.lane, lane, dt * 40);

      const look = 24 + Math.max(0, sp) * 0.42;
      const tp = T.posAt(c.s + look, this.lane);
      const desired = Math.atan2(tp.y - c.y, tp.x - c.x);
      const diff = U.wrapAngle(desired - c.h);
      out.steer = U.clamp(diff * 2.8, -1, 1);

      // corner speed
      const kmax = T.maxCurv(c.idx, 30 + Math.max(0, sp) * 0.8);
      const turnCap = c.stats.turn * 0.72 * 0.86;
      const vLimit = kmax > 1e-4 ? Math.max(70, turnCap / kmax) : 1e9;
      if (!rampAhead) {
        if (sp > vLimit * 1.1) { out.gas = 0; out.brake = 0.6; }
        else if (sp > vLimit) out.gas = 0.2;
      }
      if (Math.abs(diff) > 1.2) out.gas = 0.5;

      // weapons
      this.weaponT -= dt;
      if (this.weaponT <= 0 && race.state === 'race' && !c.finished) {
        this.weaponT = 0.5;
        for (const o of race.cars) {
          if (o === c || o.finished) continue;
          const gap = o.progress - c.progress;
          const pref = o.isPlayer ? 1.25 : 0.6;
          if (gap > 40 && gap < 230 && Math.abs(o.d - c.d) < 18 && c.fireCd <= 0 && Math.random() < this.aggr * pref) out.fire = true;
          if (gap < -15 && gap > -90 && Math.abs(o.d - c.d) < 18 && c.bombCd <= 0 && Math.random() < this.aggr * pref * 0.7) out.bomb = true;
        }
        if (c.ammo.nitro > 0 && kmax < 0.004 && Math.random() < 0.15) out.boost = true;
      }
      return out;
    }
  }

  G.Car = Car;
})();
