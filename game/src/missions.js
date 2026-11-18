// Story missions for Solmar Bay. Rico Vega is fresh out of the county
// lockup and owes Mama Luz — the woman who raised him — one last favour.
// Each mission is a list of steps: go somewhere, do something, get paid.
// The HUD reads the current step's text and draws the yellow marker.

export const MISSION_DEFS = [
  {
    id: 'm1',
    title: 'Mama Luz\'s Errand',
    intro: 'Mama Luz: "Rico, mi hijo. The market stall has my package. Bring it home — and stay out of trouble."',
    reward: 500,
    steps: [
      { text: 'Go to the market stall (yellow marker)', target: 'market', radius: 46 },
      { text: 'Pick up Mama Luz\'s package — walk into the marker', target: 'market', radius: 46, action: 'pickup', pickupText: 'Package collected! Take it back to Mama Luz.' },
      { text: 'Bring the package home to Mama Luz', target: 'mamaLuz', radius: 52 },
    ],
  },
  {
    id: 'm2',
    title: 'The Sunbeam Job',
    intro: 'Mama Luz: "A friend needs that yellow Sunbeam GT gone. Take it, lose the cops, and park it at the garage. No scratches, Rico."',
    reward: 1200,
    steps: [
      { text: 'Steal the yellow Sunbeam GT at the parking lot (press E)', target: 'parking', radius: 60, action: 'steal', stealColor: '#f1c40f' },
      { text: 'Lose the cops — get your wanted level to 0', target: null, action: 'loseHeat' },
      { text: 'Deliver the Sunbeam to the garage', target: 'garage', radius: 60, action: 'deliver', needCar: true },
    ],
  },
  {
    id: 'm3',
    title: 'Dockside Deal',
    intro: 'Mama Luz: "The Marin brothers are moving my crates at the docks. Go remind them who owns this bay. Bring friends? No — bring a gun."',
    reward: 2000,
    steps: [
      { text: 'Go to the docks on the east edge', target: 'docks', radius: 70, action: 'ambush' },
      { text: 'Deal with the Marin brothers (4 of them)', target: 'docks', radius: 320, action: 'clear' },
      { text: 'Collect the cash from the crate', target: 'docks', radius: 46, action: 'pickup', pickupText: 'Cash secured! $2,000 is yours.' },
    ],
  },
  {
    id: 'm4',
    title: 'Airport Run',
    intro: 'Mama Luz: "Last one, Rico. A sealed case for a pilot at the airport. Three minutes. The bay is watching — drive like it."',
    reward: 1500,
    timeLimit: 180,
    steps: [
      { text: 'Reach the airport drop-off before the timer runs out', target: 'airport', radius: 56, timer: true },
    ],
  },
];

export function makeMissions() {
  return {
    index: 0, // which mission is active
    step: 0,
    done: false,
    timer: 0,
    timerActive: false,
    objectiveText: 'Talk to Mama Luz to start',
    target: null, // {x, y, radius} or null
    enemiesSpawned: false,
    pickupAt: null,
  };
}

export function currentMission(missions) {
  return MISSION_DEFS[missions.index] ?? null;
}

export function currentStep(missions) {
  const m = currentMission(missions);
  return m ? m.steps[missions.step] : null;
}

export function startMission(G) {
  const m = currentMission(G.missions);
  if (!m) return;
  G.missions.step = 0;
  G.missions.enemiesSpawned = false;
  G.missions.timerActive = !!m.timeLimit;
  G.missions.timer = m.timeLimit || 0;
  G.say(m.intro, 6);
  G.sfxMission();
  refreshObjective(G);
}

export function refreshObjective(G) {
  const ms = G.missions;
  const m = currentMission(ms);
  if (!m) {
    ms.objectiveText = 'All jobs done — Solmar Bay is yours. Free roam!';
    ms.target = null;
    return;
  }
  const step = m.steps[ms.step];
  ms.objectiveText = `${m.title}: ${step.text}`;
  if (step.target) {
    const place = G.city.places[step.target];
    ms.target = { x: place.x, y: place.y, radius: step.radius || 50 };
  } else {
    ms.target = null;
  }
}

