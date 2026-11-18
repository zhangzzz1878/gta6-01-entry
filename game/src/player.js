// Rico Vega on foot: WASD/arrows movement, running with Shift, and the
// little top-down figure (head, shoulders, direction tick) the camera follows.

import { PLAYER } from './config.js';
import { resolveCircle } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    cash: 150,
    ammo: PLAYER.startAmmo,
    onFoot: true,
    car: null, // the car object Rico is driving, or null
    speed: 0,
    moving: false,
    lastHurtAt: 0,
    arrestTimer: 0,
    punchCooldown: 0,
  };
}

export function updatePlayerOnFoot(p, city, moveX, moveY, run, dt) {
  const len = Math.hypot(moveX, moveY);
  p.moving = len > 0.01;
  if (p.moving) {
    const sp = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.x += (moveX / len) * sp * dt;
    p.y += (moveY / len) * sp * dt;
    p.angle = Math.atan2(moveY, moveX);
    p.speed = sp;
  } else {
    p.speed = 0;
  }
  resolveCircle(city, p);
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
}

export function drawPlayer(ctx, p, aimAngle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: teal jacket, dark jeans.
  const bob = p.moving ? Math.sin(performance.now() / 90) * 1.5 : 0;
  ctx.rotate(p.angle);
  ctx.fillStyle = '#1f6f6f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b3a4a';
  ctx.fillRect(-12, -7, 8, 14);
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(6 + bob * 0.3, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(5 + bob * 0.3, 0, 7.5, Math.PI * 0.9, Math.PI * 1.9);
  ctx.fill();
  // Gun in hand when aiming (aim angle differs from facing).
  if (aimAngle !== null && aimAngle !== undefined) {
    ctx.rotate(aimAngle - p.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 12, 4);
    ctx.rotate(p.angle - aimAngle);
  }
  ctx.restore();
  // Health ring when hurt.
  if (p.hp < PLAYER.maxHp) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = p.hp > 40 ? '#4caf50' : '#e74c3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + (p.hp / PLAYER.maxHp) * Math.PI * 2);
    ctx.stroke();
  }
}
