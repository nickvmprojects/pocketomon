// Procedural mon art v2: every type has its own body families (2-3 silhouettes each),
// with per-mon colour shifts, faces and tier flourishes. Stable per mon id.
import { MON, TYPES } from './data.js?v=0.6';
import { makeRng, hash } from './rng.js?v=0.6';

const INK = '#1b1424';
const cache = new Map();
const f1 = (n) => Math.round(n * 10) / 10;

function mix(hex, to, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
const poly = (pts) => 'M' + pts.map(p => `${f1(p[0])},${f1(p[1])}`).join(' L') + 'Z';
// smooth closed curve through points
function smooth(pts) {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) { const l = pts[n - 1]; d += `M${f1((l[0] + p[0]) / 2)},${f1((l[1] + p[1]) / 2)}`; }
    d += ` Q${f1(p[0])},${f1(p[1])} ${f1(m[0])},${f1(m[1])}`;
  }
  return d + 'Z';
}
const S = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" ${extra}/>`;
const C = (x, y, r, fill, extra = '') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${fill}" stroke="${INK}" stroke-width="1.6" ${extra}/>`;
const E = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}" stroke="${INK}" stroke-width="1.6" ${extra}/>`;
const N = (d, stroke, w = 1.4) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// flame outline: base centre (x, by), width w, height h, k tips
function flamePath(x, by, w, h, k, r) {
  const pts = [[x + w / 2, by - h * 0.25], [x + w * 0.35, by], [x - w * 0.35, by], [x - w / 2, by - h * 0.25]];
  for (let i = 0; i < k; i++) {
    const t = i / (k - 1 || 1);
    const tx = x - w * 0.45 + w * 0.9 * t;
    const th = h * (i === Math.floor(k / 2) ? 1 : 0.62 + r() * 0.25);
    pts.push([tx - w * 0.08, by - th * 0.55], [tx, by - th]);
  }
  return smooth(pts);
}