function advance(G) {
  const ms = G.missions;
  ms.step += 1;
  const m = currentMission(ms);
  if (ms.step >= m.steps.length) {
    completeMission(G);
    return;
  }
  refreshObjective(G);
}

function completeMission(G) {
  const ms = G.missions;
  const m = currentMission(ms);
  G.player.cash += m.reward;
  G.say(`Job done! ${m.title} — +$${m.reward}.`, 5);
  G.sfxCash();
  ms.index += 1;
  ms.step = 0;
  ms.timerActive = false;
  ms.enemiesSpawned = false;
  if (ms.index >= MISSION_DEFS.length) {
    ms.done = true;
    G.say('Every job is done. Solmar Bay is yours, Rico.', 6);
  } else {
    const next = MISSION_DEFS[ms.index];
    G.say(`New job: ${next.title}. ${next.intro}`, 6);
    startMission(G);
  }
  refreshObjective(G);
}

// Called every frame; handles arrival, timers, ambush spawns and clears.
export function updateMissions(G, dt) {
  const ms = G.missions;
  const m = currentMission(ms);
  if (!m) return;
  const step = m.steps[ms.step];
  if (!step) return;

  if (ms.timerActive) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      ms.timerActive = false;
      G.say('Too slow — the pilot left without the case. Try the job again.', 5);
      G.sfxFail();
      // Restart the mission from its first step.
      ms.step = 0;
      startMission(G);
      return;
    }
  }

  const p = G.player;
  const px = p.onFoot ? p.x : p.car.x;
  const py = p.onFoot ? p.y : p.car.y;

  if (step.action === 'ambush' && step.target) {
    const place = G.city.places[step.target];
    if (Math.hypot(px - place.x, py - place.y) < step.radius && !ms.enemiesSpawned) {
      ms.enemiesSpawned = true;
      G.spawnAmbush(place.x, place.y);
      G.say('Ambush! The Marin brothers came out shooting!', 4);
      advance(G);
    }
    return;
  }

  if (step.action === 'clear') {
    if (G.enemies.every((e) => e.dead)) {
      G.say('The docks are quiet. Grab the cash.', 3);
      advance(G);
    }
    return;
  }

  if (step.action === 'loseHeat') {
    if (G.wanted === 0) {
      G.say('Clean. Now get the car to the garage.', 3);
      advance(G);
    }
    return;
  }

  if (step.action === 'steal') {
    // Advance once Rico is driving the target car.
    if (!p.onFoot && p.car && p.car.color === step.stealColor) {
      advance(G);
    }
    return;
  }

  if (step.action === 'deliver') {
    if (!p.onFoot && step.target) {
      const place = G.city.places[step.target];
      if (Math.hypot(p.car.x - place.x, p.car.y - place.y) < step.radius) {
        advance(G);
      }
    }
    return;
  }

  // Plain arrival steps (and pickups).
  if (step.target) {
    const place = G.city.places[step.target];
    if (Math.hypot(px - place.x, py - place.y) < step.radius) {
      if (step.action === 'pickup') {
        G.sfxPickup();
        if (step.pickupText) G.say(step.pickupText, 4);
      }
      advance(G);
    }
  }
}

// Draw the pulsing yellow objective marker and a screen-edge arrow.
export function drawMissionMarker(ctx, G, cam) {
  const ms = G.missions;
  if (!ms.target) return;
  const t = ms.target;
  const pulse = 1 + Math.sin(G.now * 4) * 0.12;
  ctx.save();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,63,0.18)';
  ctx.fill();
  // Spinning beacon column so the marker is visible from far away.
  ctx.fillStyle = 'rgba(255,210,63,0.10)';
  ctx.fillRect(t.x - 3, t.y - 260, 6, 260);
  ctx.restore();
}
