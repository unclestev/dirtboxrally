'use strict';
// Game-wide settings. Change TITLE_LINES once the final name is picked.
window.G = window.G || {};

G.CONFIG = {
  TITLE_LINES: ['DIRTBOX', 'RALLY'],
  EDITION: 'CLASSIC',
  LETTER_WORD: 'DIRTBOX',        // letters collected across races, in order
  VIEW_W: 384,
  VIEW_H: 216,
  LAPS: 3,
  START_LIVES: 3,
  CONTINUE_SECONDS: 10,
  STORAGE_KEY: 'dirtbox-classic-v1',
  POINTS: {
    place: [5000, 3000, 1500, 0],
    pickup: 100,
    upgrade: 250,
    letter: 500,
    word: 10000,
    missileHit: 1000,
    bombHit: 750,
    circuit: 25000,
  },
  // Truck stats. Upgrades go 0..5.
  TRUCK: {
    vmax: 165, vmaxPerEngine: 13,
    drag: 1.5, dragPerTurbo: 0.16,
    grip: 9, gripPerTires: 1.6,
    turn: 3.3, turnPerTires: 0.12,
    radius: 6,
  },
  MAX_UPGRADE: 5,
};
