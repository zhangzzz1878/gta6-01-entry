// Solmar Bay — main loop, game state, screens and save.
// Boots the world, runs the frame loop, and owns everything the modules
// need to share through the single state object G.

import { WORLD, VIEW, PLAYER, CAR, TRAFFIC, PED, DAY, SAVE_KEY, WANTED } from './config.js';
import { makeRng, range, int, pick } from './random.js';
import { buildCity, drawCity, isSolid, resolveCircle } from './city.js';
import { makePlayer, updatePlayerOnFoot, drawPlayer } from './player.js';
import {
  makeCar, spawnTraffic, spawnParked, updateTraffic, updatePlayerCar,
  collideCar, collideCars, nearestCar, drawCar,
} from './vehicles.js';
import { spawnPedestrians, updatePedestrians, drawPedestrians } from './pedestrians.js';
import {
  makePoliceState, updateWanted, updatePolice, drawPolice, addHeat,
} from './police.js';
import {
  makeCombat, updateCombat, drawCombat, playerShoot, enemyShoot,
  playerPunch, burst,
} from './combat.js';
import {
  makeMissions, startMission, updateMissions, drawMissionMarker,
} from './missions.js';
import { drawHud, drawMinimap, drawTitle, drawPaused, drawGameOver } from './hud.js';
import { initInput, keys, pressed, mouse, endFrame, axis } from './input.js';
import { ensureAudio, sfx, setEngine, setSiren } from './audio.js';
import { stageScene } from './shots.js';

const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.w;
canvas.height = VIEW.h;

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 7;
const shotName = params.get('shot');

let G = null;

function newGame() {
  const city = buildCity(seed);
  const rng = makeRng(seed + 999);
  const p = makePlayer(city.places.mamaLuz.x + 40, city.places.mamaLuz.y + 60);
  const g = {
    seed,
    rng,
    city,
    player: p,
    cars: [...spawnTraffic(city, seed, TRAFFIC.count), ...spawnParked(city, seed)],
    peds: spawnPedestrians(city, seed, PED.count),
    enemies: [],
    pickups: [],
    police: makePoliceState(),
    combat: makeCombat(),
    missions: makeMissions(),
    heat: 0,
    wanted: 0,
    now: 0,
    clockMinutes: DAY.startMinutes,
    aimAngle: 0,
    shotsFiredAt: -999,
    dialogue: '',
    dialogueUntil: 0,
    toastText: '',
    toastUntil: 0,
    nearCar: null,
    busted: false,
    wasted: false,
    carWrecked: false,
    screen: 'title',
    cam: { x: 0, y: 0, w: VIEW.w, h: VIEW.h },
    saveTimer: 0,
    shootCooldown: 0,
  };
  // Helpers the modules call back through G.
  g.toast = (text, secs) => { g.toastText = text; g.toastUntil = g.now + secs; };
  g.say = (text, secs) => { g.dialogue = text; g.dialogueUntil = g.now + secs; };
  g.sfxShot = () => sfx.shot();
  g.sfxEnemyShot = () => sfx.enemyShot();
  g.sfxPickup = () => sfx.pickup();
  g.sfxCash = () => sfx.cash();
  g.sfxCrash = () => sfx.crash();
  g.sfxMission = () => sfx.mission();
  g.sfxFail = () => sfx.fail();
  g.sfxPunch = () => sfx.punch();
  g.enemyShoot = (x, y, a, kind) => enemyShoot(g, x, y, a, kind);
  g.cashDrop = (x, y, amount) => g.pickups.push({ x, y, amount, kind: 'cash', bob: 0 });
  g.spawnAmbush = (x, y) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.enemies.push({
        x: x + Math.cos(a) * 120,
        y: y + Math.sin(a) * 110,
        angle: 0, radius: 12, hp: 70, dead: false,
        speed: 95, shootCooldown: 1 + i * 0.5,
      });
    }
  };
  return g;
}

