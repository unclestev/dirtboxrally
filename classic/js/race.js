'use strict';
// One race: cars, weapons, pickups, laps, camera and world rendering.
(function () {
  const U = G.U;
  const STEP = 1 / 120;
  const VW = G.CONFIG.VIEW_W, VH = G.CONFIG.VIEW_H;
  const WORLD = G.Track.WORLD, OY = G.Track.OY;
  const RIVAL_NAMES = ['BLAZE', 'RIPTIDE', 'DUSTY', 'BOULDER', 'FROSTY', 'NIGHTOWL', 'TORCH', 'JAMMER'];
  const AMMO_TYPES = [['missile', 40], ['bomb', 30], ['nitro', 30]];
  const AMMO_CAP = { missile: 9, bomb: 9, nitro: 5 };

  function pickAmmo() {
    let r = Math.random() * 100;
    for (const [t, w] of AMMO_TYPES) { r -= w; if (r <= 0) return t; }
    return 'missile';
  }

  class Race {
    // o: { trackIndex, demo, game, scheme, level, difficulty }
    constructor(o) {
      this.o = o;
      this.demo = !!o.demo;
      this.game = o.game || null;
      const ti = o.trackIndex % G.TRACKS.length;
      this.def = G.TRACKS[ti];
      this.track = new G.Track(this.def, ti);
      this.track.renderGround();
      this.track.placeDecor();
      this.track.buildMinimap(66, 42);
      this.theme = this.track.theme;
      this.fx = new G.FX();
      this.bombs = [];
      this.missiles = [];
      this.pickups = [];
      this.cars = [];
      this.messages = [];
      this.time = 0;
      this.t = 0;
      this.acc = 0;
      this.state = 'intro';
      this.stateT = 0;
      this.finishOrder = 0;
      this.raceScore = 0;
      this.hits = 0;
      this.gotLetter = false;
      this.upgradesGot = [];
      this.countBeep = 4;
      this.setupCars();
      this.setupPickups();
      const fc = this.focus;
      this.cam = { x: U.isoX(fc.x, fc.y) + WORLD, y: U.isoY(fc.x, fc.y) + OY };
    }

    setupCars() {
      const o = this.o;
      const ps = o.scheme === undefined ? 0 : o.scheme;
      const rivals = [0, 1, 2, 3, 4, 5, 6, 7].filter((s) => s !== ps).slice(0, 3);
      const diffMul = { easy: 0.92, normal: 1, hard: 1.06 }[o.difficulty || 'normal'];
      const aggrMul = { easy: 0.55, normal: 1, hard: 1.4 }[o.difficulty || 'normal'];
      const skills = [1.02, 1.0, 0.965].sort(() => Math.random() - 0.5);
      const lanes = [-12, 12, -12, 12];
      const slots = [[-24, -13], [-24, 13], [-58, -13], [-58, 13]];
      const L = this.track.len;
      rivals.forEach((sc, i) => {
        const c = new G.Car(this, {
          scheme: sc, name: RIVAL_NAMES[sc], ai: true, level: o.level || 0, skill: skills[i] * diffMul,
          lane: lanes[i], aggression: (0.035 + Math.min(0.12, (o.level || 0) * 0.01)) * aggrMul,
          ammo: { missile: 99, bomb: 99, nitro: 1 },
        });
        c.place(L + slots[i][0], slots[i][1]);
        this.cars.push(c);
      });
      const g = this.game;
      const player = new G.Car(this, {
        scheme: ps, name: 'YOU', isPlayer: !this.demo, ai: this.demo, level: o.level || 0, skill: 1,
        upgrades: g ? g.upgrades : { engine: 1, tires: 1, turbo: 1 },
        ammo: g ? g.ammo : { missile: 3, bomb: 2, nitro: 1 }, lane: 8, aggression: 0.35,
      });
      if (this.demo) { player.level = (o.level || 0) + 1; player.computeStats(); }
      player.place(L + slots[3][0], slots[3][1]);
      this.cars.push(player);
      this.player = player;
      this.focus = player;
    }

    setupPickups() {
      const T = this.track;
      for (const [f, d, kind] of this.def.items || []) {
        const p = T.posAt(f * T.len, d);
        this.pickups.push({ s: f * T.len, d, x: p.x, y: p.y, kind, type: kind === 'upgrade' ? this.pickUpgrade() : pickAmmo(), active: true, respawnT: 0, spin: Math.random() * 16 });
      }
      this.letter = null;
      const g = this.game;
      if (g && !this.demo && this.def.letter) {
        const word = G.CONFIG.LETTER_WORD;
        const ch = word[g.letters % word.length];
        const [f, d] = this.def.letter;
        const p = T.posAt(f * T.len, d);
        this.letter = { x: p.x, y: p.y, s: f * T.len, ch, active: true };
      }
    }

    pickUpgrade() {
      const u = this.game ? this.game.upgrades : { engine: 0, tires: 0, turbo: 0 };
      const max = G.CONFIG.MAX_UPGRADE;
      const opts = ['engine', 'tires', 'turbo'].filter((k) => u[k] < max);
      if (!opts.length) return 'nitro';
      const min = Math.min(...opts.map((k) => u[k]));
      const low = opts.filter((k) => u[k] === min);
      return Math.random() < 0.7 ? low[(Math.random() * low.length) | 0] : opts[(Math.random() * opts.length) | 0];
    }

    msg(text, color, dur, big) {
      this.messages = this.messages.filter((m) => m.big !== big);
      this.messages.push({ text, color: color || '#ffffff', t: 0, dur: dur || 1.6, big: !!big });
    }

    // ---------- update ----------
    update(dt) {
      dt = Math.min(dt, 0.1);
      this.t += dt;
      this.stateT += dt;
      const In = G.input;
      const pl = this.player;
      In.raceMode = !this.demo && this.state !== 'done';

      if (this.state === 'intro' && this.stateT > 1.7) { this.state = 'countdown'; this.stateT = 0; }
      if (this.state === 'countdown') {
        const n = 3 - Math.floor(this.stateT / 0.8);
        if (n < this.countBeep && n > 0) { this.countBeep = n; G.audio.sfx('beep'); }
        if (this.stateT >= 2.4) {
          this.state = 'race';
          this.stateT = 0;
          G.audio.sfx('go');
          this.msg('GO!', '#7cf07c', 0.9, true);
          G.audio.music(['raceA', 'raceB', 'raceC'][this.track.index % 3]);
        }
      }

      // player actions (edge triggered once per frame)
      const canAct = this.state === 'race' && !this.demo && !pl.finished;
      if (canAct) {
        if (In.pressed('fire')) this.fireMissile(pl);
        if (In.pressed('bomb')) this.dropBomb(pl);
        if (In.pressed('boost')) this.useNitro(pl);
      }

      this.acc += dt;
      while (this.acc >= STEP) {
        this.step(STEP);
        this.acc -= STEP;
      }
      this.fx.update(dt);
      for (const m of this.messages) m.t += dt;
      this.messages = this.messages.filter((m) => m.t < m.dur);

      // camera
      const f = this.focus;
      const lead = 0.32;
      const tx = U.isoX(f.x + f.vx * lead, f.y + f.vy * lead) + WORLD;
      const ty = U.isoY(f.x + f.vx * lead, f.y + f.vy * lead) + OY - f.z * 0.5;
      const k = 1 - Math.exp(-dt * 5);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;

      // engine sound
      if (!this.demo) {
        const moving = this.state !== 'done';
        const gas = this.state === 'race' || this.state === 'countdown' ? In.axes.gas : 0;
        G.audio.engine(Math.abs(pl.vF) / G.CONFIG.TRUCK.vmax, pl.finished ? 0.3 : gas, pl.boostT > 0, moving);
      }
      if (this.state === 'finish' && this.stateT > 4.2) {
        this.state = 'done';
        G.audio.engine(0, 0, false, false);
      }
    }

    step(h) {
      const In = G.input;
      const moving = this.state === 'race' || this.state === 'finish' || this.state === 'done';
      this.time += this.state === 'race' ? h : 0;
      const pl = this.player;
      for (const c of this.cars) {
        let inp;
        if (!moving) {
          c.surf = c.surf || {};
          continue;
        }
        const ai = c.aiDriven || c.finished || (this.state !== 'race');
        if (ai) {
          inp = c.ai.think(h);
          if (this.state === 'race' && !c.finished) {
            if (inp.fire) this.fireMissile(c);
            if (inp.bomb) this.dropBomb(c);
            if (inp.boost) this.useNitro(c);
          }
        } else {
          inp = { steer: In.axes.steer, gas: In.axes.gas, brake: In.axes.brake };
        }
        // gentle rubber band so the pack stays close
        if (!c.isPlayer && !this.demo && this.state === 'race') {
          const gap = c.progress - pl.progress;
          c.rubber = U.clamp(1 - gap / 4200, 0.93, 1.07);
        } else c.rubber = 1;
        const lapBefore = c.lap;
        c.step(h, inp);
        if (c.lap !== lapBefore) this.onLap(c, lapBefore);
        this.trailFx(c, inp);
      }
      if (!moving) return;
      this.collideCars();
      this.updateMissiles(h);
      this.updateBombs(h);
      this.updatePickups(h);
    }

    trailFx(c, inp) {
      const fx = this.fx;
      c.skidTick = (c.skidTick + 1) % 3;
      if (c.skidTick !== 0) return;
      const cs = Math.cos(c.h), sn = Math.sin(c.h);
      const rx = c.x - cs * 6, ry = c.y - sn * 6;
      const sliding = Math.abs(c.vL) > 30 || c.slipT > 0 || (inp.brake > 0.5 && c.vF > 60);
      const near = Math.abs(U.isoX(c.x, c.y) + WORLD - this.cam.x) < 260 && Math.abs(U.isoY(c.x, c.y) + OY - this.cam.y) < 160;
      if (c.z <= 0.5 && sliding && near) {
        const g = this.track.gctx;
        g.fillStyle = 'rgba(20,12,16,0.22)';
        for (const sgn of [-1, 1]) {
          const wx = rx - sn * 4 * sgn, wy = ry + cs * 4 * sgn;
          g.fillRect(Math.round(wx - wy + WORLD), Math.round((wx + wy) * 0.5 + OY), 2, 1);
        }
      }
      if (!near) return;
      if (c.z <= 0.5 && (sliding || (inp.gas > 0.5 && c.vF < c.stats.vmax * 0.6 && c.vF > 5)) && Math.random() < 0.7) {
        fx.spawn(rx + (Math.random() - 0.5) * 6, ry + (Math.random() - 0.5) * 6, 1, -cs * 15 + (Math.random() - 0.5) * 20, -sn * 15 + (Math.random() - 0.5) * 20, 12 + Math.random() * 16, 0.35 + Math.random() * 0.3, this.theme.dust, Math.random() < 0.4 ? 2 : 1, 50, 2);
      }
      if (c.boostT > 0) {
        for (let i = 0; i < 2; i++) fx.flame(rx - cs * 2, ry - sn * 2, 4, -c.vx, -c.vy);
      }
      if (c.spinT > 0 && Math.random() < 0.5) fx.smoke(c.x, c.y, 6);
    }

    collideCars() {
      const cars = this.cars;
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], b = cars[j];
          if (Math.abs(a.z - b.z) > 7) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy, R = 11;
          if (d2 >= R * R || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          const push = (R - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = -rel * 0.65;
            a.vx -= nx * imp; a.vy -= ny * imp;
            b.vx += nx * imp; b.vy += ny * imp;
            if ((a === this.player || b === this.player) && !this.demo && -rel > 30) {
              G.audio.sfx('bump');
              G.input.rumble(0.3, 80);
            }
          }
        }
      }
    }

    // ---------- weapons ----------
    fireMissile(c) {
      if (c.fireCd > 0) return;
      if (c.ammo.missile <= 0) { if (c.isPlayer) { G.audio.sfx('empty'); c.fireCd = 0.3; } return; }
      c.ammo.missile--;
      c.fireCd = c.isPlayer ? 0.35 : 4.5;
      const T = this.track;
      // player missiles home hard; rival missiles drift slowly so they can be dodged
      const m = { owner: c, s: T.wrapS(c.s + 14), d: c.d, speed: Math.max(c.vF, 60) + 215, life: 2.4, z: 4, retarget: 0, target: null, smokeT: 0, homing: c.isPlayer ? 130 : 48 };
      const p = T.posAt(m.s, m.d);
      m.x = p.x; m.y = p.y;
      this.missiles.push(m);
      if (c.isPlayer || this.near(c)) G.audio.sfx('missile');
    }

    dropBomb(c) {
      if (c.bombCd > 0) return;
      if (c.ammo.bomb <= 0) { if (c.isPlayer) { G.audio.sfx('empty'); c.bombCd = 0.3; } return; }
      c.ammo.bomb--;
      c.bombCd = c.isPlayer ? 0.4 : 6;
      const T = this.track;
      const x = c.x - Math.cos(c.h) * 13, y = c.y - Math.sin(c.h) * 13;
      const i = T.nearest(x, y, c.idx);
      const d = U.clamp(T.lateral(x, y, i), -T.drivable + 6, T.drivable - 6);
      const p = T.posAt(T.sAt(x, y, i), d);
      this.bombs.push({ owner: c, x: p.x, y: p.y, s: T.sAt(x, y, i), d, armT: 0.6, life: 25 });
      if (c.isPlayer || this.near(c)) G.audio.sfx('bombdrop');
    }

    useNitro(c) {
      if (c.boostT > 0.3) return;
      if (c.ammo.nitro <= 0) { if (c.isPlayer) G.audio.sfx('empty'); return; }
      c.ammo.nitro--;
      c.boostT = 1.7;
      if (c.isPlayer || this.near(c)) G.audio.sfx('boost');
    }

    near(c) {
      return Math.abs(U.isoX(c.x, c.y) + WORLD - this.cam.x) < 220 && Math.abs(U.isoY(c.x, c.y) + OY - this.cam.y) < 130;
    }

    damage(car, kind, by) {
      if (!car.hit(kind, by)) return;
      if (car === this.player && !this.demo) {
        G.audio.sfx('hit');
        G.input.rumble(0.9, 350);
        this.fx.shake = 6;
        this.msg(kind === 'lava' ? 'TOO HOT!' : 'OUCH!', '#ff6a5a', 1, false);
      } else if (this.near(car)) G.audio.sfx('spin');
      if (by && by.isPlayer && !this.demo && car !== by) {
        const pts = kind === 'missile' ? G.CONFIG.POINTS.missileHit : G.CONFIG.POINTS.bombHit;
        this.raceScore += pts;
        this.hits++;
        this.fx.popup(car.x, car.y, '+' + pts, '#ffe060');
      }
    }

    updateMissiles(h) {
      const T = this.track;
      for (const m of this.missiles) {
        m.life -= h;
        m.s = T.wrapS(m.s + m.speed * h);
        m.retarget -= h;
        if (m.retarget <= 0) {
          m.retarget = 0.1;
          m.target = null;
          let best = 280;
          for (const c of this.cars) {
            if (c === m.owner) continue;
            const gap = T.wrapS(c.s - m.s);
            if (gap < best) { best = gap; m.target = c; }
          }
        }
        if (m.target) m.d = U.approach(m.d, m.target.d, m.homing * h);
        m.d = U.clamp(m.d, -T.drivable + 4, T.drivable - 4);
        const p = T.posAt(m.s, m.d);
        m.x = p.x; m.y = p.y; m.a = p.a;
        m.smokeT -= h;
        if (m.smokeT <= 0) { m.smokeT = 0.03; this.fx.spawn(m.x, m.y, 4, 0, 0, 6, 0.3, Math.random() < 0.5 ? '#c8c0c8' : '#9a929a', 1, -5); }
        for (const c of this.cars) {
          if (c === m.owner && m.life > 2.0) continue;
          if (c.z > 14) continue;
          const dx = c.x - m.x, dy = c.y - m.y;
          if (dx * dx + dy * dy < 121) {
            m.life = -1;
            this.fx.explosion(m.x, m.y, true);
            if (this.near(c) || c === this.player) G.audio.sfx('explode');
            this.damage(c, 'missile', m.owner);
            break;
          }
        }
        for (const b of this.bombs) {
          const dx = b.x - m.x, dy = b.y - m.y;
          if (dx * dx + dy * dy < 81) { m.life = -1; b.life = -1; this.fx.explosion(b.x, b.y, true); if (this.near(b)) G.audio.sfx('explode'); }
        }
        if (m.life <= 0 && m.life > -0.5) { this.fx.explosion(m.x, m.y, false); m.life = -1; }
      }
      this.missiles = this.missiles.filter((m) => m.life > 0);
    }

    updateBombs(h) {
      for (const b of this.bombs) {
        b.armT -= h;
        b.life -= h;
        for (const c of this.cars) {
          if (c.z > 6 || (c === b.owner && b.armT > 0)) continue;
          const dx = c.x - b.x, dy = c.y - b.y;
          if (dx * dx + dy * dy < 100) {
            b.life = -1;
            this.fx.explosion(b.x, b.y, true);
            if (this.near(c) || c === this.player) G.audio.sfx('explode');
            this.damage(c, 'bomb', b.owner);
            break;
          }
        }
      }
      this.bombs = this.bombs.filter((b) => b.life > 0);
    }

    updatePickups(h) {
      for (const p of this.pickups) {
        p.spin += h * 10;
        if (!p.active) {
          p.respawnT -= h;
          if (p.respawnT <= 0 && p.kind === 'ammo') { p.active = true; p.type = pickAmmo(); }
          continue;
        }
        for (const c of this.cars) {
          if (c.z > 12) continue;
          if (!c.isPlayer && p.kind === 'upgrade') continue;
          const dx = c.x - p.x, dy = c.y - p.y;
          if (dx * dx + dy * dy < 169) { this.collect(c, p); break; }
        }
      }
      const L = this.letter;
      if (L && L.active) {
        const c = this.player;
        const dx = c.x - L.x, dy = c.y - L.y;
        if (dx * dx + dy * dy < 196 && c.z < 14) this.collectLetter();
      }
    }

    collect(c, p) {
      p.active = false;
      p.respawnT = 6;
      if (!c.isPlayer) return;
      const P = G.CONFIG.POINTS;
      const it = G.SPR.ITEMS[p.type];
      if (p.kind === 'upgrade' && p.type !== 'nitro') {
        const g = this.game;
        g.upgrades[p.type] = Math.min(G.CONFIG.MAX_UPGRADE, g.upgrades[p.type] + 1);
        c.computeStats();
        this.upgradesGot.push(p.type);
        this.raceScore += P.upgrade;
        G.audio.sfx('upgrade');
        this.msg(it.label + ' UP!', '#7cf07c', 1.4, false);
        this.fx.popup(p.x, p.y, it.label + '+', '#7cf07c');
      } else {
        const add = p.type === 'nitro' ? 1 : 2;
        c.ammo[p.type] = Math.min(AMMO_CAP[p.type], c.ammo[p.type] + add);
        this.raceScore += P.pickup;
        G.audio.sfx('pickup');
        this.fx.popup(p.x, p.y, '+' + add + ' ' + it.label, '#ffffff');
      }
    }

    collectLetter() {
      const L = this.letter;
      L.active = false;
      const g = this.game;
      g.letters++;
      this.gotLetter = true;
      this.raceScore += G.CONFIG.POINTS.letter;
      G.audio.sfx('letter');
      this.fx.popup(L.x, L.y, L.ch + '!', '#ffe060');
      const word = G.CONFIG.LETTER_WORD;
      if (g.letters >= word.length) {
        g.letters = 0;
        g.lives++;
        this.raceScore += G.CONFIG.POINTS.word;
        this.msg(word + '! +1 TRUCK', '#ffe060', 2.5, false);
        setTimeout(() => G.audio.sfx('extra'), 400);
      } else {
        this.msg('LETTER ' + L.ch, '#ffe060', 1.4, false);
      }
    }

    // ---------- events from car physics ----------
    onLap(c, before) {
      const T = this.track;
      if (c.lap > before && c.lap >= 1) {
        const lt = this.time - c.lastLapStart;
        if (lt < c.bestLap) c.bestLap = lt;
      }
      if (c.lap > before) c.lastLapStart = this.time;
      const LAPS = G.CONFIG.LAPS;
      if (c.lap >= LAPS && !c.finished) {
        c.finished = true;
        c.finishTime = this.time;
        c.place = ++this.finishOrder;
        if (c === this.player && !this.demo) {
          this.state = 'finish';
          this.stateT = 0;
          const good = c.place <= 3;
          this.msg(good ? 'FINISHED ' + U.ordinal(c.place) + '!' : U.ordinal(c.place) + ' PLACE', good ? '#ffe060' : '#ff6a5a', 4, true);
          G.audio.jingle(c.place === 1 ? 'win' : good ? 'qualify' : 'lose');
        }
      }
      if (c === this.player && !this.demo && c.lap > before && !c.finished && this.state === 'race') {
        if (c.lap === LAPS - 1) { this.msg('FINAL LAP!', '#ffe060', 1.6, true); G.audio.sfx('finallap'); }
        else if (c.lap >= 1) { this.msg('LAP ' + (c.lap + 1), '#ffffff', 1.2, true); G.audio.sfx('lap'); }
      }
      // all rivals done before the player: race over
      if (!this.demo && this.state === 'race' && this.cars.filter((k) => !k.isPlayer && k.finished).length >= 3 && !this.player.finished) {
        this.player.finished = true;
        this.player.place = 4;
        this.player.finishTime = Infinity;
        this.state = 'finish';
        this.stateT = 0;
        this.msg('TOO SLOW!', '#ff6a5a', 4, true);
        G.audio.jingle('lose');
      }
      void T;
    }

    onWall(c, impact, x, y) {
      if (!this.near(c)) return;
      if (impact > 45) this.fx.sparks(x, y, 4);
      if (c === this.player && !this.demo) { G.audio.sfx('wall'); G.input.rumble(Math.min(1, impact / 150), 90); }
    }
    onSurface(c, kind) {
      const near = this.near(c);
      if (kind === 'puddle' && near) { this.fx.splash(c.x, c.y, 10, this.theme.colors.PUDDLE[0]); if (c === this.player) G.audio.sfx('splash'); }
      if (kind === 'oil' && c === this.player && !this.demo) G.audio.sfx('skid');
      if (kind === 'boost' && c === this.player && !this.demo) G.audio.sfx('boost');
    }
    onJump(c) { if (c === this.player && !this.demo) G.audio.sfx('jump'); }
    onLand(c, impact) {
      if (this.near(c)) this.fx.dust(c.x, c.y, this.theme.dust, 8, 30);
      if (c === this.player && !this.demo) { G.audio.sfx('land'); G.input.rumble(Math.min(1, impact / 200), 120); }
    }
    onPit(c) {
      if (this.theme.lava) {
        this.fx.explosion(c.x, c.y, false);
        this.damage(c, 'lava', null);
        return;
      }
      if (c.splashT <= 0) {
        c.splashT = 0.12;
        if (this.near(c)) this.fx.splash(c.x, c.y, 6, this.theme.colors.PIT[0]);
        if (c === this.player && !this.demo && Math.random() < 0.3) G.audio.sfx('splash');
      }
    }

    standings() {
      return this.cars.slice().sort((a, b) => {
        if (a.finished && b.finished) return a.place - b.place;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress - a.progress;
      });
    }
    playerRank() {
      if (this.player.finished) return this.player.place;
      return this.standings().indexOf(this.player) + 1;
    }

    // ---------- rendering ----------
    render(ctx) {
      const T = this.track;
      const sh = this.fx.shake;
      let vx = Math.round(this.cam.x - VW / 2 + (sh ? (Math.random() - 0.5) * sh * 2 : 0));
      let vy = Math.round(this.cam.y - VH / 2 + (sh ? (Math.random() - 0.5) * sh * 2 : 0));
      vx = U.clamp(vx, 0, T.IW - VW);
      vy = U.clamp(vy, 0, T.IH - VH);
      this.view = { vx, vy };
      ctx.drawImage(T.ground, vx, vy, VW, VH, 0, 0, VW, VH);
      const t = this.t;
      const P = (x, y) => [Math.round(x - y + WORLD - vx), Math.round((x + y) * 0.5 + OY - vy)];

      // shadows
      ctx.globalAlpha = 0.3;
      for (const c of this.cars) c.drawShadow(ctx, vx, vy);
      for (const p of this.pickups) if (p.active) { const [sx, sy] = P(p.x, p.y); const s = G.SPR.shadow(7, 3); ctx.drawImage(s, sx - 7, sy - 3); }
      if (this.letter && this.letter.active) { const [sx, sy] = P(this.letter.x, this.letter.y); const s = G.SPR.shadow(6, 3); ctx.drawImage(s, sx - 6, sy - 3); }
      for (const m of this.missiles) { const [sx, sy] = P(m.x, m.y); ctx.fillStyle = '#000'; ctx.fillRect(sx - 2, sy, 4, 1); }
      ctx.globalAlpha = 1;

      const list = [];
      for (const o of T.decor) {
        const sx = o.sx - vx, sy = o.sy - vy;
        if (sx < -40 || sx > VW + 40 || sy < -10 || sy > VH + 50) continue;
        list.push({ depth: o.sy, o, kind: 'decor' });
      }
      for (const c of this.cars) list.push({ depth: (c.x + c.y) * 0.5 + OY + 0.5, c, kind: 'car' });
      this.pickups.forEach((p, i) => { if (p.active) list.push({ depth: (p.x + p.y) * 0.5 + OY, p, i, kind: 'pickup' }); });
      if (this.letter && this.letter.active) list.push({ depth: (this.letter.x + this.letter.y) * 0.5 + OY, kind: 'letter' });
      for (const b of this.bombs) list.push({ depth: (b.x + b.y) * 0.5 + OY, b, kind: 'bomb' });
      for (const m of this.missiles) list.push({ depth: (m.x + m.y) * 0.5 + OY + 1, m, kind: 'missile' });
      // start gantry posts
      const post = [T.posAt(4, -T.drivable - 4), T.posAt(4, T.drivable + 4)];
      post.forEach((p, i) => list.push({ depth: (p.x + p.y) * 0.5 + OY, p, i, kind: 'post' }));
      list.sort((a, b) => a.depth - b.depth);

      for (const it of list) {
        switch (it.kind) {
          case 'decor': {
            const o = it.o, spr = G.SPR.decor(o.type, o.v, o.face);
            ctx.drawImage(spr.c, o.sx - vx - spr.ax, o.sy - vy - spr.ay);
            break;
          }
          case 'car': it.c.draw(ctx, vx, vy, t); break;
          case 'pickup': {
            const p = it.p;
            const fr = G.SPR.crateFrames(p.type)[Math.floor(p.spin) % G.SPR.SPIN];
            const [sx, sy] = P(p.x, p.y);
            const bob = Math.round(5 + Math.sin(t * 4 + it.i) * 2);
            ctx.drawImage(fr.c, sx - fr.ax, sy - fr.ay - bob);
            break;
          }
          case 'letter': {
            const L = this.letter;
            const fr = G.SPR.letterFrames(L.ch)[Math.floor(t * 8) % G.SPR.SPIN];
            const [sx, sy] = P(L.x, L.y);
            const bob = Math.round(7 + Math.sin(t * 3) * 2);
            ctx.drawImage(fr.c, sx - fr.ax, sy - fr.ay - bob);
            if (Math.random() < 0.2) this.fx.spawn(L.x + (Math.random() - 0.5) * 10, L.y + (Math.random() - 0.5) * 10, 8 + Math.random() * 8, 0, 0, 10, 0.4, '#fff6a0', 1, 0);
            break;
          }
          case 'bomb': {
            const b = it.b, spr = G.SPR.bomb();
            const [sx, sy] = P(b.x, b.y);
            ctx.drawImage(spr.c, sx - spr.ax, sy - spr.ay);
            if (b.armT <= 0 && Math.floor(t * 6) % 2 === 0) { ctx.fillStyle = '#ff3030'; ctx.fillRect(sx, sy - 9, 2, 2); }
            break;
          }
          case 'missile': {
            const m = it.m;
            const [sx, sy0] = P(m.x, m.y);
            const sy = sy0 - m.z;
            const ca = Math.cos(m.a), sa = Math.sin(m.a);
            let dx = ca - sa, dy = (ca + sa) * 0.5;
            const l = Math.hypot(dx, dy) || 1;
            dx /= l; dy /= l;
            ctx.fillStyle = '#140e1a';
            for (let k = -4; k <= 4; k++) ctx.fillRect(Math.round(sx + dx * k) - 1, Math.round(sy + dy * k) - 1, 4, 4);
            for (let k = -4; k <= 4; k++) {
              ctx.fillStyle = k >= 3 ? '#ff3a30' : k <= -4 ? (Math.floor(t * 20) % 2 ? '#ffe060' : '#ff7020') : k === -3 ? '#8a8a96' : '#f0f0f8';
              ctx.fillRect(Math.round(sx + dx * k), Math.round(sy + dy * k), 2, 2);
            }
            break;
          }
          case 'post': {
            const [sx, sy] = P(it.p.x, it.p.y);
            ctx.fillStyle = '#140e1a';
            ctx.fillRect(sx - 2, sy - 27, 4, 28);
            ctx.fillStyle = '#c8ccd4';
            ctx.fillRect(sx - 1, sy - 27, 2, 27);
            const wave = Math.floor(t * 6 + it.i) % 2;
            ctx.fillStyle = '#140e1a';
            ctx.fillRect(sx + 1, sy - 28, 12, 8);
            for (let r = 0; r < 6; r++) for (let q = 0; q < 10; q++) {
              ctx.fillStyle = ((q >> 1) + (r >> 1)) % 2 ? '#f4f4f4' : '#1e1e24';
              ctx.fillRect(sx + 2 + q, sy - 27 + r + ((q > 5 && wave) ? 1 : 0), 1, 1);
            }
            break;
          }
        }
      }
      this.fx.renderParts(ctx, vx, vy);
      this.fx.renderPopups(ctx, vx, vy);
      // "YOU" marker before the start
      if (!this.demo && (this.state === 'intro' || this.state === 'countdown') && Math.floor(t * 4) % 2 === 0) {
        const [sx, sy] = P(this.player.x, this.player.y);
        G.font.text(ctx, 'YOU', sx, sy - 34, { color: '#ffe060', align: 'center', outline: '#140e1a' });
        G.font.text(ctx, 'v', sx, sy - 26, { color: '#ffe060', align: 'center', outline: '#140e1a' });
      }
    }
  }

  Race.STEP = STEP;
  G.Race = Race;
})();
