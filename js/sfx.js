// v0.7.5 "Rift": tiny synthesized sound kit (Web Audio, no files). Everything is generated on the fly.
// Browsers only allow audio after a user gesture: unlock() is called on the first tap.
let ctx = null, master = null, muted = false, noiseBuf = null;
const last = {};

export function setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.42, ctx.currentTime, 0.02); }
export const isMuted = () => muted;
export function unlock() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.42;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 6;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
const ready = () => ctx && !muted && ctx.state === 'running';
const gap = (k, ms) => { const t = performance.now(); if (last[k] && t - last[k] < ms) return false; last[k] = t; return true; };

function tone({ f = 440, f2 = 0, type = 'sine', d = 0.12, v = 0.25, a = 0.004, at = 0, det = 0 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
}
function noise({ d = 0.15, v = 0.25, f = 1200, f2 = 0, q = 0.8, type = 'lowpass', at = 0 }) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.02);
}
const semi = (n) => Math.pow(2, n / 12);

// each dimension has its own cast voice
const VOICE = {
  fallen:  (k) => { tone({ f: 330 * k, f2: 900 * k, type: 'square', d: 0.09, v: 0.07 }); },
  martial: (k) => { noise({ d: 0.07, v: 0.22, f: 2400, type: 'bandpass', q: 1.5 }); tone({ f: 260 * k, f2: 140 * k, type: 'triangle', d: 0.1, v: 0.16 }); },
  zodiac:  (k) => { tone({ f: 880 * k, type: 'sine', d: 0.22, v: 0.09 }); tone({ f: 1320 * k, type: 'sine', d: 0.18, v: 0.05, at: 0.03 }); },
  giants:  (k) => { tone({ f: 110 * k, f2: 70 * k, type: 'sawtooth', d: 0.16, v: 0.09 }); noise({ d: 0.12, v: 0.15, f: 500 }); },
  elven:   (k) => { tone({ f: 990 * k, f2: 1480 * k, type: 'triangle', d: 0.12, v: 0.09 }); },
  necro:   (k) => { tone({ f: 150 * k, type: 'sawtooth', d: 0.14, v: 0.07, det: 25 }); tone({ f: 151 * k, type: 'square', d: 0.14, v: 0.05 }); },
  junk:    (k) => { tone({ f: 240 * k, f2: 420 * k, type: 'square', d: 0.06, v: 0.06 }); noise({ d: 0.05, v: 0.14, f: 3000, type: 'highpass', at: 0.03 }); },
  abyss:   (k) => { tone({ f: 260 * k, f2: 90 * k, type: 'sine', d: 0.25, v: 0.16 }); },
  dream:   (k) => { tone({ f: 620 * k, f2: 780 * k, type: 'triangle', d: 0.2, v: 0.08 }); tone({ f: 930 * k, type: 'sine', d: 0.2, v: 0.04, at: 0.05 }); },
  clock:   (k) => { noise({ d: 0.03, v: 0.25, f: 5000, type: 'highpass' }); tone({ f: 1800 * k, type: 'square', d: 0.03, v: 0.04 }); },
};