function saveGame() {
  try {
    const p = G.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: p.cash,
      missionIndex: G.missions.index,
      ammo: p.ammo,
      hp: Math.max(20, p.hp),
      x: p.x,
      y: p.y,
      savedAt: Date.now(),
    }));
  } catch { /* storage unavailable (file://, private mode) — game still plays */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applySave(s) {
  if (!s) return;
  G.player.cash = s.cash ?? G.player.cash;
  G.player.ammo = s.ammo ?? G.player.ammo;
  G.player.hp = s.hp ?? G.player.hp;
  G.missions.index = Math.min(s.missionIndex ?? 0, 3);
  if (s.x && s.y && !isSolid(G.city, s.x, s.y)) {
    G.player.x = s.x;
    G.player.y = s.y;
  }
  G.toast('Save loaded — welcome back to Solmar Bay.', 4);
}

// ---- per-frame update ----
function update(dt) {
  G.now += dt;
  G.clockMinutes = (G.clockMinutes + DAY.minutesPerRealSecond * dt) % (24 * 60);
  const p = G.player;

  // Slow health regen when calm and unhurt for a while.
  if (G.now - p.lastHurtAt > 6 && p.hp < PLAYER.maxHp && G.wanted === 0) {
    p.hp = Math.min(PLAYER.maxHp, p.hp + 4 * dt);
  }
  if (G.shootCooldown > 0) G.shootCooldown -= dt;

  // Aim: mouse position in world space.
  const wx = G.cam.x + mouse.x;
  const wy = G.cam.y + mouse.y;
  G.aimAngle = Math.atan2(wy - p.y, wx - p.x);

  // --- player movement / driving ---
  if (p.onFoot) {
    const mx = axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight');
    const my = axis('KeyW', 'KeyS') + axis('ArrowUp', 'ArrowDown');
    updatePlayerOnFoot(p, G.city, mx, my, keys.has('ShiftLeft') || keys.has('ShiftRight'), dt);
    // Shove peds aside when running into them.
    for (const pd of G.peds) {
      if (pd.down) continue;
      const d = Math.hypot(pd.x - p.x, pd.y - p.y);
      if (d < 22 && d > 0.01) {
        pd.x += ((pd.x - p.x) / d) * 30 * dt * 4;
        pd.y += ((pd.y - p.y) / d) * 30 * dt * 4;
      }
    }
    // Find a car to steal.
    G.nearCar = nearestCar(G.cars, p.x, p.y, CAR.stealRange);
    if (pressed.has('KeyE') && G.nearCar) stealCar(G.nearCar);
    if (mouse.clicked) {
      if (G.shootCooldown <= 0) { playerShoot(G); G.shootCooldown = 0.22; }
    }
    if (pressed.has('KeyF') || pressed.has('Space')) playerPunch(G);
  } else {
    const car = p.car;
    const steer = axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight');
    const throttle = axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp');
    const brake = keys.has('Space');
    updatePlayerCar(car, steer, throttle, brake, dt);
    if (collideCar(G.city, car)) {
      if (Math.abs(car.speed) > 200) { sfx.crash(); burst(G, car.x, car.y, '#c8c8c8', 10); }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Run over pedestrians (a crime — the bay remembers).
    for (const pd of G.peds) {
      if (pd.down) continue;
      if (Math.hypot(pd.x - car.x, pd.y - car.y) < 26 && Math.abs(car.speed) > 60) {
        pd.down = true;
        pd.downUntil = G.now + 6;
        addHeat(G, 15);
        sfx.crash();
      }
    }
    // Bump traffic cars (oriented test — neighbouring-lane cars don't touch).
    for (const o of G.cars) {
      if (collideCars(car, o)) {
        if (Math.abs(car.speed) > 150 || Math.abs(o.speed) > 150) {
          car.hp -= 6;
          o.hp -= 8;
          sfx.crash();
          addHeat(G, 4);
        }
        const tmp = car.speed;
        car.speed = o.speed * 0.4;
        o.speed = tmp * 0.4;
      }
    }
    if (pressed.has('KeyF')) exitCar();
    if (car.hp <= 0) wreckPlayerCar();
  }

  // --- world life ---
  for (const c of G.cars) {
    if (c.traffic) updateTraffic(c, G.cars, G.city, dt);
    if (c.hp <= 0 && !c.wrecked) {
      c.wrecked = true;
      burst(G, c.x, c.y, '#ff8a3a', 24);
      sfx.crash();
    }
  }
  G.cars = G.cars.filter((c) => !c.wrecked || c === p.car);
  updatePedestrians(G.peds, G.city, G, dt, G.now);
  updatePolice(G, dt);
  updateWanted(G, dt);
  updateCombat(G, dt);
  updateEnemies(dt);
  updateMissions(G, dt);

  // Pickups (cash drops).
  for (const pk of G.pickups) {
    pk.bob += dt;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < 30) {
      p.cash += pk.amount;
      sfx.cash();
      G.toast(`+$${pk.amount}`, 1.5);
      pk.taken = true;
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken);

  // Ammo pickups: a green crate near the docks restocks.
  if (G.ammoCrate && !G.ammoCrate.taken) {
    const d = Math.hypot(G.ammoCrate.x - p.x, G.ammoCrate.y - p.y);
    if (d < 30) {
      p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + 36);
      G.ammoCrate.taken = true;
      sfx.pickup();
      G.toast('Ammo restocked (+36)', 2);
    }
  }

  // Game-over transitions.
  if (G.busted || G.wasted) {
    if (G.busted) sfx.busted();
    else sfx.fail();
    if (G.busted) p.cash = Math.max(0, p.cash - 200); // bail handling fee
    G.screen = 'over';
    saveGame();
  }
  if (G.carWrecked) {
    G.carWrecked = false;
    wreckPlayerCar();
  }

  // Camera follows the player, clamped to the world.
  const tx = p.x - VIEW.w / 2;
  const ty = p.y - VIEW.h / 2;
  G.cam.x = Math.max(0, Math.min(WORLD.w - VIEW.w, tx));
  G.cam.y = Math.max(0, Math.min(WORLD.h - VIEW.h, ty));

  // Audio follows state.
  const carSpeed = !p.onFoot && p.car ? Math.abs(p.car.speed) : 0;
  setEngine(carSpeed > 5, carSpeed / CAR.maxSpeed);
  setSiren(G.wanted > 0);

  // Autosave every 20 seconds of play.
  G.saveTimer += dt;
  if (G.saveTimer > 20) {
    G.saveTimer = 0;
    saveGame();
  }
}

function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const tx = p.onFoot ? p.x : p.car.x;
    const ty = p.onFoot ? p.y : p.car.y;
    const d = Math.hypot(tx - e.x, ty - e.y);
    e.angle = Math.atan2(ty - e.y, tx - e.x);
    if (d > 260) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
      resolveCircle(G.city, e);
    }
    e.shootCooldown -= dt;
    if (d < 420 && e.shootCooldown <= 0) {
      e.shootCooldown = 1.6 + G.rng() * 1.2;
      G.enemyShoot(e.x, e.y, e.angle + (G.rng() - 0.5) * 0.3, 'enemy');
    }
  }
}

