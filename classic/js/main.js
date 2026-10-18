'use strict';
// Boot, main loop, screen manager, settings and high scores.
(function () {
  const U = G.U, C = G.CONFIG;
  const VW = C.VIEW_W, VH = C.VIEW_H;
  const KEY = C.STORAGE_KEY;

  const DEFAULT_SETTINGS = { freePlay: false, difficulty: 'normal', music: true, sfx: true, autoGas: true, wheelLock: 270, lastScheme: 0 };
  const DEFAULT_SCORES = [['ACE', 60000, 9], ['RIG', 50000, 8], ['MUD', 40000, 6], ['4X4', 30000, 5], ['SUV', 25000, 4], ['DRT', 20000, 3], ['VRM', 15000, 2], ['TRK', 10000, 2], ['OFF', 5000, 1], ['ROD', 2500, 1]];

  G.settings = Object.assign({}, DEFAULT_SETTINGS, U.store.load(KEY + '-settings', {}));
  G.scores = U.store.load(KEY + '-scores', null) || DEFAULT_SCORES.map((r) => r.slice());
  G.credits = 0;
  G.time = 0;
  G.saveSettings = () => U.store.save(KEY + '-settings', G.settings);
  G.scoreRank = (score) => {
    for (let i = 0; i < G.scores.length; i++) if (score > G.scores[i][1]) return i;
    return -1;
  };
  G.addScore = (name, score, race) => {
    const i = G.scoreRank(score);
    if (i < 0) return -1;
    G.scores.splice(i, 0, [name, score, race]);
    G.scores.length = 10;
    U.store.save(KEY + '-scores', G.scores);
    return i;
  };
  G.resetScores = () => {
    G.scores = DEFAULT_SCORES.map((r) => r.slice());
    U.store.save(KEY + '-scores', G.scores);
  };

  G.startGame = function () {
    if (!G.settings.freePlay) {
      if (G.credits <= 0) return;
      G.credits--;
    }
    G.game = {
      score: 0, lives: C.START_LIVES, race: 0, letters: 0, continues: 0, scheme: G.settings.lastScheme || 0,
      upgrades: { engine: 0, tires: 0, turbo: 0 },
      ammo: { missile: 2, bomb: 1, nitro: 1 },
    };
    G.audio.sfx('select');
    G.go('select');
  };

  // ---------- screen manager ----------
  let screen = null, screenName = '';
  G.go = function (name, arg) {
    screenName = name;
    screen = G.screens[name];
    G.input.clearPressed();
    if (screen.enter) screen.enter(arg);
    updateTouchUI();
  };
  G.currentScreen = () => screenName;

  // ---------- toasts ----------
  const toasts = [];
  G.toast = (text) => { toasts.push({ text, t: 0 }); };

  // ---------- canvas & scaling ----------
  const wrap = document.getElementById('game');
  const canvas = document.getElementById('screen');
  canvas.width = VW;
  canvas.height = VH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const touchUI = document.getElementById('touch');

  function fit() {
    const r = wrap.getBoundingClientRect();
    const aw = r.width, ah = r.height;
    let s = Math.min(aw / VW, ah / VH);
    const si = Math.floor(s);
    if (si >= 2 && si / s > 0.86) s = si;
    canvas.style.width = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
    const portrait = ah > aw * 1.1;
    document.body.classList.toggle('portrait', portrait);
  }
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
  fit();

  function updateTouchUI() {
    const show = G.input.touchSeen && screenName === 'race';
    touchUI.hidden = !show;
    touchUI.classList.toggle('autogas', !!G.settings.autoGas);
  }
  G.updateTouchUI = updateTouchUI;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (er) { /* ignore */ }
    if (e.pointerType === 'touch') { G.input.touchSeen = true; G.input.device = 'touch'; }
    G.audio.unlock();
    G.audio.resumePending();
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VW, y = ((e.clientY - r.top) / r.height) * VH;
    touchDown = e.pointerType !== 'mouse';
    G.ui.click(x, y);
    touchDown = false;
    updateTouchUI();
  });
  canvas.addEventListener('pointerup', () => {
    if (fsOnUp) { fsOnUp = false; G.toggleFullscreen(); }
  });

  // ---------- fullscreen ----------
  let touchDown = false, fsOnUp = false;
  G.toggleFullscreen = function () {
    if (touchDown) { fsOnUp = true; return; }
    const d = document;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        const el = document.documentElement;
        const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
        if (p && p.then) p.then(() => { try { window.screen.orientation.lock('landscape').catch(() => {}); } catch (er) { /* ignore */ } }).catch(() => G.toast('FULLSCREEN NOT AVAILABLE HERE'));
        else if (!p) G.toast('FULLSCREEN NOT AVAILABLE HERE');
      } else {
        (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      }
    } catch (e) { G.toast('FULLSCREEN NOT AVAILABLE HERE'); }
  };

  // ---------- global keys ----------
  G.input.onKeyDown = (e) => {
    G.audio.unlock();
    G.audio.resumePending();
    if (e.code === 'KeyF' && !e.repeat) G.toggleFullscreen();
    if (e.code === 'KeyM' && !e.repeat) {
      G.settings.music = !G.settings.music;
      G.audio.setMusic(G.settings.music);
      G.saveSettings();
      G.toast(G.settings.music ? 'MUSIC ON' : 'MUSIC OFF');
    }
  };
  window.addEventListener('pointerdown', () => { G.audio.unlock(); G.audio.resumePending(); }, { passive: true });

  // wheel / pad connect notices
  window.addEventListener('gamepadconnected', (e) => {
    const isWheel = G.input.isWheelId(e.gamepad.id);
    G.toast((isWheel ? 'WHEEL' : 'GAMEPAD') + ' CONNECTED');
    if (isWheel && !G.input.cal[e.gamepad.id]) setTimeout(() => G.toast('RUN WHEEL SETUP IN OPTIONS'), 1600);
  });
  window.addEventListener('gamepaddisconnected', () => G.toast('CONTROLLER DISCONNECTED'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screenName === 'race' && !G.screens.race.paused) {
      G.screens.race.paused = true;
      G.audio.engine(0, 0, false, false);
    }
  });

  // ---------- boot ----------
  G.input.loadCal();
  G.input.settings = G.settings;
  G.audio.musicOn = G.settings.music;
  G.audio.sfxOn = G.settings.sfx;
  G.input.bindTouch(touchUI);
  G.go('title');

  let last = performance.now();
  let padWasPressed = false;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    G.time += dt;
    G.input.update(dt);
    // gamepad presses can unlock audio on some browsers
    if (G.input.device === 'wheel' || G.input.device === 'pad') {
      const any = G.input.anyPressed();
      if (any && !padWasPressed) { G.audio.unlock(); G.audio.resumePending(); }
      padWasPressed = any;
    }
    G.ui.reset();
    screen.update(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    screen.render(ctx);
    // toasts
    for (const t of toasts) t.t += dt;
    while (toasts.length && toasts[0].t > 2.6) toasts.shift();
    toasts.slice(0, 2).forEach((t, i) => {
      const y = VH - 40 - i * 14;
      const w = G.font.measure(t.text) + 10;
      ctx.fillStyle = 'rgba(14,10,22,0.85)';
      ctx.fillRect(VW / 2 - w / 2, y - 3, w, 13);
      G.font.text(ctx, t.text, VW / 2, y, { color: '#7cf0e0', align: 'center' });
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // test hook for automated checks
  G.debug = { go: G.go, get screen() { return screenName; } };
})();
