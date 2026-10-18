# Dirtbox Rally

An arcade off-road racer in the spirit of the classic isometric RC racers: boxy 4x4 SUVs,
missiles and bombs, jumps over water pits, upgrade crates, and a letter word to spell across
the circuit. Plays in the browser with keyboard, touch screen, gamepad, or a Logitech G29 wheel.

> The name lives in `TITLE_LINES` in `classic/js/config.js` (the logo is drawn from it) and in the
> `<title>` tags of `classic/index.html` and the root `index.html`.

## Versions

| Folder | Status | Description |
|---|---|---|
| `classic/` | Playable | 16-bit style: pixel-art isometric view, chiptune audio, 384x216 canvas scaled up |
| `nextgen/` | Planned | Modern 3D take on the same game |

## Play

No build step and no dependencies. Open `classic/index.html` in a browser, or serve the repo:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```

**GitHub Pages:** Settings > Pages > Deploy from branch > `main` / root. The root `index.html`
links to the classic version.

> Wheels: browsers only expose the Gamepad API to top-level pages and same-origin frames. Play from
> your own copy (local file, local server or GitHub Pages) when using the G29.

## How it plays (arcade rules)

- **Coin-op mode** by default: press `5` (keyboard), tap *Insert Coin* (touch), or press *Share* (G29) to add a
  credit, then start. Switch to **Free Play** in Options.
- 8 tracks per circuit, 3 laps each, 4 trucks. **Finish in the top 3 to advance.** Finishing 4th
  costs a truck. Start with 3 trucks; when you run out, you get a 10-second **Continue?** countdown.
- After the 8th track the circuit repeats and the rivals get faster.
- **Crates on the track:** missiles (red), bombs (dark), nitro (blue). Upgrade crates (orange
  engine, grey tires, green turbo) appear once per race and stack up to level 5.
- **Letters:** one gold letter per race. Spell `DIRTBOX` for an extra truck and 10,000 points.
- **Hazards:** puddles slow you, oil and black ice spin you, boost pads launch you, ramps jump
  water pits (lava pits on Magma Mountain). Hit a ramp slowly and you land in the pit.
- Score: place bonus, pickups, letters, and hits on rivals. Top-10 table with 3-letter initials.
- Attract mode: idle on the title for a high-score table and a demo race.

## Controls

| Action | Keyboard | Logitech G29 (default) | Gamepad | Touch |
|---|---|---|---|---|
| Steer | ←/→ or A/D | Wheel | Left stick / D-pad | Left pad (slide) |
| Gas | ↑ or W | Gas pedal | RT or A | Auto-gas (or GAS button) |
| Brake / reverse | ↓ or S | Brake pedal | LT or X | BRAKE |
| Missile | Space, J, Z | X or right paddle | B | MISSILE |
| Bomb | K or X | Circle or left paddle | Y | BOMB |
| Nitro | L, C, Shift | Square, Triangle, R2 | LB / RB | NITRO |
| Pause | Esc or P | Options | Start | II |
| Insert coin | 5 | Share | Select / Back | Tap *Insert Coin* |
| Fullscreen | F | | | Corner icon on title |
| Music on/off | M | | | Options |

### Logitech G29 setup

The G29 is detected automatically. Because browsers report wheel axes differently per OS and
driver, run **Options > Wheel Setup** once. The wizard asks you to center the wheel, turn it lock to
lock, press and release each pedal, and press the buttons you want for missile, bomb, nitro and
pause. The result is saved in the browser. **Wheel Rotation** (180 to 900 degrees) sets how far you
turn the wheel for full steering lock; 270 feels right for this game.

## Project layout

```
index.html            launcher (Classic / Next-Gen)
classic/
  index.html          game page
  css/style.css       page and touch-control styles
  js/config.js        name, points, truck stats
  js/util.js          math, RNG, storage helpers
  js/font.js          5x7 bitmap font
  js/tracks.js        8 track layouts and their themes
  js/track.js         spline geometry, collision queries, pre-rendered isometric ground
  js/sprites.js       voxel models (trucks, crates, letters, scenery) rendered to sprites
  js/audio.js         WebAudio chip synth: music sequencer, SFX, engine drone
  js/input.js         keyboard, touch, gamepad, G29 wheel profiles
  js/fx.js            particles, explosions, score pop-ups
  js/car.js           truck physics and AI driver
  js/race.js          race session: weapons, pickups, laps, camera, rendering
  js/hud.js           in-race HUD
  js/screens.js       title, attract, select, results, continue, initials, options, wheel setup
  js/main.js          boot, loop, screen manager, settings, high scores
tools/
  trackcheck.js       validates track layouts (corner radius, clearance) and renders previews
  build_single.py     bundles classic/ into one self-contained HTML file
```

All art and music are generated in code; there are no image or audio files.

### Adding or editing a track

Tracks are closed splines in `classic/js/tracks.js` (world is 1100x1100 units). Features are placed
by lap fraction. After editing, run:

```bash
node tools/trackcheck.js --svg /tmp/tracks.svg
```

It fails if a corner is tighter than the trucks can take or two road sections are too close.

### Single-file build

```bash
python3 tools/build_single.py   # writes dist/dirtbox-rally-classic.html
```
