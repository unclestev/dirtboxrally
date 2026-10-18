'use strict';
// Track themes (palettes, decor) and the eight circuit layouts.
(function () {
  G.DECOR_SIZE = { oak: 8, pine: 6, pine_snow: 6, cactus: 4, rock: 4, rock_snow: 4, bush: 3, hay: 5, deadtree: 5, palm: 7, lamp: 2, cone: 2, tires: 3, stand: 14 };

  const common = {
    START_A: ['#f4f4f4'], START_B: ['#1e1e24'],
    BOOST: ['#f0c830', '#e8c02c'], BOOST_B: ['#e0501c'],
    RAMP_B: ['#f0c830'],
  };

  G.THEMES = {
    farm: {
      sky: ['#24305e', '#4a4a8a', '#c86a6a', '#f0b070'],
      dust: '#c9a06a', lineStyle: 'ruts', wallH: 4, wallDash: [3, 9], stands: true, detailRate: 0.006,
      decor: [['oak', 5], ['bush', 3], ['hay', 1.2], ['rock', 0.6]],
      colors: Object.assign({}, common, {
        GROUND: ['#4d8a3a', '#558f3e', '#4a8236'], GROUND_ALT: ['#5f9e45', '#66a34a'], DETAIL: ['#f2e27a', '#f08080', '#ffffff'],
        TRACK: ['#a5794a', '#9e7244', '#ab8050'], LINE: ['#8c6239', '#86603a'],
        CURB_A: ['#c8402e'], CURB_B: ['#f2ece0'], WALL_A: ['#a8743f', '#a06e3c'], WALL_B: ['#6e4626'],
        PUDDLE: ['#4f7fbf', '#5a8ccc', '#4a76b4'], OIL: ['#2b2633', '#363040'],
        RAMP: ['#b89060', '#b08858'], PIT: ['#3264a8', '#3a70b4', '#2e5ea0'],
      }),
    },
    desert: {
      sky: ['#3a2a5a', '#7a4a7a', '#e07a50', '#f8c878'],
      dust: '#e0b880', lineStyle: 'ruts', wallH: 5, wallDash: [6, 14], detailRate: 0.004,
      decor: [['cactus', 4], ['rock', 4], ['deadtree', 1]],
      colors: Object.assign({}, common, {
        GROUND: ['#d9a868', '#d2a062', '#ddb070'], GROUND_ALT: ['#c98f55', '#c48a50'], DETAIL: ['#a86a3c', '#ecd0a0'],
        TRACK: ['#a86c3a', '#a26636', '#ae7240'], LINE: ['#8e5a30'],
        CURB_A: ['#ecdcb4'], CURB_B: ['#a04030'], WALL_A: ['#b05a3c', '#a85438'], WALL_B: ['#8a3e2a'],
        PUDDLE: ['#5a90c0', '#6a9ccc'], OIL: ['#2b2633', '#363040'],
        RAMP: ['#c09060', '#b88858'], PIT: ['#3a78b8', '#4482c0'],
      }),
    },
    snow: {
      sky: ['#1a2448', '#34507e', '#7a9ac8', '#d8e4f4'],
      dust: '#ffffff', lineStyle: 'ruts', wallH: 5, wallDash: [2, 18], detailRate: 0.004,
      decor: [['pine_snow', 6], ['rock_snow', 1]],
      colors: Object.assign({}, common, {
        GROUND: ['#e6ecf6', '#dfe6f2', '#eef2fa'], GROUND_ALT: ['#cfd8ea', '#d4dcec'], DETAIL: ['#b8c4dc'],
        TRACK: ['#8c93a6', '#868da0', '#9298ac'], LINE: ['#b4bccc'],
        CURB_A: ['#3a62c0'], CURB_B: ['#f4f6fa'], WALL_A: ['#f8fafe', '#eef2f8'], WALL_B: ['#d8e0ee'],
        PUDDLE: ['#a8c4e8', '#b8d0f0'], OIL: ['#4a5878', '#56648a'],
        RAMP: ['#a0a8bc', '#98a0b4'], PIT: ['#5a8ac8', '#6a98d0'], WALL_EDGE: ['#8090b0'],
      }),
    },
    swamp: {
      sky: ['#18242a', '#2e4a44', '#6a8a6a', '#c0c890'],
      dust: '#7a6040', lineStyle: 'ruts', wallH: 4, wallDash: [10, 4], detailRate: 0.01,
      decor: [['deadtree', 3], ['bush', 4], ['oak', 2], ['rock', 1]],
      colors: Object.assign({}, common, {
        GROUND: ['#3e5a2e', '#44622f', '#3a542b'], GROUND_ALT: ['#4a6a34', '#33502a'], DETAIL: ['#7a9a40', '#c8c060'],
        TRACK: ['#6e5434', '#674f30', '#735838'], LINE: ['#58422a'],
        CURB_A: ['#8a7a4a'], CURB_B: ['#5a4a2a'], WALL_A: ['#6a4a2e', '#644628'], WALL_B: ['#3e2a18'],
        PUDDLE: ['#3a6262', '#426c6a', '#365a5a'], OIL: ['#26302a', '#2e3a30'],
        RAMP: ['#8a6a44', '#84643e'], PIT: ['#2e5a5a', '#386464'],
      }),
    },
    city: {
      sky: ['#101830', '#283a6a', '#5a6aa0', '#a8b8d8'],
      dust: '#a8acb4', lineStyle: 'center', wallH: 5, wallDash: [8, 8], stands: true, detailRate: 0.008, patch: 0.62,
      decor: [['lamp', 2], ['cone', 2], ['tires', 3]],
      colors: Object.assign({}, common, {
        GROUND: ['#7c8088', '#787c84', '#80848c'], GROUND_ALT: ['#6e7278', '#72767c'], DETAIL: ['#5a5e64', '#9a9ea6'],
        TRACK: ['#44464e', '#40424a', '#484a52'], LINE: ['#e8e8e8'],
        CURB_A: ['#d03030'], CURB_B: ['#f0f0f0'], WALL_A: ['#ccd0d8', '#c4c8d0'], WALL_B: ['#d03030'],
        PUDDLE: ['#4a6a9a', '#56769f'], OIL: ['#1a1a20', '#26262e'],
        RAMP: ['#8a8c94', '#84868e'], PIT: ['#3a5a8a', '#46669a'],
      }),
    },
    forest: {
      sky: ['#14283a', '#2a5060', '#6a9a8a', '#d0e0b0'],
      dust: '#a08060', lineStyle: 'ruts', wallH: 4, wallDash: [3, 9], detailRate: 0.006, decorDensity: 1.3,
      decor: [['pine', 7], ['oak', 1], ['rock', 1], ['bush', 2]],
      colors: Object.assign({}, common, {
        GROUND: ['#2f6a34', '#336e36', '#2c6230'], GROUND_ALT: ['#3a7a3c', '#28582c'], DETAIL: ['#c8b050', '#7a5a34'],
        TRACK: ['#8a6a44', '#84643f', '#8f6f48'], LINE: ['#74563a'],
        CURB_A: ['#e0e0e0'], CURB_B: ['#3a8a3a'], WALL_A: ['#7a5636', '#74502f'], WALL_B: ['#4e3420'],
        PUDDLE: ['#4a7aa8', '#5686b4'], OIL: ['#2b2633', '#363040'],
        RAMP: ['#a08058', '#987850'], PIT: ['#3a6aa0', '#4474a8'],
      }),
    },
    beach: {
      sky: ['#1e4a8a', '#3a7ac0', '#80c0e8', '#f8e8b0'],
      dust: '#f0e0b0', lineStyle: 'ruts', wallH: 4, wallDash: [7, 5], detailRate: 0.006,
      decor: [['palm', 5], ['rock', 2], ['bush', 1]],
      colors: Object.assign({}, common, {
        GROUND: ['#ecd9a2', '#e6d29a', '#f0dea8'], GROUND_ALT: ['#dcc48a', '#e2ca90'], DETAIL: ['#fcf6e4', '#c8a070'],
        TRACK: ['#c09a64', '#b8925e', '#c6a06a'], LINE: ['#a8865a'],
        CURB_A: ['#40a8d8'], CURB_B: ['#f8f8f8'], WALL_A: ['#a08868', '#9a8262'], WALL_B: ['#7a6448'],
        PUDDLE: ['#58b0d8', '#68bce0'], OIL: ['#3a6a4a', '#447452'],
        RAMP: ['#b89a70', '#b09268'], PIT: ['#3aa0d0', '#4aacd8'],
      }),
    },
    volcano: {
      sky: ['#100a14', '#3a1420', '#8a2a20', '#e86a28'],
      dust: '#8a8288', lineStyle: 'ruts', wallH: 5, wallDash: [5, 11], detailRate: 0.012, lava: true,
      decor: [['deadtree', 3], ['rock', 4]],
      colors: Object.assign({}, common, {
        GROUND: ['#3a3236', '#363034', '#3e3638'], GROUND_ALT: ['#2e282c', '#46383a'], DETAIL: ['#e85a20', '#f0a030'],
        TRACK: ['#6a6268', '#645c62', '#706870'], LINE: ['#58505a'],
        CURB_A: ['#e0602a'], CURB_B: ['#2a2226'], WALL_A: ['#544a4e', '#4e4448'], WALL_B: ['#2e2628'],
        PUDDLE: ['#7a7278', '#847c82'], OIL: ['#e85a20', '#f07a28', '#d84818'],
        RAMP: ['#7a7278', '#746c72'], PIT: ['#e05a20', '#f08030', '#f0a838'],
      }),
    },
  };

  // Layouts. pts = spline control points (world units, 0..1100).
  // Features use lap fractions: ramps [f, hasPit], puddles/oils [f, lateral, radius],
  // boosts [f, lateral], items [f, lateral, 'ammo'|'upgrade'], letter [f, lateral].
  G.TRACKS = [
    {
      name: 'MUDDY ACRES', theme: 'farm',
      pts: [[180, 180], [560, 150], [920, 190], [960, 480], [920, 860], [680, 950], [580, 790], [460, 790], [360, 950], [170, 900], [140, 520]],
      ramps: [[0.30, true]], puddles: [[0.12, -12, 14], [0.62, 10, 13], [0.86, 0, 15]], oils: [], boosts: [[0.80, 0]],
      items: [[0.08, 14, 'ammo'], [0.22, -12, 'ammo'], [0.45, 0, 'upgrade'], [0.57, -14, 'ammo'], [0.72, 12, 'ammo'], [0.92, -10, 'ammo']], letter: [0.40, 18],
    },
    {
      name: 'SIDEWINDER CANYON', theme: 'desert',
      pts: [[160, 160], [520, 130], [880, 170], [960, 420], [780, 520], [560, 460], [390, 520], [390, 670], [560, 730], [860, 710], [950, 880], [700, 980], [300, 960], [130, 780], [140, 450]],
      ramps: [[0.10, true], [0.70, false]], puddles: [[0.47, 0, 14]], oils: [[0.32, -12, 11], [0.88, 14, 11]], boosts: [[0.60, -10], [0.93, 0]],
      items: [[0.05, 0, 'ammo'], [0.25, 12, 'ammo'], [0.42, -10, 'upgrade'], [0.55, 10, 'ammo'], [0.78, -14, 'ammo'], [0.97, 10, 'ammo']], letter: [0.36, -20],
    },
    {
      name: 'FROSTBITE PASS', theme: 'snow',
      pts: [[150, 150], [400, 140], [470, 420], [640, 420], [700, 150], [940, 170], [960, 480], [720, 560], [720, 700], [950, 760], [920, 960], [480, 960], [160, 900], [220, 620], [130, 400]],
      ramps: [[0.665, true]], puddles: [[0.17, 0, 14], [0.88, -10, 14]], oils: [[0.30, 10, 13], [0.45, -12, 13], [0.79, 8, 14]], boosts: [[0.53, 0], [0.95, 0]],
      items: [[0.05, 12, 'ammo'], [0.22, -10, 'ammo'], [0.38, 0, 'upgrade'], [0.50, 12, 'ammo'], [0.73, -12, 'ammo'], [0.84, 0, 'upgrade'], [0.92, 10, 'ammo']], letter: [0.58, 20],
    },
    {
      name: 'GATOR BAYOU', theme: 'swamp',
      pts: [[200, 140], [500, 220], [800, 140], [960, 300], [860, 500], [960, 700], [880, 950], [600, 880], [400, 960], [180, 900], [150, 760], [270, 620], [140, 420]],
      ramps: [[0.14, true]], puddles: [[0.08, 10, 15], [0.30, -12, 15], [0.38, 8, 14], [0.52, 0, 16], [0.66, -10, 15], [0.80, 12, 14], [0.92, -8, 15]], oils: [[0.45, -14, 11]], boosts: [[0.60, 0]],
      items: [[0.04, -12, 'ammo'], [0.20, 10, 'ammo'], [0.34, 0, 'upgrade'], [0.48, 12, 'ammo'], [0.70, 10, 'ammo'], [0.86, -12, 'ammo']], letter: [0.75, -20],
    },
    {
      name: 'STEEL CITY', theme: 'city',
      pts: [[150, 150], [950, 150], [950, 430], [660, 450], [660, 650], [950, 670], [950, 950], [150, 950], [150, 680], [400, 620], [400, 420], [150, 380]],
      ramps: [[0.06, false], [0.62, true]], puddles: [[0.40, 10, 13]], oils: [[0.18, -12, 12], [0.48, 10, 12], [0.85, -10, 12]], boosts: [[0.12, 0], [0.71, -12], [0.71, 12]],
      items: [[0.03, -12, 'ammo'], [0.25, 0, 'ammo'], [0.33, 12, 'upgrade'], [0.53, -12, 'ammo'], [0.78, 0, 'ammo'], [0.90, 12, 'upgrade'], [0.95, -12, 'ammo']], letter: [0.44, -22],
    },
    {
      name: 'TIMBERLINE TRAIL', theme: 'forest',
      pts: [[140, 200], [380, 130], [600, 250], [820, 140], [980, 300], [850, 480], [980, 640], [900, 950], [640, 880], [520, 980], [300, 880], [150, 800], [170, 660], [270, 570], [240, 460], [120, 380]],
      ramps: [[0.70, true]], puddles: [[0.22, 0, 14], [0.55, 10, 14]], oils: [[0.40, -10, 11]], boosts: [[0.08, 0], [0.85, 0]],
      items: [[0.04, 10, 'ammo'], [0.16, -12, 'ammo'], [0.30, 0, 'upgrade'], [0.47, 12, 'ammo'], [0.62, -12, 'ammo'], [0.78, 10, 'ammo'], [0.92, -10, 'ammo']], letter: [0.34, 22],
    },
    {
      name: 'SANDBAR SPRINT', theme: 'beach',
      pts: [[200, 200], [700, 140], [970, 330], [900, 700], [960, 950], [560, 960], [470, 800], [370, 790], [260, 880], [150, 800], [120, 560]],
      ramps: [[0.12, true], [0.85, true]], puddles: [[0.30, -10, 15], [0.45, 12, 15], [0.65, 0, 14]], oils: [[0.55, -12, 11]], boosts: [[0.38, 0], [0.95, 0]],
      items: [[0.05, 12, 'ammo'], [0.22, -12, 'ammo'], [0.35, 0, 'upgrade'], [0.50, -10, 'ammo'], [0.70, 12, 'ammo'], [0.78, -12, 'upgrade'], [0.98, 10, 'ammo']], letter: [0.60, 22],
    },
    {
      name: 'MAGMA MOUNTAIN', theme: 'volcano',
      pts: [[150, 150], [450, 130], [540, 330], [420, 500], [600, 620], [800, 450], [740, 300], [800, 150], [960, 180], [980, 600], [880, 960], [480, 980], [300, 950], [160, 870], [130, 700], [130, 500]],
      ramps: [[0.47, true], [0.72, true]], puddles: [[0.20, 10, 14]], oils: [[0.12, -12, 12], [0.33, 10, 12], [0.60, -10, 12], [0.88, 12, 12]], boosts: [[0.05, 0], [0.55, 0]],
      items: [[0.02, 12, 'ammo'], [0.16, -12, 'ammo'], [0.27, 0, 'upgrade'], [0.40, 12, 'ammo'], [0.65, 0, 'ammo'], [0.80, -12, 'upgrade'], [0.93, 10, 'ammo']], letter: [0.36, -22],
    },
  ];
})();
