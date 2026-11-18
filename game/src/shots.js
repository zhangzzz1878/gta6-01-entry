// Screenshot staging: ?shot=start|play|drive|chase&seed=N places the game
// in an exact, painted scene and sets window.__shotReady = true once the
// first frame is on the canvas, so a headless browser can capture it.

import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';

function placeOnRoad(G, x, y) {
  const p = G.player;
  p.x = x;
  p.y = y;
  p.onFoot = true;
  p.car = null;
  p.angle = 0;
}

export function stageStart(G) {
  G.screen = 'title';
}

export function stagePlay(G) {
  G.screen = 'play';
  // Rico on foot by the market, mid-morning, mission 1 running.
  placeOnRoad(G, G.city.places.market.x + 60, G.city.places.market.y + 40);
  G.missions.index = 0;
  G.missions.step = 0;
  startMission(G);
  G.clockMinutes = 10 * 60 + 24;
  G.player.cash = 650;
}

export function stageDrive(G) {
  G.screen = 'play';
  // Rico cruising down the main avenue in a red coupe, mission 1 running.
  // (1400, 600) is a clear stretch of the east-west avenue, away from the
  // parked cars, so the shot starts with a clean, undamaged car.
  const car = makeCar(1400, 600, 0, '#c0392b', {});
  car.speed = 320;
  G.player.car = car;
  G.player.onFoot = false;
  G.player.x = car.x;
  G.player.y = car.y;
  G.missions.index = 0;
  G.missions.step = 0;
  startMission(G);
  G.clockMinutes = 11 * 60 + 40;
  G.player.cash = 650;
}

export function stageChase(G) {
  G.screen = 'play';
  // The cover scene: Rico in the yellow Sunbeam GT, 3 stars, two cruisers
  // on his tail and a foot cop closing in, mission 2 in progress.
  const car = makeCar(1800, 1000, 0, '#f1c40f', { name: 'Sunbeam GT' });
  car.speed = 380;
  G.player.car = car;
  G.player.onFoot = false;
  G.player.x = car.x;
  G.player.y = car.y;
  G.missions.index = 1;
  G.missions.step = 1; // "lose the cops"
  startMission(G);
  // startMission begins at step 0, so rewind to step 1 and match its text.
  G.missions.step = 1;
  G.missions.timerActive = false;
  G.missions.objectiveText = 'The Sunbeam Job: Lose the cops — get your wanted level to 0';
  G.missions.target = null;
  G.heat = 76;
  G.wanted = 3;
  G.police.lastCrimeAt = G.now;
  G.clockMinutes = 17 * 60 + 5;
  G.player.cash = 1850;
  // Two cruisers right behind, one foot cop ahead on the sidewalk.
  const c1 = makeCar(1800 - 180, 1000 - 16, 0, '#1f3a5f', { cop: true, hp: 120 });
  c1.speed = 420;
  c1.targetSpeed = 470;
  const c2 = makeCar(1800 - 260, 1000 + 16, 0, '#1f3a5f', { cop: true, hp: 120 });
  c2.speed = 400;
  c2.targetSpeed = 470;
  G.police.cars.push(c1, c2);
  G.police.cops.push({
    x: 1800 + 220, y: 1000 - 58, angle: Math.PI, radius: 11,
    hp: 60, speed: 235, arrestTimer: 0, shootCooldown: 1.5, dead: false,
  });
  // A few bystanders scattering on the sidewalk.
  G.peds[0].x = 1800 + 120;
  G.peds[0].y = 1000 + 58;
  G.peds[0].fleeing = true;
  G.peds[0].fleeUntil = G.now + 10;
  G.say('Mama Luz: "Lose them, Rico — then bring the car to the garage."', 6);
}

export function stageScene(G, name) {
  if (name === 'start') stageStart(G);
  else if (name === 'play') stagePlay(G);
  else if (name === 'drive') stageDrive(G);
  else if (name === 'chase') stageChase(G);
  else stagePlay(G);
}