// ------------------------------------------------------------------ body families
// each returns { parts: [...svg], face: {x, y, s}, top: y of head top, plus face flags }
const BODIES = {
  fire: [
    (c) => { // living flame
      const { r, dk } = c;
      const w = 26 + r() * 6, h = 34 + r() * 6;
      return { parts: [S(flamePath(32, 54, w, h, 3, r), `url(#g${c.uid})`), `<path d="${flamePath(32, 52, w * 0.55, h * 0.6, 2, r)}" fill="#fff07a" opacity="0.85"/>`, E(32, 53, w * 0.3, 3.5, dk)], face: { x: 32, y: 41, s: 1 }, top: 54 - h * 0.7 };
    },
    (c) => { // salamander
      const { r, dk } = c;
      return { parts: [
        N('M40,48 Q54,50 55,38 Q55,30 49,31', INK, 5.5), N('M40,48 Q54,50 55,38 Q55,30 49,31', c.col, 3.2),
        `<path d="${flamePath(49, 33, 9, 14, 3, r)}" fill="#ffb02e" stroke="${INK}" stroke-width="1.4"/>`,
        E(30, 46, 15, 9, `url(#g${c.uid})`), E(24, 54, 3.5, 2.5, dk), E(36, 54, 3.5, 2.5, dk),
        `<path d="${flamePath(22, 27, 12, 14, 3, r)}" fill="#ffb02e" stroke="${INK}" stroke-width="1.4"/>`,
        C(22, 35, 11, `url(#g${c.uid})`),
      ], face: { x: 22, y: 35, s: 0.85 }, top: 22 };
    },
    (c) => { // sun ball with flame mane
      const { r } = c; const n = 9 + r.int(4), pts = [];
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? 15 : 22 + r() * 3; pts.push([32 + Math.cos(a) * rr, 38 + Math.sin(a) * rr]); }
      return { parts: [S(poly(pts), '#ffb02e'), C(32, 38, 14, `url(#g${c.uid})`)], face: { x: 32, y: 38, s: 0.95 }, top: 18 };
    },
  ],
  water: [
    (c) => { // fish
      const { r, dk, lt } = c; const fl = 28 + r() * 6;
      return { parts: [
        S('M44,40 L58,30 Q55,40 58,50Z', lt),
        S(`M${f1(32 - fl / 2 + 6)},29 Q30,${f1(16 - r() * 4)} 40,28Z`, lt),
        S(smooth([[32 - fl / 2, 40], [32, 26], [46, 36], [46, 44], [32, 54]]), `url(#g${c.uid})`),
        N('M37,33 Q39,40 37,47', dk, 1.4),
      ], face: { x: 26, y: 39, s: 0.85 }, top: 26 };
    },
    (c) => { // droplet
      const { r, lt } = c; const h = 32 + r() * 6;
      return { parts: [
        S(`M32,${f1(56 - h)} Q${f1(45 + r() * 3)},${f1(56 - h * 0.45)} 45,45 Q45,57 32,57 Q19,57 19,45 Q${f1(19 - r() * 3)},${f1(56 - h * 0.45)} 32,${f1(56 - h)}Z`, `url(#g${c.uid})`),
        N('M22,50 Q27,53 32,50 Q37,47 42,50', lt, 1.6),
      ], face: { x: 32, y: 43, s: 0.95 }, top: 56 - h };
    },
    (c) => { // seal blob with flippers
      const { dk, lt } = c;
      return { parts: [
        S('M18,46 Q8,48 10,54 Q16,54 20,50Z', dk), S('M46,46 Q56,48 54,54 Q48,54 44,50Z', dk),
        S(smooth([[32, 22], [46, 32], [48, 50], [32, 57], [16, 50], [18, 32]]), `url(#g${c.uid})`),
        `<ellipse cx="32" cy="48" rx="9" ry="6" fill="${lt}" opacity="0.8"/>`,
        `<g fill="${INK}"><circle cx="27" cy="40" r="0.7"/><circle cx="37" cy="40" r="0.7"/><circle cx="26" cy="42" r="0.7"/><circle cx="38" cy="42" r="0.7"/></g>`,
      ], face: { x: 32, y: 34, s: 0.95 }, top: 22 };
    },
  ],
  grass: [
    (c) => { // turnip bulb with big leaves
      const { r } = c; const n = 2 + r.int(2), parts = [];
      for (let i = 0; i < n; i++) { const a = -35 + (70 / (n - 1)) * i; parts.push(`<g transform="rotate(${a} 32 28)">${S('M32,28 Q22,14 32,4 Q42,14 32,28Z', '#7be26f')}${N('M32,26 L32,8', '#3d9a3a', 1.2)}</g>`); }
      parts.push(S(smooth([[32, 24], [47, 36], [42, 52], [32, 58], [22, 52], [17, 36]]), `url(#g${c.uid})`), N('M32,57 Q31,60 33,62', INK, 1.4));
      return { parts, face: { x: 32, y: 40, s: 1 }, top: 6 };
    },
    (c) => { // flower
      const { r } = c; const n = 5 + r.int(4), parts = [];
      const pc = r.pick(['#ff8fc8', '#ffe36b', '#ffffff', '#ffa94d', '#c77dff']);
      parts.push(N('M28,48 L26,58', INK, 2.5), N('M36,48 L38,58', INK, 2.5));
      for (let i = 0; i < n; i++) parts.push(`<g transform="rotate(${f1(i / n * 360)} 32 36)">${E(32, 21, 6, 9, pc)}</g>`);
      parts.push(C(32, 36, 13, `url(#g${c.uid})`));
      return { parts, face: { x: 32, y: 36, s: 0.9 }, top: 12 };
    },
    (c) => { // stump treant
      return { parts: [
        S('M18,36 L8,28 L11,26 L19,32Z', '#8a5a34'), S('M46,36 L56,26 L58,29 L45,40Z', '#8a5a34'),
        S('M19,26 L45,26 L47,57 L17,57Z', '#9a6a3f'), E(32, 26, 13, 4.5, '#d9b27c'), `<ellipse cx="32" cy="26" rx="7" ry="2.2" fill="none" stroke="#9a6a3f" stroke-width="1"/>`,
        N('M22,40 L22,52 M42,38 L42,50', '#5a3a1f', 1.4),
        C(22, 18, 6, `url(#g${c.uid})`), C(42, 18, 6, `url(#g${c.uid})`), C(32, 14, 7.5, `url(#g${c.uid})`),
      ], face: { x: 32, y: 40, s: 0.95 }, top: 7 };
    },
  ],
  electric: [
    (c) => { // battery
      const { r } = c; const bars = 1 + r.int(3);
      const parts = [S('M28,16 L36,16 L36,21 L28,21Z', '#d0d0d0'), `<rect x="17" y="20" width="30" height="37" rx="6" fill="url(#g${c.uid})" stroke="${INK}" stroke-width="1.8"/>`];
      for (let i = 0; i < bars; i++) parts.push(`<rect x="21" y="${50 - i * 5}" width="22" height="3.2" rx="1" fill="${INK}" opacity="0.35"/>`);
      parts.push(`<path d="M50,30 L56,24 L53,32 L59,30 L50,42 L53,34 L48,35Z" fill="#fff07a" stroke="${INK}" stroke-width="1.2"/>`);
      return { parts, face: { x: 32, y: 32, s: 0.95 }, top: 16 };
    },
    (c) => { // spark star
      const { r } = c; const n = 7 + r.int(4), pts = [];
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 13 : 22 + r() * 4; pts.push([32 + Math.cos(a) * rr, 37 + Math.sin(a) * rr]); }
      return { parts: [S(poly(pts), `url(#g${c.uid})`), `<circle cx="32" cy="37" r="10" fill="${c.lt}" opacity="0.6"/>`], face: { x: 32, y: 38, s: 0.9 }, top: 14 };
    },
    (c) => { // bolt critter (zigzag ears + bolt tail)
      const parts = [];
      for (const s of [-1, 1]) parts.push(S(`M${32 + s * 6},28 L${32 + s * 15},8 L${32 + s * 11},20 L${32 + s * 16},18 L${32 + s * 12},30Z`, c.col), `<path d="M${32 + s * 15},8 L${32 + s * 13.2},14 L${32 + s * 15.6},13Z" fill="${INK}"/>`);
      parts.push(S('M44,46 L52,40 L49,38 L58,28 L52,30 L55,26 L45,36 L48,38 L42,43Z', c.col));
      parts.push(S(smooth([[32, 24], [47, 34], [46, 52], [32, 57], [18, 52], [17, 34]]), `url(#g${c.uid})`));
      for (const s of [-1, 1]) parts.push(`<circle cx="${32 + s * 10}" cy="45" r="3" fill="#ff5a5a" opacity="0.75"/>`);
      return { parts, face: { x: 32, y: 39, s: 1 }, top: 10 };
    },
  ],
  ice: [
    (c) => { // faceted crystal
      const { r } = c; const w = 15 + r() * 3, top = 10 + r() * 6;
      const pts = [[32, top], [32 + w, 30], [32 + w * 0.8, 50], [32, 57], [32 - w * 0.8, 50], [32 - w, 30]];
      return { parts: [S(poly(pts), `url(#g${c.uid})`), N(`M32,${f1(top)} L28,30 L32,57 M28,30 L${f1(32 - w)},30 M28,30 L${f1(32 + w)},30 M${f1(32 + w * 0.8)},50 L28,30`, '#ffffff', 1), `<path d="M${f1(32 - w * 0.6)},33 L${f1(32 - w * 0.3)},31 L${f1(32 - w * 0.4)},44Z" fill="#fff" opacity="0.5"/>`], face: { x: 32, y: 41, s: 0.85 }, top };
    },
    (c) => { // yeti / snow fluff
      const parts = [];
      const fluff = (cx, cy, rad, k) => { const p = []; for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; p.push([cx + Math.cos(a) * rad * (i % 2 ? 0.88 : 1.05), cy + Math.sin(a) * rad * (i % 2 ? 0.88 : 1.05)]); } return smooth(p); };
      for (const s of [-1, 1]) parts.push(S(`M${32 + s * 7},20 L${32 + s * 10},6 L${32 + s * 12},21Z`, '#e6fbff'));
      parts.push(S(fluff(32, 46, 13, 16), `url(#g${c.uid})`), S(fluff(32, 27, 11, 14), `url(#g${c.uid})`));
      parts.push(`<g fill="${INK}"><circle cx="32" cy="43" r="1.3"/><circle cx="32" cy="49" r="1.3"/></g>`);
      return { parts, face: { x: 32, y: 28, s: 0.85 }, top: 8 };
    },
    (c) => { // icicle ghost (wide top, pointy bottom)
      return { parts: [
        S('M14,26 Q14,14 32,14 Q50,14 50,26 L44,40 L40,36 L36,54 L32,44 L28,52 L24,38 L20,42Z', `url(#g${c.uid})`),
        N('M18,22 Q24,17 30,18', '#ffffff', 1.4),
      ], face: { x: 32, y: 26, s: 0.95 }, top: 14 };
    },
  ],
  rock: [
    (c) => { // boulder
      const { r, dk } = c; const pts = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + r() * 0.3, rr = 17 + r() * 5; pts.push([32 + Math.cos(a) * rr * 1.05, 40 + Math.sin(a) * rr * 0.85]); }
      return { parts: [S(poly(pts), `url(#g${c.uid})`), N(`M${f1(18 + r() * 4)},44 l5,2 l3,-4 l4,3`, dk, 1.4), N(`M40,${f1(30 + r() * 4)} l4,4 l-2,4`, dk, 1.3)], face: { x: 32, y: 38, s: 0.95 }, top: 23 };
    },
    (c) => { // golem
      const { dk } = c; const jag = (x, y, w, h) => poly([[x - w / 2, y - h / 2 + 2], [x - w / 4, y - h / 2], [x + w / 2, y - h / 2 + 1], [x + w / 2 + 1, y + h / 2 - 2], [x + w / 4, y + h / 2], [x - w / 2, y + h / 2]]);
      return { parts: [
        S(jag(12, 44, 9, 10), dk), S(jag(52, 44, 9, 10), dk),
        S(jag(22, 56, 8, 5), dk), S(jag(42, 56, 8, 5), dk),
        S(jag(32, 44, 26, 22), `url(#g${c.uid})`), S(jag(32, 24, 18, 15), `url(#g${c.uid})`),
        `<path d="M26,46 l3,-3 l3,3 l3,-3 l3,3" stroke="#ff9a3d" stroke-width="1.6" fill="none"/>`,
      ], face: { x: 32, y: 24, s: 0.8 }, top: 16 };
    },
    (c) => { // geode (open top with crystals)
      const { r } = c; const gem = r.pick(['#c77dff', '#5fd0ff', '#ff6fa8', '#7be26f']);
      const parts = [];
      for (let i = 0; i < 4; i++) { const x = 22 + i * 6.5, h = 10 + r() * 8; parts.push(S(poly([[x - 3, 32], [x, 32 - h], [x + 3, 32]]), gem)); }
      parts.push(S(smooth([[14, 32], [50, 32], [50, 48], [32, 58], [14, 48]]), `url(#g${c.uid})`), E(32, 33, 18, 3, mix(gem, '#000000', 0.4)));
      return { parts, face: { x: 32, y: 44, s: 0.9 }, top: 16 };
    },
  ],
  poison: [
    (c) => { // slime with drips
      const { r, lt } = c; const parts = [];
      parts.push(`<ellipse cx="32" cy="58" rx="18" ry="3" fill="${c.dk}" opacity="0.7"/>`);
      parts.push(S('M13,56 Q12,24 32,22 Q52,24 51,56 Q47,52 44,58 Q41,62 39,56 Q35,52 32,57 Q28,62 25,55 Q20,52 18,57Z', `url(#g${c.uid})`));
      for (let i = 0; i < 3; i++) parts.push(C(20 + r() * 24, 27 + r() * 8, 1.5 + r() * 1.5, lt, 'stroke-width="0.8"'));
      return { parts, face: { x: 32, y: 41, s: 1 }, top: 22 };
    },
    (c) => { // mushroom
      const { r } = c; const cap = r.pick([c.col, '#ff5a6e', '#7a5cff']);
      const parts = [S('M22,36 L42,36 L44,57 L20,57Z', '#f3e7c9'), S('M8,36 Q10,12 32,12 Q54,12 56,36 Q32,42 8,36Z', cap)];
      for (let i = 0; i < 5; i++) parts.push(`<circle cx="${f1(16 + r() * 32)}" cy="${f1(19 + r() * 12)}" r="${f1(1.6 + r() * 2)}" fill="#fff" opacity="0.85"/>`);
      return { parts, face: { x: 32, y: 47, s: 0.8 }, top: 12 };
    },
    (c) => { // sludge serpent
      const { lt } = c;
      return { parts: [
        S('M10,56 Q8,46 18,46 Q28,46 28,52 Q28,58 40,56 Q50,54 46,44 Q44,36 36,34 L36,30 Q50,30 52,44 Q55,60 38,61 Q22,62 20,54 Q18,52 14,56Z', `url(#g${c.uid})`),
        S(smooth([[36, 16], [48, 22], [46, 36], [34, 38], [26, 30], [26, 20]]), `url(#g${c.uid})`),
        `<path d="M40,37 L41,42 L43,37Z" fill="#fff" stroke="${INK}" stroke-width="0.8"/>`, `<path d="M44,61 q1,2 0,3" stroke="${lt}" stroke-width="2.4" fill="none"/>`,
      ], face: { x: 36, y: 27, s: 0.8 }, top: 16 };
    },
  ],
  psychic: [
    (c) => { // jellyfish
      const { r } = c; const parts = [];
      for (let i = 0; i < 5; i++) { const x = 20 + i * 6; parts.push(N(`M${x},40 q${f1(3 - r() * 6)},6 0,10 q${f1(3 - r() * 6)},5 ${f1(2 - r() * 4)},8`, c.dk, 2)); }
      parts.push(S('M12,40 Q12,14 32,14 Q52,14 52,40 Q47,37 42,41 Q37,37 32,41 Q27,37 22,41 Q17,37 12,40Z', `url(#g${c.uid})`), `<path d="M18,28 Q20,20 28,18" stroke="#fff" stroke-width="1.6" fill="none" opacity="0.7"/>`);
      return { parts, face: { x: 32, y: 30, s: 0.9 }, top: 14 };
    },
    (c) => { // cyclops orb with ring
      const { r } = c; const tilt = f1(-20 + r() * 40);
      return { parts: [
        `<ellipse cx="32" cy="38" rx="25" ry="6" fill="none" stroke="${INK}" stroke-width="3.6" transform="rotate(${tilt} 32 38)"/>`,
        `<ellipse cx="32" cy="38" rx="25" ry="6" fill="none" stroke="#ffe36b" stroke-width="2" transform="rotate(${tilt} 32 38)"/>`,
        C(32, 38, 15, `url(#g${c.uid})`),
        `<path d="M7,38 A25,6 0 0,0 57,38" fill="none" stroke="${INK}" stroke-width="3.6" transform="rotate(${tilt} 32 38)"/>`,
        `<path d="M7,38 A25,6 0 0,0 57,38" fill="none" stroke="#ffe36b" stroke-width="2" transform="rotate(${tilt} 32 38)"/>`,
      ], face: { x: 32, y: 36, s: 1 }, top: 23, eyes: 1, noMouth: true };
    },
    (c) => { // brain head
      return { parts: [
        S(smooth([[32, 34], [44, 40], [42, 56], [32, 58], [22, 56], [20, 40]]), `url(#g${c.uid})`),
        S(smooth([[14, 26], [20, 12], [32, 9], [44, 12], [50, 26], [44, 34], [32, 36], [20, 34]]), '#ffb3d9'),
        N('M32,10 L32,35 M20,18 q5,4 0,8 q-4,3 2,7 M44,18 q-5,4 0,8 q4,3 -2,7 M26,12 q3,5 -1,9', '#c45a96', 1.3),
      ], face: { x: 32, y: 45, s: 0.8 }, top: 9 };
    },
  ],
  ghost: [
    (c) => { // sheet ghost
      const { r } = c; const w = 15 + r() * 3;
      return { parts: [
        N(`M${f1(32 - w)},36 Q${f1(32 - w - 7)},34 ${f1(32 - w - 6)},28`, INK, 2), N(`M${f1(32 + w)},36 Q${f1(32 + w + 7)},34 ${f1(32 + w + 6)},28`, INK, 2),
        S(`M${f1(32 - w)},34 Q${f1(32 - w)},14 32,14 Q${f1(32 + w)},14 ${f1(32 + w)},34 L${f1(32 + w)},52 Q${f1(32 + w * 0.66)},46 ${f1(32 + w * 0.33)},52 Q32,46 ${f1(32 - w * 0.33)},52 Q${f1(32 - w * 0.66)},46 ${f1(32 - w)},52Z`, `url(#g${c.uid})`, 'opacity="0.93"'),
      ], face: { x: 32, y: 30, s: 1 }, top: 14, hollow: true, float: true };
    },
    (c) => { // wisp with curling tail
      const { lt } = c;
      return { parts: [S('M32,14 Q48,14 47,30 Q46,42 36,46 Q30,50 36,56 Q44,60 40,62 Q24,60 22,48 Q16,40 17,30 Q18,14 32,14Z', `url(#g${c.uid})`, 'opacity="0.92"'), `<circle cx="47" cy="20" r="1.4" fill="${lt}"/><circle cx="15" cy="46" r="1.1" fill="${lt}"/>`], face: { x: 32, y: 30, s: 0.95 }, top: 14, hollow: true, float: true };
    },
    (c) => { // hooded shade
      return { parts: [
        S('M32,6 Q46,18 48,32 Q50,46 46,58 L40,52 L36,58 L32,52 L28,58 L24,52 L18,58 Q14,46 16,32 Q18,18 32,6Z', `url(#g${c.uid})`),
        S(smooth([[32, 20], [41, 26], [41, 38], [32, 42], [23, 38], [23, 26]]), '#120c1e'),
      ], face: { x: 32, y: 31, s: 0.8 }, top: 6, hollow: true, glow: true };
    },
  ],
  junk: [
    (c) => { // trash can
      const { r, dk } = c;
      const parts = [S('M18,26 L46,26 L43,57 L21,57Z', `url(#g${c.uid})`)];
      for (let i = 0; i < 3; i++) parts.push(N(`M${24 + i * 8},31 L${f1(24.5 + i * 7.6)},53`, dk, 1.4));
      const tilt = f1(-10 + r() * 8);
      parts.push(`<g transform="rotate(${tilt} 32 26)">${S('M15,26 Q32,18 49,26 L49,28 L15,28Z', '#b9bcc4')}${C(32, 20.5, 2.4, '#b9bcc4')}</g>`);
      parts.push(`<path d="M45,24 q4,-4 7,0" stroke="#7a8a3a" stroke-width="2" fill="none"/>`);
      return { parts, face: { x: 32, y: 39, s: 0.9 }, top: 18 };
    },
    (c) => { // robot
      const { dk } = c;
      return { parts: [
        N('M32,16 L32,8', INK, 1.6), C(32, 7, 2.6, '#ff5a5a'),
        C(20, 57, 4, '#555'), C(44, 57, 4, '#555'),
        S('M14,34 L6,40 L8,43 L14,39Z', dk), S('M50,34 L58,40 L56,43 L50,39Z', dk),
        `<rect x="14" y="16" width="36" height="38" rx="5" fill="url(#g${c.uid})" stroke="${INK}" stroke-width="1.8"/>`,
        `<rect x="20" y="22" width="24" height="16" rx="3" fill="#cfe9ff" stroke="${INK}" stroke-width="1.2"/>`,
        `<g fill="${INK}"><circle cx="17.5" cy="19.5" r="1"/><circle cx="46.5" cy="19.5" r="1"/><circle cx="17.5" cy="50.5" r="1"/><circle cx="46.5" cy="50.5" r="1"/></g>`,
        `<rect x="24" y="43" width="16" height="6" rx="1" fill="${dk}" stroke="${INK}" stroke-width="1"/>`,
      ], face: { x: 32, y: 32, s: 0.8 }, top: 8, noMouth: true };
    },
    (c) => { // crumpled tin can
      const { r, lt } = c; const lab = r.pick(['#ff5a5a', '#3fa9ff', '#ffd83d']);
      return { parts: [
        S('M19,24 L45,22 L46,30 L43,34 L46,40 L44,57 L20,57 L18,44 L21,38 L18,32Z', `url(#g${c.uid})`),
        `<path d="M19.5,34 L45,33 L45.5,44 L19,45Z" fill="${lab}" opacity="0.85"/>`,
        E(32, 23, 13, 3, lt), `<path d="M34,22 q4,-6 8,-2" stroke="${INK}" stroke-width="1.4" fill="#ddd"/>`,
      ], face: { x: 32, y: 38, s: 0.85 }, top: 18 };
    },
  ],
  sound: [
    (c) => { // speaker cabinet
      const { dk, lt } = c;
      return { parts: [
        `<rect x="15" y="14" width="34" height="44" rx="5" fill="url(#g${c.uid})" stroke="${INK}" stroke-width="1.8"/>`,
        C(32, 46, 9, dk), C(32, 46, 5, lt), C(32, 46, 1.8, INK),
        C(32, 26, 9.5, '#2a2238'),
      ], face: { x: 32, y: 27, s: 0.75 }, top: 14, eyesLight: true, noMouth: true };
    },
    (c) => { // drum
      return { parts: [
        N('M18,12 L25,27', '#c99a5a', 3), N('M46,12 L39,27', '#c99a5a', 3), C(18, 11, 2.6, '#f3e7c9'), C(46, 11, 2.6, '#f3e7c9'),
        S('M14,30 L50,30 L50,52 Q32,58 14,52Z', `url(#g${c.uid})`), E(32, 30, 18, 5, '#f3e7c9'),
        N('M14,36 L22,48 L30,36 L38,48 L46,36 L50,40', '#ffd54a', 1.6),
      ], face: { x: 32, y: 41, s: 0.8 }, top: 25 };
    },
    (c) => { // headphone bird
      const { dk } = c;
      return { parts: [
        S('M44,44 L56,40 L52,48Z', dk), S('M20,57 L24,49 L28,57Z', '#ffb02e'), S('M36,57 L40,49 L44,57Z', '#ffb02e'),
        S(smooth([[32, 20], [46, 30], [46, 48], [32, 54], [18, 48], [18, 30]]), `url(#g${c.uid})`),
        N('M17,32 Q17,10 32,10 Q47,10 47,32', INK, 3.5), N('M17,32 Q17,10 32,10 Q47,10 47,32', '#555', 1.8),
        `<rect x="12" y="28" width="7" height="11" rx="3" fill="${dk}" stroke="${INK}" stroke-width="1.5"/>`, `<rect x="45" y="28" width="7" height="11" rx="3" fill="${dk}" stroke="${INK}" stroke-width="1.5"/>`,
        S('M28,40 L36,40 L32,46Z', '#ffb02e'),
      ], face: { x: 32, y: 34, s: 0.85 }, top: 10, noMouth: true };
    },
  ],
};

