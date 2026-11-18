// Solmar Bay — shared tuning constants for the whole game.
// One place for every number a designer would want to tweak.

export const WORLD = {
  w: 3200,
  h: 2400,
  roadGap: 400, // distance between parallel street centrelines
  roadHalf: 44, // half-width of a road (asphalt)
  sidewalk: 16, // sidewalk band on each side of a road
  firstRoad: 200, // centreline of the first street
  beachY: 2240, // sand and sea start below this line
  dockX: 3020, // docks strip on the east edge
};

export const VIEW = { w: 1280, h: 720 };

export const PLAYER = {
  walkSpeed: 205,
  runSpeed: 285, // while Shift is held
  radius: 13,
  maxHp: 100,
  punchDamage: 12,
  pistolDamage: 34,
  startAmmo: 48,
  maxAmmo: 120,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 430,
  maxReverse: 140,
  turnRate: 2.6, // radians per second at full lock, scaled by speed
  drag: 0.55,
  maxHp: 100,
  stealRange: 60,
};

export const TRAFFIC = {
  count: 16,
  speedMin: 110,
  speedMax: 165,
  colors: ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#8e44ad', '#16a085', '#e67e22', '#ecf0f1', '#2c3e50', '#d35400'],
};

export const PED = {
  count: 26,
  walkMin: 32,
  walkMax: 62,
  fleeSpeed: 130,
};

export const POLICE = {
  footSpeed: 235,
  carSpeed: 470,
  arrestRange: 30,
  arrestTime: 1.4, // seconds a cop must stay in range to bust the player
  ramDamage: 9,
  spawnDistance: 620,
};

export const WANTED = {
  heatPerStar: 25,
  maxStars: 5,
  stealHeat: 26, // one full star the moment a car is taken
  hitPedHeat: 15,
  shootHeat: 8,
  killCopHeat: 30,
  killPedHeat: 20,
  decayPerSec: 1.1,
  calmSeconds: 8, // seconds without a crime before heat starts decaying
};

export const DAY = {
  startMinutes: 9 * 60 + 5, // 09:05 on the in-game clock
  minutesPerRealSecond: 1.2,
};

export const PALETTE = {
  grass: '#5da24a',
  grassDark: '#4f8f3e',
  sand: '#e8d29a',
  sea: '#2f7fb8',
  seaDeep: '#256b9e',
  asphalt: '#3a3f46',
  asphaltLine: '#e8e3c8',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  park: '#3f8f4f',
  buildingRoof: ['#b5654a', '#7a6a8f', '#4a7a8f', '#8f6a4a', '#6a8f4a', '#9a4a5a', '#5a6a7a', '#c08a3a'],
  buildingEdge: '#2f2a26',
  dock: '#7a6a55',
  marker: '#ffd23f',
};

export const SAVE_KEY = 'solmar-bay-save-v1';