function stealCar(car) {
  const p = G.player;
  G.cars = G.cars.filter((c) => c !== car);
  car.parked = false;
  car.traffic = false;
  car.speed = 0;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  sfx.door();
  addHeat(G, WANTED.stealHeat);
  G.toast(`You took the ${car.name || 'car'}. The owner will notice.`, 3);
}

function exitCar() {
  const p = G.player;
  const car = p.car;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  resolveCircle(G.city, p);
  p.car = null;
  p.onFoot = true;
  G.cars.push(car);
  sfx.door();
}

function wreckPlayerCar() {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  burst(G, car.x, car.y, '#ff8a3a', 30);
  burst(G, car.x, car.y, '#555', 20);
  sfx.crash();
  p.hp -= 20;
  p.lastHurtAt = G.now;
  p.x = car.x + 40;
  p.y = car.y + 40;
  resolveCircle(G.city, p);
  p.car = null;
  p.onFoot = true;
  G.toast('Your ride is wrecked!', 3);
  if (p.hp <= 0) G.wasted = true;
}

// ---- render ----
function render() {
  const cam = G.cam;
  // The minimap only belongs on the play/pause screens.
  minimap.style.display = (G.screen === 'play' || G.screen === 'paused') ? 'block' : 'none';
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  if (G.screen === 'title') {
    drawTitle(ctx, G);
    return;
  }
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawCity(ctx, G.city, cam);
  drawMissionMarker(ctx, G, cam);
  // Pickups.
  for (const pk of G.pickups) {
    const bobY = Math.sin(pk.bob * 5) * 3;
    ctx.fillStyle = '#7CFC98';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bobY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d5c2e';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + bobY + 4);
  }
  if (G.ammoCrate && !G.ammoCrate.taken) {
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(G.ammoCrate.x - 12, G.ammoCrate.y - 10, 24, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', G.ammoCrate.x, G.ammoCrate.y + 4);
  }
  // Cars: traffic + parked, then cop cars, then the player's car on top.
  for (const c of G.cars) drawCar(ctx, c, false);
  for (const c of G.police.cars) drawCar(ctx, c, false);
  if (!G.player.onFoot) drawCar(ctx, G.player.car, true);
  drawPedestrians(ctx, G.peds, cam);
  // Enemies (Marin brothers): red jackets, drawn like peds but armed.
  for (const e of G.enemies) {
    if (e.dead) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(e.angle);
    ctx.fillStyle = '#8b1a1a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(6, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 12, 4);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 70), 5);
  }
  drawPolice(ctx, G, cam);
  if (G.player.onFoot) drawPlayer(ctx, G.player, G.aimAngle);
  drawCombat(ctx, G);
  ctx.restore();

  // Screen-space HUD + minimap.
  if (G.screen === 'play') {
    drawHud(ctx, G);
    drawMinimap(minimap, G);
  } else if (G.screen === 'paused') {
    drawHud(ctx, G);
    drawMinimap(minimap, G);
    drawPaused(ctx);
  } else if (G.screen === 'over') {
    drawGameOver(ctx, G);
  }
}

// ---- screen transitions ----
function startPlaying() {
  ensureAudio();
  if (G.screen === 'title' || G.screen === 'over') {
    if (G.screen === 'over') {
      const keepCash = G.player.cash;
      G = newGame();
      G.player.cash = keepCash;
    }
    G.screen = 'play';
    startMission(G);
    sfx.click();
  }
}

function togglePause() {
  if (G.screen === 'play') { G.screen = 'paused'; setEngine(false, 0); setSiren(false); }
  else if (G.screen === 'paused') G.screen = 'play';
}

// ---- boot ----
// Read-only debug handle for automated playtests (does not change the game).
window.__solmar = {
  screen: () => G.screen,
  player: () => ({
    x: Math.round(G.player.x), y: Math.round(G.player.y),
    onFoot: G.player.onFoot, hp: Math.round(G.player.hp),
    cash: G.player.cash, ammo: G.player.ammo,
    carSpeed: G.player.car ? Math.round(G.player.car.speed) : 0,
  }),
  wanted: () => G.wanted,
  heat: () => Math.round(G.heat),
  mission: () => ({
    index: G.missions.index, step: G.missions.step,
    objective: G.missions.objectiveText,
    target: G.missions.target,
  }),
  counts: () => ({
    cars: G.cars.length, peds: G.peds.length,
    cops: G.police.cops.length, copCars: G.police.cars.length,
    enemies: G.enemies.filter((e) => !e.dead).length,
  }),
  carsNear: (x, y, r) => G.cars
    .filter((c) => Math.hypot(c.x - x, c.y - y) < r)
    .map((c) => ({
      x: Math.round(c.x), y: Math.round(c.y), speed: Math.round(c.speed),
      traffic: c.traffic, parked: c.parked, color: c.color,
    })),
};

function boot() {
  G = newGame();
  // Ammo crate near the docks so the dock fight is winnable.
  G.ammoCrate = { x: G.city.places.docks.x - 120, y: G.city.places.docks.y + 120, taken: false };
  const save = loadSave();
  if (save) applySave(save);
  initInput(canvas);
  G.missions.objectiveText = 'Press Enter — go see Mama Luz to start your first job';

  if (shotName) {
    stageScene(G, shotName);
    // One fixed update + render so the scene is fully painted, then signal.
    update(1 / 60);
    render();
    window.__shotReady = true;
    return;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (pressed.has('Enter')) {
      if (G.screen === 'title' || G.screen === 'over') startPlaying();
    }
    if (pressed.has('KeyP') || pressed.has('Escape')) {
      if (G.screen === 'play' || G.screen === 'paused') togglePause();
    }
    if (G.screen === 'play') update(dt);
    else if (G.screen === 'title' || G.screen === 'over') G.now += dt;
    render();
    endFrame();
  }
  requestAnimationFrame(frame);
}

boot();