// ------------------------------------------------------------------ faces
function face(c, f, b) {
  const { r } = c; const out = [];
  const s = f.s, ey = f.y - 2 * s, gap = 5.2 * s;
  const style = r.int(5);
  const eye = (x, big) => {
    const k = big ? 1.9 : 1;
    if (b.hollow) return `<ellipse cx="${f1(x)}" cy="${f1(ey)}" rx="${f1(2.8 * s * k)}" ry="${f1(4 * s * k)}" fill="${b.glow ? '#ffe36b' : INK}"/>`;
    if (b.eyesLight) return `<circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(2.6 * s)}" fill="#7cf0ff"/><circle cx="${f1(x - 0.6)}" cy="${f1(ey - 0.6)}" r="0.8" fill="#fff"/>`;
    if (style === 0 || big) return `<circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(3.6 * s * k)}" fill="#fff" stroke="${INK}" stroke-width="1.3"/><circle cx="${f1(x + 0.5)}" cy="${f1(ey + 0.5)}" r="${f1(2 * s * k)}" fill="${INK}"/><circle cx="${f1(x - 0.4)}" cy="${f1(ey - 0.6)}" r="${f1(0.8 * k)}" fill="#fff"/>`;
    if (style === 1) return `<ellipse cx="${f1(x)}" cy="${f1(ey)}" rx="${f1(2.1 * s)}" ry="${f1(3 * s)}" fill="${INK}"/><circle cx="${f1(x - 0.6)}" cy="${f1(ey - 1)}" r="0.8" fill="#fff"/>`;
    if (style === 2) return `<circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(3.3 * s)}" fill="#fff" stroke="${INK}" stroke-width="1.3"/><circle cx="${f1(x)}" cy="${f1(ey + 0.6)}" r="${f1(1.6 * s)}" fill="${INK}"/><path d="M${f1(x - 4 * s)},${f1(ey - 4 * s + (x > f.x ? 1.5 : 0))} L${f1(x + 4 * s)},${f1(ey - 4 * s + (x < f.x ? 1.5 : 0))}" stroke="${INK}" stroke-width="1.6"/>`;
    if (style === 3) return `<path d="M${f1(x - 3 * s)},${f1(ey)} Q${f1(x)},${f1(ey - 3 * s)} ${f1(x + 3 * s)},${f1(ey)}" stroke="${INK}" stroke-width="1.6" fill="none"/>`;
    return `<circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(3 * s)}" fill="#fff07a" stroke="${INK}" stroke-width="1.2"/><rect x="${f1(x - 0.7)}" y="${f1(ey - 2.4 * s)}" width="1.4" height="${f1(4.8 * s)}" fill="${INK}"/>`;
  };
  if (b.eyes === 1) out.push(eye(f.x, true));
  else {
    out.push(eye(f.x - gap), eye(f.x + gap));
    if (c.type === 'psychic' && r() < 0.5) out.push(`<path d="M${f.x},${f1(ey - 7 * s)} l2.6,2.6 l-2.6,2.6 l-2.6,-2.6Z" fill="#ffe36b" stroke="${INK}" stroke-width="1"/>`);
  }
  if (!b.noMouth) {
    const my = f.y + 4.5 * s, ms = r.int(5);
    const col = b.glow ? '#ffe36b' : INK;
    if (ms === 0) out.push(N(`M${f1(f.x - 3 * s)},${f1(my)} Q${f.x},${f1(my + 3 * s)} ${f1(f.x + 3 * s)},${f1(my)}`, col, 1.5));
    else if (ms === 1) out.push(`<path d="M${f1(f.x - 4 * s)},${f1(my)} Q${f.x},${f1(my + 5.5 * s)} ${f1(f.x + 4 * s)},${f1(my)}Z" fill="#7a2335" stroke="${INK}" stroke-width="1.2"/>`);
    else if (ms === 2) out.push(N(`M${f1(f.x - 4 * s)},${f1(my)} Q${f.x},${f1(my + 2.5 * s)} ${f1(f.x + 4 * s)},${f1(my)}`, col, 1.5), `<path d="M${f1(f.x + 1.2)},${f1(my + 0.8)} l1,2.6 l1,-2.8" fill="#fff" stroke="${INK}" stroke-width="0.8"/>`);
    else if (ms === 3) out.push(`<ellipse cx="${f.x}" cy="${f1(my + 1)}" rx="${f1(1.8 * s)}" ry="${f1(1.5 * s)}" fill="${col}"/>`);
    else out.push(N(`M${f1(f.x - 4 * s)},${f1(my)} l2,1.4 l2,-1.4 l2,1.4 l2,-1.4`, col, 1.3));
  }
  if (!b.hollow && c.tier >= 2 && r() < 0.7) for (const sd of [-1, 1]) out.push(`<ellipse cx="${f1(f.x + sd * (gap + 4 * s))}" cy="${f1(ey + 4.5 * s)}" rx="${f1(2.3 * s)}" ry="${f1(1.3 * s)}" fill="#ff7a9a" opacity="0.6"/>`);
  return out.join('');
}

