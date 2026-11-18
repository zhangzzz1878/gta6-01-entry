// Synthesized sound, WebAudio only — no audio files, no network.
// Everything is built from oscillators and filtered noise, started lazily on
// the first user gesture (browsers block audio before that).

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenLfo = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    return false;
  }
  return true;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export const sfx = {
  shot() { noiseBurst(0.14, 0.5, 1800); blip(160, 0.1, 'square', 0.18, 60); },
  enemyShot() { noiseBurst(0.12, 0.25, 1200); },
  pickup() { blip(660, 0.09, 'sine', 0.3); setTimeout(() => blip(990, 0.14, 'sine', 0.3), 80); },
  cash() { blip(880, 0.08, 'triangle', 0.3); setTimeout(() => blip(1174, 0.08, 'triangle', 0.3), 70); setTimeout(() => blip(1568, 0.16, 'triangle', 0.3), 140); },
  crash() { noiseBurst(0.3, 0.6, 500); blip(90, 0.25, 'sawtooth', 0.3, 40); },
  horn() { blip(370, 0.18, 'square', 0.16); },
  door() { blip(220, 0.07, 'square', 0.2, 140); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.32), i * 110)); },
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.2), i * 140)); },
  click() { blip(700, 0.05, 'sine', 0.2); },
  punch() { noiseBurst(0.09, 0.4, 900); },
  busted() { [440, 415, 392, 370].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'square', 0.18), i * 160)); },
};

// Engine hum follows the player's car speed; call every frame.
export function setEngine(running, speedNorm) {
  if (!ctx || !master) return;
  if (running && !engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    engineOsc.connect(f);
    f.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }
  if (!engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(55 + speedNorm * 140, t, 0.08);
  engineGain.gain.setTargetAtTime(running ? 0.05 + speedNorm * 0.05 : 0.0, t, 0.1);
}

// Two-tone police siren while any wanted level is active.
export function setSiren(on) {
  if (!ctx || !master) return;
  if (on && !sirenOsc) {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 750;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.045;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
  } else if (!on && sirenOsc) {
    try { sirenOsc.stop(); sirenLfo.stop(); } catch { /* already stopped */ }
    sirenOsc = null;
    sirenLfo = null;
    sirenGain = null;
  }
}
