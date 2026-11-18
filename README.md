# gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zhangzzz1878/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zhangzzz1878/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a 2D top-down open-world crime game: explore a coastal city on foot and by car, with street traffic, pedestrians, car stealing, a wanted level and police pursuit, story missions, combat, and a HUD with a minimap. It runs in a desktop browser from static files — no network, no libraries, no build step.

## Run it

```sh
cd game
python3 -m http.server 8080
# open http://localhost:8080
```

A 2D top-down open-world crime game that runs in a desktop browser from static files — no network, no libraries, no build step. Plain Canvas 2D and vanilla JavaScript, with synthesized WebAudio sound.

## The story

Rico Vega is fresh out of the county lockup and owes Mama Luz — the woman who raised him — one last favour. Across four jobs in the sun-soaked coastal city of **Solmar Bay**, Rico runs errands, steals a getaway car, survives an ambush at the docks, and makes a timed airport delivery, all while the Solmar Bay PD watches. Every name, place and character is original.

## How to run

Serve the `game/` folder with any static server and open it in a desktop browser, for example:

```sh
cd game
python3 -m http.server 8080
# open http://localhost:8080
```

Or open `game/index.html` directly from disk via a static server of your choice. The game needs no network access at all.

URL parameters:

- `?seed=N` — rebuild the city deterministically from seed N.
- `?shot=start|play|drive|chase&seed=N` — stage a fixed scene (title, on foot, driving, police chase) and set `window.__shotReady = true` once it is painted. Used for screenshots.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Move on foot, drive the car |
| Shift | Run on foot |
| Mouse | Aim |
| Click | Shoot pistol |
| Space | Punch (on foot) / brake (in car) |
| E | Steal a nearby car |
| F | Exit the car |
| P / Esc | Pause |
| Enter | Start / play again |

## Features

- [x] Open city to explore on foot and by car: streets, blocks, park, beach, docks
- [x] Traffic that drives the street grid, parked cars, pedestrians on the sidewalks
- [x] Car stealing (E), arcade driving physics, car damage and wrecks
- [x] Wanted level, 0–5 stars, with foot cops and cruiser pursuit, arrest and bust
- [x] Combat: pistol shooting, punches, enemy shooters, health and ammo
- [x] Four story missions with objectives, markers, dialogue and cash rewards
- [x] HUD: health, cash, ammo, wanted stars, in-game clock, minimap, objective
- [x] Title screen, pause, game over (BUSTED / WASTED), restart
- [x] Save to localStorage (cash, progress, position) with auto-load
- [x] Synthesized WebAudio sound: engine, sirens, gunshots, pickups, jingles
- [x] Deterministic world per `?seed=N`

## Source layout

- `game/index.html` — page shell, canvas + minimap
- `game/src/main.js` — boot, game loop, state, save/load
- `game/src/config.js` — tuning constants
- `game/src/random.js` — seeded RNG
- `game/src/city.js` — city generation, collision, painting
- `game/src/player.js` — on-foot movement and drawing
- `game/src/vehicles.js` — cars, traffic AI, stealing, driving physics
- `game/src/pedestrians.js` — sidewalk crowds and fleeing
- `game/src/police.js` — wanted heat, pursuit, arrest
- `game/src/combat.js` — bullets, punches, particles
- `game/src/missions.js` — story, objectives, markers
- `game/src/hud.js` — HUD, minimap, title/pause/game-over screens
- `game/src/audio.js` — WebAudio synthesized effects
- `game/src/input.js` — keyboard + mouse
- `game/src/shots.js` — screenshot scene staging
- `main.ts` — make.fun hand-in program (copies game/ + screenshots/, writes dossier.json)
- `vendor/makefun-game.ts` — make.fun library (vendored, unchanged)

---

<sub>Entered on [make.fun](https://make.fun/?ref=4mdg389a&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