// ------------------------------------------------------------------ assembly
const ALT = { fire: '#ff3d5a', water: '#3fe0d0', grass: '#b8e04a', electric: '#ffb12e', ice: '#b9c8ff', rock: '#9c8f86', poison: '#ff5ad0', psychic: '#c77dff', ghost: '#5b5fd6', junk: '#7f9a8a', sound: '#ff7a5a' };

export function monSvg(id) {
  if (cache.has(id)) return cache.get(id);
  const def = MON[id], T = TYPES[def.type];
  const r = makeRng(hash(id) ^ 0x9e3779b9);
  let col = mix(T.color, ALT[def.type], r() * 0.5);
  col = mix(col, r() < 0.5 ? '#ffffff' : '#000000', r() * 0.15);
  const c = { r, col, dk: mix(col, '#000000', 0.38), lt: mix(col, '#ffffff', 0.55), uid: id, tier: def.tier, type: def.type };
  // body family: spread across the type's 10 mons so the two mons of a tier never share one
  const fams = BODIES[def.type];
  const sameTier = Object.values(MON).filter(m => m.type === def.type && m.tier === def.tier).map(m => m.id);
  const b = fams[(def.tier + sameTier.indexOf(id)) % fams.length](c);

  const sc = 0.8 + def.tier * 0.06; // bigger with tier
  const back = [], front = [];
  if (def.tier === 5) {
    const rays = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rays.push(`M32,36 L${f1(32 + Math.cos(a - 0.12) * 34)},${f1(36 + Math.sin(a - 0.12) * 34)} L${f1(32 + Math.cos(a + 0.12) * 34)},${f1(36 + Math.sin(a + 0.12) * 34)}Z`); }
    back.push(`<path d="${rays.join(' ')}" fill="${c.lt}" opacity="0.22"/>`, `<circle cx="32" cy="36" r="27" fill="${c.lt}" opacity="0.2"/>`);
  }
  back.push(`<ellipse cx="32" cy="60" rx="${f1((b.float ? 11 : 16) * sc)}" ry="2.4" fill="#000" opacity="${b.float ? 0.18 : 0.28}"/>`);
  if (def.tier >= 4) for (let i = 0; i < 3; i++) { const x = 6 + r() * 52, y = 6 + r() * 30; front.push(`<path d="M${f1(x)},${f1(y - 3.5)} L${f1(x + 1)},${f1(y - 1)} L${f1(x + 3.5)},${f1(y)} L${f1(x + 1)},${f1(y + 1)} L${f1(x)},${f1(y + 3.5)} L${f1(x - 1)},${f1(y + 1)} L${f1(x - 3.5)},${f1(y)} L${f1(x - 1)},${f1(y - 1)}Z" fill="#fff8c0"/>`); }
  const fc = face(c, b.face, b);
  let crown = '';
  if (def.tier === 5) { const y = f1(b.top + 2); crown = `<path d="M24,${y} L24,${f1(y - 8)} L28,${f1(y - 4)} L32,${f1(y - 10)} L36,${f1(y - 4)} L40,${f1(y - 8)} L40,${y}Z" fill="#ffd54a" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="32" cy="${f1(y - 4)}" r="1.6" fill="#ff5a7a"/>`; }
  const grad = `<defs><radialGradient id="g${id}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="${c.lt}"/><stop offset="0.45" stop-color="${col}"/><stop offset="1" stop-color="${c.dk}"/></radialGradient></defs>`;
  const svg = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="mon-svg">${grad}${back.join('')}<g transform="translate(32 59) scale(${sc}) translate(-32 -59)">${b.parts.join('')}${fc}${crown}</g>${front.join('')}</svg>`;
  cache.set(id, svg);
  return svg;
}