export const sfx = {
  tap() { if (ready() && gap('tap', 40)) tone({ f: 1400, f2: 1100, type: 'sine', d: 0.04, v: 0.06 }); },
  select() { if (ready() && gap('tap', 40)) tone({ f: 900, f2: 1300, type: 'triangle', d: 0.06, v: 0.07 }); },
  coin() { if (!ready()) return; tone({ f: 1320, type: 'square', d: 0.06, v: 0.06 }); tone({ f: 1760, type: 'square', d: 0.16, v: 0.06, at: 0.06 }); },
  buy() { if (!ready()) return; tone({ f: 660, type: 'triangle', d: 0.08, v: 0.12 }); tone({ f: 990, type: 'triangle', d: 0.14, v: 0.12, at: 0.06 }); },
  sell() { if (!ready()) return; tone({ f: 700, f2: 300, type: 'triangle', d: 0.16, v: 0.12 }); },
  drop() { if (ready()) noise({ d: 0.08, v: 0.2, f: 900, f2: 200 }); },
  reroll() { if (!ready()) return; noise({ d: 0.25, v: 0.16, f: 400, f2: 4000, type: 'bandpass', q: 2 }); for (let i = 0; i < 4; i++) tone({ f: 500 + i * 140, type: 'square', d: 0.03, v: 0.04, at: 0.04 * i }); },
  cast(dim, chain = 0) { if (!ready() || !gap('cast', 45)) return; (VOICE[dim] || VOICE.clock)(semi(Math.min(14, chain))); },
  hit(size = 0.3) { // size 0..1
    if (!ready() || !gap('hit', 55)) return;
    tone({ f: 140 + 60 * size, f2: 45, type: 'sine', d: 0.12 + size * 0.2, v: 0.18 + size * 0.3 });
    noise({ d: 0.06 + size * 0.12, v: 0.1 + size * 0.25, f: 1800 - size * 900 });
  },
  heal() { if (ready() && gap('heal', 120)) { tone({ f: 784, type: 'sine', d: 0.18, v: 0.06 }); tone({ f: 1175, type: 'sine', d: 0.22, v: 0.05, at: 0.06 }); } },
  shield() { if (ready() && gap('shield', 120)) tone({ f: 2100, f2: 1600, type: 'triangle', d: 0.12, v: 0.05 }); },
  trig(n = 0) { if (ready() && gap('trig', 60)) { const k = semi(Math.min(16, n)); tone({ f: 1046 * k, type: 'sine', d: 0.1, v: 0.08 }); tone({ f: 1568 * k, type: 'sine', d: 0.12, v: 0.05, at: 0.035 }); } },
  burn() { if (ready() && gap('dot', 220)) noise({ d: 0.18, v: 0.08, f: 900, type: 'bandpass', q: 0.7 }); },
  boom() { if (!ready()) return; tone({ f: 90, f2: 30, type: 'sine', d: 0.6, v: 0.5 }); noise({ d: 0.5, v: 0.35, f: 1200, f2: 80 }); },
  count(n) { if (ready()) tone({ f: n ? 520 : 1040, type: 'square', d: n ? 0.09 : 0.32, v: 0.07 }); },
  ko() { if (!ready()) return; tone({ f: 70, f2: 28, type: 'sine', d: 0.9, v: 0.6 }); noise({ d: 0.7, v: 0.4, f: 3000, f2: 60 }); tone({ f: 220, f2: 55, type: 'sawtooth', d: 0.5, v: 0.08 }); },
  win() { if (!ready()) return; [0, 4, 7, 12].forEach((s, i) => tone({ f: 523 * semi(s), type: 'square', d: 0.22, v: 0.06, at: 0.09 * i })); tone({ f: 523 * semi(16), type: 'triangle', d: 0.6, v: 0.08, at: 0.38 }); },
  lose() { if (!ready()) return; [7, 4, 0, -5].forEach((s, i) => tone({ f: 330 * semi(s), type: 'triangle', d: 0.26, v: 0.08, at: 0.14 * i })); },
  merge(lvl = 2) { if (!ready()) return; const n = lvl === 3 ? 7 : 5; for (let i = 0; i < n; i++) tone({ f: 392 * semi([0, 4, 7, 12, 16, 19, 24][i]), type: 'square', d: 0.18, v: 0.05, at: 0.06 * i }); noise({ d: 0.5, v: 0.08, f: 6000, type: 'highpass', at: 0.2 }); },
  gift() { if (!ready()) return; noise({ d: 0.3, v: 0.12, f: 300, f2: 3000, type: 'bandpass' }); tone({ f: 1046, type: 'sine', d: 0.3, v: 0.07, at: 0.6 }); tone({ f: 1568, type: 'sine', d: 0.4, v: 0.07, at: 0.68 }); },
  discover() { if (!ready()) return; tone({ f: 660, f2: 1320, type: 'triangle', d: 0.18, v: 0.07 }); tone({ f: 1980, type: 'sine', d: 0.3, v: 0.05, at: 0.12 }); },
  day() { if (!ready()) return; tone({ f: 196, type: 'sawtooth', d: 0.5, v: 0.05 }); tone({ f: 294, type: 'triangle', d: 0.5, v: 0.07, at: 0.05 }); noise({ d: 0.4, v: 0.08, f: 200, f2: 2000, type: 'bandpass' }); },
  sudden() { if (!ready()) return; tone({ f: 440, f2: 220, type: 'sawtooth', d: 0.5, v: 0.08 }); },
  transform() { if (!ready()) return; for (let i = 0; i < 6; i++) tone({ f: 300 * semi(i * 3), type: 'sawtooth', d: 0.08, v: 0.05, at: 0.03 * i }); },
};
