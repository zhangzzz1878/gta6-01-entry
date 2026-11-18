// HUD: health, cash, ammo, wanted stars, clock, mission objective, toasts,
// and the minimap (a separate small canvas in the corner of the page).
// Everything here is screen space; the world is drawn underneath in main.js.

import { VIEW, WORLD, PALETTE } from './config.js';

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawStars(ctx, wanted, x, y) {
  ctx.save();
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd23f' : 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const sx = x + i * 32;
    ctx.strokeText('★', sx, y);
    ctx.fillText('★', sx, y);
  }
  ctx.restore();
}

export function drawHud(ctx, G) {
  const p = G.player;
  ctx.save();

  // Top-left panel: health, cash, ammo, car health.
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  roundRect(ctx, 14, 12, 250, p.onFoot ? 92 : 118, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`RICO VEGA`, 26, 34);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(26, 44, 150, 12);
  ctx.fillStyle = p.hp > 40 ? '#4caf50' : '#e74c3c';
  ctx.fillRect(26, 44, 150 * Math.max(0, p.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${Math.ceil(Math.max(0, p.hp))} HP`, 182, 55);
  ctx.fillStyle = '#7CFC98';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 78);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  if (p.onFoot) {
    ctx.fillText(`Ammo  ${p.ammo}  •  Pistol [Click to shoot]`, 26, 96);
  } else {
    ctx.fillText(`CAR  ${Math.ceil(Math.max(0, p.car.hp))} HP`, 26, 96);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(26, 104, 150, 10);
    ctx.fillStyle = p.car.hp > 40 ? '#4caf50' : '#e74c3c';
    ctx.fillRect(26, 104, 150 * Math.max(0, p.car.hp / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`[F] exit car`, 182, 113);
  }

  // Top-centre: wanted stars + clock.
  drawStars(ctx, G.wanted, VIEW.w / 2 - 78, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(formatClock(G.clockMinutes), VIEW.w / 2, 62);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('SOLMAR BAY', VIEW.w / 2, 80);

  // Mission timer.
  if (G.missions.timerActive) {
    const t = Math.max(0, G.missions.timer);
    const mm = Math.floor(t / 60);
    const ss = Math.floor(t % 60);
    ctx.fillStyle = t < 30 ? '#ff5a5a' : '#ffd23f';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, VIEW.w / 2, 112);
  }

  // Bottom-left: current objective.
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.textAlign = 'left';
  let objFont = 14;
  ctx.font = `bold ${objFont}px sans-serif`;
  let objText = '★ ' + G.missions.objectiveText;
  while (ctx.measureText(objText).width > 560 - 28 && objFont > 11) {
    objFont -= 1;
    ctx.font = `bold ${objFont}px sans-serif`;
  }
  while (ctx.measureText(objText).width > 560 - 28) {
    objText = objText.slice(0, -2) + '…';
  }
  const w = Math.min(560, ctx.measureText(objText).width + 28);
  roundRect(ctx, 14, VIEW.h - 52, w, 38, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(objText, 26, VIEW.h - 27);

  // Bottom-right: controls hint.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  roundRect(ctx, VIEW.w - 318, VIEW.h - 52, 304, 38, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive • E steal car • F exit • Click shoot • P pause', VIEW.w - 26, VIEW.h - 27);
  ctx.textAlign = 'left';

  // Dialogue / toast banner.
  if (G.dialogue && G.now < G.dialogueUntil) {
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    const lines = wrapText(ctx, G.dialogue, 640);
    const h = lines.length * 20 + 20;
    roundRect(ctx, VIEW.w / 2 - 340, 128, 680, h, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, VIEW.w / 2, 128 + 26 + i * 20));
    ctx.textAlign = 'left';
  } else if (G.toastText && G.now < G.toastUntil) {
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(G.toastText).width + 32;
    roundRect(ctx, VIEW.w / 2 - tw / 2, 128, tw, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.toastText, VIEW.w / 2, 151);
    ctx.textAlign = 'left';
  }

  // "Press E" prompt when a car is in stealing range.
  if (G.nearCar && G.player.onFoot) {
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    const label = `Press E to steal the ${G.nearCar.name || 'car'}`;
    ctx.font = 'bold 15px sans-serif';
    const lw = ctx.measureText(label).width + 28;
    roundRect(ctx, VIEW.w / 2 - lw / 2, VIEW.h - 108, lw, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW.w / 2, VIEW.h - 84);
    ctx.textAlign = 'left';
  }

  // Vignette flash when hurt.
  if (G.now - G.player.lastHurtAt < 0.25) {
    ctx.fillStyle = 'rgba(231,76,60,0.22)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- minimap: the whole city shrunk onto the small corner canvas ----
export function drawMinimap(canvas, G) {
  const ctx = canvas.getContext('2d');
  const mw = canvas.width;
  const mh = canvas.height;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.clearRect(0, 0, mw, mh);
  ctx.fillStyle = 'rgba(10,16,12,0.85)';
  ctx.fillRect(0, 0, mw, mh);
  ctx.fillStyle = '#3f6f37';
  ctx.fillRect(0, 0, mw, mh);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(0, WORLD.beachY * sy, mw, mh - WORLD.beachY * sy);
  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 2;
  for (const rx of G.city.roads.v) {
    ctx.beginPath();
    ctx.moveTo(rx * sx, 0);
    ctx.lineTo(rx * sx, mh);
    ctx.stroke();
  }
  for (const ry of G.city.roads.h) {
    ctx.beginPath();
    ctx.moveTo(0, ry * sy);
    ctx.lineTo(mw, ry * sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#c8c8c8';
  for (const b of G.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // Objective marker.
  if (G.missions.target) {
    const t = G.missions.target;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(t.x * sx, t.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x * sx, t.y * sy, 8 + Math.sin(G.now * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Cop blips.
  ctx.fillStyle = '#4da3ff';
  for (const c of G.police.cops) {
    ctx.beginPath();
    ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of G.police.cars) {
    ctx.beginPath();
    ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = G.player;
  const px = p.onFoot ? p.x : p.car.x;
  const py = p.onFoot ? p.y : p.car.y;
  const pa = p.onFoot ? p.angle : p.car.angle;
  ctx.save();
  ctx.translate(px * sx, py * sy);
  ctx.rotate(pa);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);
}

// ---- title / pause / game-over screens, painted on the main canvas ----
export function drawTitle(ctx, G) {
  ctx.save();
  // Sunset gradient sky over a painted city silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, '#1b2a4a');
  grad.addColorStop(0.45, '#c65a3a');
  grad.addColorStop(0.75, '#e8a04c');
  grad.addColorStop(1, '#2a1a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(VIEW.w * 0.72, 190, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,16,28,0.9)';
  const base = 560;
  const rngHeights = [120, 200, 150, 260, 180, 230, 140, 300, 170, 210, 130, 240];
  let bx = 0;
  rngHeights.forEach((hh, i) => {
    const bw = 110;
    ctx.fillRect(bx, base - hh, bw - 8, hh);
    ctx.fillStyle = 'rgba(255,210,63,0.75)';
    for (let wy = base - hh + 16; wy < base - 20; wy += 26) {
      for (let wx = bx + 12; wx < bx + bw - 20; wx += 22) {
        if ((wx + wy + i) % 3 === 0) ctx.fillRect(wx, wy, 8, 10);
      }
    }
    ctx.fillStyle = 'rgba(20,16,28,0.9)';
    bx += bw;
  });
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, base, VIEW.w, VIEW.h - base);
  // Road with a car silhouette.
  ctx.fillStyle = '#3a3f46';
  ctx.fillRect(0, base + 40, VIEW.w, 60);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(180, base + 52, 120, 30);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(210, base + 84, 12, 0, Math.PI * 2);
  ctx.arc(270, base + 84, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLMAR BAY', VIEW.w / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('a sun-soaked story of debts, fast cars and second chances', VIEW.w / 2, 196);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Rico Vega owes Mama Luz one last favour. The whole bay is watching.', VIEW.w / 2, 250);
  const blink = Math.floor(G.now * 1.6) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('PRESS ENTER TO START', VIEW.w / 2, 330);
  }
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('WASD move / drive  •  E steal car  •  F exit car  •  Mouse aim, Click shoot  •  P pause', VIEW.w / 2, 380);
  ctx.fillText('Steal cars, dodge the Solmar Bay PD, finish Mama Luz\'s four jobs — or just cruise the coast.', VIEW.w / 2, 406);
  ctx.fillText('An original game. No real city, person or brand appears in it.', VIEW.w / 2, 690);
  ctx.restore();
}

export function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText('PAUSED', VIEW.w / 2, 320);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P or Esc to keep playing', VIEW.w / 2, 370);
  ctx.restore();
}

export function drawGameOver(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.78)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = G.busted ? '#4da3ff' : '#ff5a5a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(G.busted ? 'BUSTED!' : 'WASTED', VIEW.w / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(
    G.busted
      ? 'The Solmar Bay PD caught Rico. Mama Luz posted bail — minus a little handling fee.'
      : 'Rico went down in Solmar Bay. The bay keeps its secrets.',
    VIEW.w / 2, 350,
  );
  ctx.fillText(`Cash kept: $${G.player.cash.toLocaleString('en-US')}  •  Jobs finished: ${G.missions.index} / 4`, VIEW.w / 2, 390);
  const blink = Math.floor(G.now * 1.6) % 2 === 0;
  if (blink) {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', VIEW.w / 2, 450);
  }
  ctx.restore();
}
