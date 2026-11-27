// Pocketomon art v3 (v0.7): one rendering style per dimension. Every being is a 200x200 portrait:
// a parts kit (bodies, heads, weapons...) gives shapes tagged with a paint role, and the dimension's
// style decides how they are painted (comic halftone, manga ink, starlight, woodcut, watercolor,
// chrome & neon, crayon sticker, bioluminescence, pastel blur, blueprint). Each portrait is cached
// and served as an <img> so its filters are only rendered once.
import { MON } from './data.js?v=0.7.5';
import { makeRng, hash } from './rng.js?v=0.7.5';
import { SPECS, HAND } from './artspecs.js?v=0.7.5';

const f1 = (n) => Math.round(n * 10) / 10;
const cache = new Map();

// ------------------------------------------------------------------ geometry helpers
const circ = (x, y, r) => `M${f1(x - r)},${f1(y)} a${f1(r)},${f1(r)} 0 1,0 ${f1(2 * r)},0 a${f1(r)},${f1(r)} 0 1,0 ${f1(-2 * r)},0Z`;
const ell = (x, y, rx, ry) => `M${f1(x - rx)},${f1(y)} a${f1(rx)},${f1(ry)} 0 1,0 ${f1(2 * rx)},0 a${f1(rx)},${f1(ry)} 0 1,0 ${f1(-2 * rx)},0Z`;
const poly = (pts) => 'M' + pts.map(p => `${f1(p[0])},${f1(p[1])}`).join(' L') + 'Z';
function smooth(pts) { // closed smooth curve through points
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) { const l = pts[n - 1]; d += `M${f1((l[0] + p[0]) / 2)},${f1((l[1] + p[1]) / 2)}`; }
    d += ` Q${f1(p[0])},${f1(p[1])} ${f1(m[0])},${f1(m[1])}`;
  }
  return d + 'Z';
}
const limb = (x1, y1, x2, y2, w) => { // a thick rounded limb as a filled shape
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
  return `M${f1(x1 + nx)},${f1(y1 + ny)} L${f1(x2 + nx)},${f1(y2 + ny)} A${f1(w / 2)},${f1(w / 2)} 0 0,0 ${f1(x2 - nx)},${f1(y2 - ny)} L${f1(x1 - nx)},${f1(y1 - ny)} A${f1(w / 2)},${f1(w / 2)} 0 0,0 ${f1(x1 + nx)},${f1(y1 + ny)}Z`;
};
const star = (x, y, r1, r2, n = 5, rot = -Math.PI / 2) => {
  const pts = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  return poly(pts);
};
const line = (d, w = 3) => ({ d, r: 'line', w });

// ------------------------------------------------------------------ parts kit
// Each part returns shapes: { d, r: role, w? } with roles main | alt | skin | dark | accent | glow | metal | light | line | eye
// Faces are returned separately as { x, y, s, kind } and drawn by the style.
const P = (d, r) => ({ d, r });

function weapon(kind, hx, hy, side = 1) {
  const s = side;
  switch (kind) {
    case 'bow': return [line(`M${hx + 6 * s},${hy - 46} Q${hx + 34 * s},${hy} ${hx + 6 * s},${hy + 46}`, 5), line(`M${hx + 6 * s},${hy - 46} L${hx + 6 * s},${hy + 46}`, 1.2), line(`M${hx - 30 * s},${hy} L${hx + 22 * s},${hy}`, 2.5), P(poly([[hx - 34 * s, hy], [hx - 24 * s, hy - 6], [hx - 26 * s, hy], [hx - 24 * s, hy + 6]]), 'metal')];
    case 'sword': return [P(poly([[hx - 3, hy], [hx - 3, hy - 58], [hx, hy - 66], [hx + 3, hy - 58], [hx + 3, hy]]), 'metal'), P(poly([[hx - 12, hy], [hx + 12, hy], [hx + 12, hy + 5], [hx - 12, hy + 5]]), 'accent'), P(limb(hx, hy + 5, hx, hy + 18, 6), 'dark')];
    case 'staff': return [P(limb(hx, hy + 50, hx, hy - 48, 6), 'dark'), P(circ(hx, hy - 54, 9), 'glow')];
    case 'gun': return [P(poly([[hx - 6, hy - 8], [hx + 34 * s, hy - 10], [hx + 34 * s, hy + 2], [hx + 10 * s, hy + 4], [hx + 4 * s, hy + 14], [hx - 6, hy + 12]]), 'metal'), P(circ(hx + 36 * s, hy - 4, 5), 'glow')];
    case 'scythe': return [P(limb(hx, hy + 40, hx, hy - 50, 5), 'dark'), P(`M${hx},${hy - 50} Q${hx + 50 * s},${hy - 54} ${hx + 58 * s},${hy - 20} Q${hx + 38 * s},${hy - 40} ${hx},${hy - 38}Z`, 'metal')];
    case 'harpoon': return [P(limb(hx - 30 * s, hy + 30, hx + 40 * s, hy - 40, 5), 'dark'), P(poly([[hx + 40 * s, hy - 40], [hx + 54 * s, hy - 58], [hx + 36 * s, hy - 50], [hx + 30 * s, hy - 46]]), 'metal')];
    case 'whip': return [line(`M${hx},${hy} Q${hx + 40 * s},${hy - 30} ${hx + 20 * s},${hy - 60} T${hx + 50 * s},${hy - 80}`, 3)];
    case 'wrench': return [P(limb(hx, hy + 20, hx + 20 * s, hy - 30, 7), 'metal'), P(`M${hx + 12 * s},${hy - 38} a12,12 0 1,1 16,4 l-6,-4 -6,6Z`, 'metal')];
    case 'cannon': return [P(poly([[hx - 8, hy - 10], [hx + 44 * s, hy - 14], [hx + 44 * s, hy + 10], [hx - 8, hy + 10]]), 'metal'), P(ell(hx + 44 * s, hy - 2, 5, 12), 'dark')];
    case 'lantern': return [line(`M${hx},${hy} L${hx},${hy + 14}`, 2), P(ell(hx, hy + 24, 8, 10), 'glow')];
    case 'fist': return [P(smooth([[hx - 14, hy - 10], [hx + 12, hy - 14], [hx + 16, hy + 8], [hx - 10, hy + 12]]), 'skin')];
    case 'shield': return [P(`M${hx - 18},${hy - 22} L${hx + 18},${hy - 22} L${hx + 16},${hy + 8} L${hx},${hy + 24} L${hx - 16},${hy + 8}Z`, 'alt'), P(star(hx, hy - 2, 9, 4), 'accent')];
    case 'book': return [P(poly([[hx - 16, hy - 10], [hx + 16, hy - 14], [hx + 18, hy + 10], [hx - 14, hy + 14]]), 'alt'), line(`M${hx + 1},${hy - 12} L${hx + 2},${hy + 12}`, 1.5)];
    case 'net': return [P(circ(hx + 20 * s, hy - 16, 20), 'light'), line(`M${hx},${hy} L${hx + 14 * s},${hy - 6}`, 3)];
    default: return [];
  }
}

function humanoid(p) {
  const out = [], cx = 100, bulk = p.bulk || 1, H = p.h || 1;
  const footY = 176, hipY = 176 - 40 * H, shY = hipY - 40 * H * (p.short ? 0.8 : 1), headR = (p.headR || 22) * (p.kid ? 1.3 : 1), headY = shY - headR + 4;
  const tw = 22 * bulk;
  if (p.cape) out.push(P(`M${cx - tw - 4},${shY} Q${cx - tw - 22},${hipY + 10} ${cx - tw - 16},${footY - 2} L${cx + tw + 16},${footY - 2} Q${cx + tw + 22},${hipY + 10} ${cx + tw + 4},${shY}Z`, p.cape));
  if (p.wings) for (const sd of [-1, 1]) out.push(P(`M${cx + sd * 10},${shY + 8} Q${cx + sd * 70},${shY - 50} ${cx + sd * 82},${shY - 10} Q${cx + sd * 60},${shY + 2} ${cx + sd * 64},${shY + 30} Q${cx + sd * 40},${shY + 20} ${cx + sd * 12},${shY + 24}Z`, p.wings));
  if (p.tail) out.push(P(`M${cx + 10},${hipY} Q${cx + 60},${hipY + 10} ${cx + 66},${hipY - 30} Q${cx + 56},${hipY - 4} ${cx + 12},${hipY + 12}Z`, p.tail));
  // legs
  if (p.robe) out.push(P(poly([[cx - tw, shY + 12], [cx + tw, shY + 12], [cx + tw + 14, footY], [cx - tw - 14, footY]]), p.robe));
  else for (const sd of [-1, 1]) { out.push(P(limb(cx + sd * 10 * bulk, hipY, cx + sd * 14 * bulk, footY - 6, 13 * bulk), p.legs || 'dark')); out.push(P(ell(cx + sd * 16 * bulk, footY - 3, 10 * bulk, 5), 'dark')); }
  // torso
  out.push(P(`M${cx - tw},${shY} Q${cx - tw - 4},${hipY - 10} ${cx - tw + 4},${hipY + 4} L${cx + tw - 4},${hipY + 4} Q${cx + tw + 4},${hipY - 10} ${cx + tw},${shY} Q${cx},${shY - 8} ${cx - tw},${shY}Z`, p.body || 'main'));
  if (p.belt) out.push(P(poly([[cx - tw + 2, hipY - 8], [cx + tw - 2, hipY - 8], [cx + tw - 1, hipY], [cx - tw + 1, hipY]]), p.belt));
  if (p.chest) out.push(P(p.chest === 'core' ? circ(cx, shY + 18, 8) : star(cx, shY + 18, 10, 4.5), p.chest === 'core' ? 'glow' : 'accent'));
  if (p.pads) for (const sd of [-1, 1]) out.push(P(ell(cx + sd * (tw + 2), shY + 4, 11, 8), 'metal'));
  // arms
  const armW = 11 * bulk, lh = [cx - tw - 16, shY + 34], rh = p.reach ? [cx + tw + 34, shY + 6] : [cx + tw + 16, shY + 34];
  out.push(P(limb(cx - tw + 2, shY + 6, lh[0], lh[1], armW), p.arms || 'skin'));
  out.push(P(limb(cx + tw - 2, shY + 6, rh[0], rh[1], armW), p.arms || 'skin'));
  out.push(P(circ(lh[0], lh[1], armW * 0.62), 'skin'), P(circ(rh[0], rh[1], armW * 0.62), 'skin'));
  if (p.weapon) out.push(...weapon(p.weapon, rh[0], rh[1], 1));
  if (p.offhand) out.push(...weapon(p.offhand, lh[0], lh[1], -1));
  // head
  if (p.ears === 'elf') for (const sd of [-1, 1]) out.push(P(poly([[cx + sd * headR * 0.6, headY - 2], [cx + sd * (headR + 46), headY - 40], [cx + sd * (headR + 30), headY - 26], [cx + sd * (headR + 34), headY - 22], [cx + sd * headR * 0.7, headY + 10]]), 'skin'));
  if (p.ears === 'cat') for (const sd of [-1, 1]) out.push(P(poly([[cx + sd * 8, headY - headR + 4], [cx + sd * 18, headY - headR - 16], [cx + sd * 22, headY - headR + 10]]), 'skin'));
  if (p.ears === 'goat') for (const sd of [-1, 1]) out.push(P(`M${cx + sd * 8},${headY - headR + 6} Q${cx + sd * 40},${headY - headR - 30} ${cx + sd * 34},${headY - headR + 8} Q${cx + sd * 28},${headY - headR - 8} ${cx + sd * 14},${headY - headR + 10}Z`, 'alt'));
  if (p.hair === 'long') out.push(P(`M${cx - headR - 4},${headY} Q${cx - headR - 8},${headY + 50} ${cx - headR + 4},${shY + 40} L${cx + headR - 4},${shY + 40} Q${cx + headR + 8},${headY + 50} ${cx + headR + 4},${headY} Q${cx},${headY - headR - 14} ${cx - headR - 4},${headY}Z`, 'alt'));
  if (p.head === 'lizard') out.push(P(`M${cx - headR},${headY + 4} Q${cx - headR},${headY - headR} ${cx + 4},${headY - headR + 2} Q${cx + headR + 20},${headY - 6} ${cx + headR + 22},${headY + 6} Q${cx + headR + 6},${headY + headR} ${cx - headR + 4},${headY + headR - 4}Z`, p.headRole || 'skin'));
  else if (p.head === 'bull') { out.push(P(smooth([[cx - headR, headY - 6], [cx, headY - headR - 4], [cx + headR, headY - 6], [cx + headR * 0.7, headY + headR + 6], [cx - headR * 0.7, headY + headR + 6]]), p.headRole || 'skin')); for (const sd of [-1, 1]) out.push(P(`M${cx + sd * headR * 0.6},${headY - headR * 0.6} Q${cx + sd * (headR + 26)},${headY - headR - 4} ${cx + sd * (headR + 22)},${headY - headR - 26} Q${cx + sd * (headR + 10)},${headY - headR - 6} ${cx + sd * headR * 0.3},${headY - headR * 0.8}Z`, 'light')); out.push(P(ell(cx, headY + headR * 0.55, headR * 0.5, headR * 0.32), 'alt')); }
  else out.push(P(circ(cx, headY, headR), p.headRole || 'skin'));
  if (p.beard) out.push(P(`M${cx - headR * 0.8},${headY + 4} Q${cx},${headY + headR + 30} ${cx + headR * 0.8},${headY + 4} Q${cx},${headY + headR * 0.6} ${cx - headR * 0.8},${headY + 4}Z`, p.beard));
  if (p.hair === 'spiky') out.push(P(poly([[cx - headR - 2, headY - 2], [cx - headR + 2, headY - headR - 8], [cx - 6, headY - headR + 2], [cx, headY - headR - 14], [cx + 8, headY - headR + 2], [cx + headR - 2, headY - headR - 8], [cx + headR + 2, headY - 2], [cx, headY - headR * 0.5]]), 'dark'));
  if (p.hair === 'bun' || p.hair === 'long' || p.hair === 'cap') out.push(P(`M${cx - headR},${headY - 2} Q${cx},${headY - headR - 10} ${cx + headR},${headY - 2} Q${cx},${headY - headR * 0.5} ${cx - headR},${headY - 2}Z`, p.hair === 'long' ? 'alt' : 'dark'));
  if (p.hair === 'bun') out.push(P(circ(cx, headY - headR - 6, 9), 'dark'));
  if (p.hood) out.push(P(`M${cx - headR - 8},${headY + headR} Q${cx - headR - 12},${headY - headR - 10} ${cx},${headY - headR - 16} Q${cx + headR + 12},${headY - headR - 10} ${cx + headR + 8},${headY + headR} Q${cx + headR},${headY - 4} ${cx},${headY - headR + 2} Q${cx - headR},${headY - 4} ${cx - headR - 8},${headY + headR}Z`, p.hood));
  if (p.helm) { out.push(P(`M${cx - headR - 3},${headY + 6} Q${cx - headR - 2},${headY - headR - 6} ${cx},${headY - headR - 8} Q${cx + headR + 2},${headY - headR - 6} ${cx + headR + 3},${headY + 6} L${cx + headR - 4},${headY + 6} L${cx + headR - 6},${headY - 4} L${cx - headR + 6},${headY - 4} L${cx - headR + 4},${headY + 6}Z`, p.helm)); }
  if (p.band) out.push(P(poly([[cx - headR, headY - 10], [cx + headR, headY - 12], [cx + headR, headY - 4], [cx - headR, headY - 2]]), p.band), P(`M${cx + headR},${headY - 10} Q${cx + headR + 24},${headY - 22} ${cx + headR + 30},${headY - 8} Q${cx + headR + 18},${headY - 8} ${cx + headR},${headY - 4}Z`, p.band));
  if (p.hat === 'wizard') out.push(P(`M${cx - headR - 10},${headY - headR * 0.4} L${cx + headR + 10},${headY - headR * 0.4} L${cx + 10},${headY - headR - 48} Q${cx - 4},${headY - headR - 30} ${cx - headR - 10},${headY - headR * 0.4}Z`, p.hatRole || 'alt'), P(star(cx + 2, headY - headR - 12, 6, 2.5), 'accent'));
  if (p.hat === 'crown') out.push(P(poly([[cx - 14, headY - headR + 4], [cx - 16, headY - headR - 14], [cx - 7, headY - headR - 4], [cx, headY - headR - 18], [cx + 7, headY - headR - 4], [cx + 16, headY - headR - 14], [cx + 14, headY - headR + 4]]), 'metal'));
  if (p.hat === 'nightcap') out.push(P(`M${cx - headR - 2},${headY - 6} Q${cx},${headY - headR - 24} ${cx + headR + 26},${headY - headR + 4} Q${cx + headR},${headY - headR + 2} ${cx + headR + 2},${headY - 6}Z`, 'alt'), P(circ(cx + headR + 26, headY - headR + 4, 6), 'light'));
  if (p.hat === 'tricorn') out.push(P(`M${cx - headR - 12},${headY - 8} Q${cx},${headY - headR - 26} ${cx + headR + 12},${headY - 8} Q${cx},${headY - headR + 2} ${cx - headR - 12},${headY - 8}Z`, 'dark'));
  if (p.hat === 'top') out.push(P(poly([[cx - headR - 8, headY - headR + 6], [cx + headR + 8, headY - headR + 6], [cx + headR + 8, headY - headR + 12], [cx - headR - 8, headY - headR + 12]]), 'dark'), P(poly([[cx - 14, headY - headR + 8], [cx + 14, headY - headR + 8], [cx + 12, headY - headR - 30], [cx - 12, headY - headR - 30]]), 'dark'));
  if (p.mask) out.push(P(poly([[cx - headR + 2, headY - 6], [cx + headR - 2, headY - 6], [cx + headR - 4, headY + 4], [cx - headR + 4, headY + 4]]), p.mask));
  if (p.rider) { /* drawn by the mount */ }
  const face = { x: cx, y: headY + (p.head === 'bull' ? -4 : 0), s: headR / 22, kind: p.eyes || 'round', mouth: p.mouth };
  return { shapes: out, faces: p.noFace ? [] : [face] };
}

function quad(p) {
  const out = [], bx = 108, by = p.by || 122, rx = 52 * (p.size || 1), ry = 30 * (p.size || 1);
  const legH = p.legH || 34, legW = p.legW || 14;
  if (p.wings) out.push(P(`M${bx},${by - ry + 6} Q${bx + 20},${by - ry - 80} ${bx + 80},${by - ry - 70} Q${bx + 54},${by - ry - 44} ${bx + 70},${by - ry - 20} Q${bx + 44},${by - ry - 20} ${bx + 46},${by - ry + 4} Q${bx + 24},${by - ry - 6} ${bx + 14},${by - ry + 14}Z`, p.wings));
  if (p.tail !== false) out.push(P(`M${bx + rx - 8},${by - 6} Q${bx + rx + 40},${by - 30} ${bx + rx + 36},${by - (p.tailUp || 4)} Q${bx + rx + 24},${by + 6} ${bx + rx - 4},${by + 10}Z`, p.tailRole || 'main'));
  for (const [lx, back] of [[bx - rx * 0.6, 1], [bx + rx * 0.55, 1], [bx - rx * 0.35, 0], [bx + rx * 0.8, 0]]) out.push(P(limb(lx, by + ry * 0.4, lx + (back ? -2 : 2), by + ry * 0.4 + legH, legW), back ? 'dark' : p.legRole || 'main'));
  out.push(P(ell(bx, by, rx, ry), 'main'));
  if (p.belly) out.push(P(ell(bx - 4, by + ry * 0.35, rx * 0.7, ry * 0.45), 'light'));
  if (p.spikes) for (let i = 0; i < 5; i++) { const x = bx - rx * 0.6 + i * rx * 0.3; out.push(P(poly([[x - 8, by - ry + 6], [x, by - ry - 14], [x + 8, by - ry + 6]]), 'alt')); }
  if (p.stripes) for (let i = 0; i < 4; i++) { const x = bx - rx * 0.4 + i * rx * 0.28; out.push(P(`M${x},${by - ry + 4} q6,${ry * 0.6} 0,${ry * 1.1} q-4,-${ry * 0.5} 0,-${ry * 1.1}Z`, 'dark')); }
  // neck + head on the left
  const hx = bx - rx - (p.neck || 8), hy = by - ry - (p.headUp || 6), hr = p.headR || 24;
  out.push(P(limb(bx - rx * 0.6, by - 8, hx + 6, hy + 6, hr * 1.1), 'main'));
  if (p.mane) out.push(P(star(hx + 4, hy, hr + 16, hr + 4, 9, 0), p.mane));
  if (p.jaw) out.push(P(`M${hx + 14},${hy - hr * 0.8} Q${hx - hr - 28},${hy - hr * 0.6} ${hx - hr - 30},${hy + 4} L${hx - hr - 20},${hy + 10} L${hx - hr - 30},${hy + 16} Q${hx - 10},${hy + hr + 6} ${hx + 16},${hy + hr * 0.4}Z`, 'main'), P(poly([[hx - hr - 26, hy + 8], [hx - hr - 22, hy + 14], [hx - hr - 18, hy + 8], [hx - hr - 14, hy + 14], [hx - hr - 10, hy + 8], [hx - hr - 6, hy + 14], [hx - hr - 2, hy + 9]]), 'light'));
  else out.push(P(circ(hx, hy, hr), p.headRole || 'main'));
  if (p.snout) out.push(P(ell(hx - hr * 0.8, hy + hr * 0.3, hr * 0.55, hr * 0.42), 'light'));
  if (p.beak) out.push(P(poly([[hx - hr * 0.7, hy - 6], [hx - hr - 26, hy + 4], [hx - hr * 0.7, hy + 12]]), 'accent'));
  if (p.comb) out.push(P(`M${hx - 10},${hy - hr + 4} q2,-16 8,-8 q4,-14 10,-4 q8,-10 8,8Z`, 'accent'));
  if (p.horns) for (const sd of [0, 1]) out.push(P(`M${hx - 6 + sd * 12},${hy - hr + 6} Q${hx - 20 + sd * 30},${hy - hr - 34} ${hx + 4 + sd * 20},${hy - hr - 40} Q${hx - 2 + sd * 18},${hy - hr - 20} ${hx + 4 + sd * 12},${hy - hr + 6}Z`, 'light'));
  if (p.tusks) out.push(P(`M${hx - hr * 0.6},${hy + hr * 0.5} Q${hx - hr - 30},${hy + hr + 26} ${hx - hr - 6},${hy + hr + 34} Q${hx - hr - 16},${hy + hr + 16} ${hx - hr * 0.2},${hy + hr * 0.7}Z`, 'light'));
  if (p.trunk) out.push(P(limb(hx - hr * 0.7, hy + hr * 0.3, hx - hr - 14, hy + hr + 40, 13), 'main'));
  if (p.ears) out.push(P(ell(hx + hr * 0.6, hy - 2, hr * 0.5, hr * 0.8), 'alt'));
  if (p.catEars) for (const sd of [-1, 1]) out.push(P(poly([[hx + sd * 10 - 6, hy - hr + 6], [hx + sd * 12, hy - hr - 16], [hx + sd * 14 + 6, hy - hr + 6]]), 'main'));
  const faces = [{ x: hx - hr * 0.25, y: hy - hr * 0.15, s: hr / 26, kind: p.eyes || 'side', mouth: p.mouth || 'none' }];
  let shapes = out;
  if (p.rider) { // a small rider on the back
    const r = humanoid(Object.assign({ h: 0.62, headR: 15 }, p.rider));
    shapes = shapes.concat(r.shapes.map(s => ({ ...s, d: s.d, tf: `translate(${bx - 78} ${by - 140}) scale(0.78)` })));
    for (const f of r.faces) faces.push({ x: bx - 78 + f.x * 0.78, y: by - 140 + f.y * 0.78, s: f.s * 0.78, kind: f.kind });
  }
  return { shapes, faces };
}

function blob(p) {
  const out = [], cx = 100, cy = p.cy || 118, r = p.r || 46;
  if (p.wings) for (const sd of [-1, 1]) out.push(P(`M${cx + sd * r * 0.6},${cy - 6} Q${cx + sd * (r + 50)},${cy - 60} ${cx + sd * (r + 44)},${cy + 10} Q${cx + sd * (r + 20)},${cy} ${cx + sd * r * 0.7},${cy + 16}Z`, p.wings));
  if (p.ears === 'long') for (const sd of [-1, 1]) out.push(P(ell(cx + sd * r * 0.55, cy - r * 0.9, 10, 24), 'alt'));
  if (p.ears === 'round') for (const sd of [-1, 1]) out.push(P(circ(cx + sd * r * 0.7, cy - r * 0.75, 14), 'alt'));
  if (p.ears === 'pointy') for (const sd of [-1, 1]) out.push(P(poly([[cx + sd * r * 0.3, cy - r * 0.8], [cx + sd * r * 0.8, cy - r * 1.5], [cx + sd * r * 0.9, cy - r * 0.5]]), 'alt'));
  if (p.antenna) for (const sd of (p.antenna === 1 ? [0] : [-1, 1])) { out.push(line(`M${cx + sd * 12},${cy - r + 4} Q${cx + sd * 24},${cy - r - 20} ${cx + sd * 18},${cy - r - 30}`, 3)); out.push(P(circ(cx + sd * 18, cy - r - 32, 6), 'glow')); }
  if (!p.noFeet) for (const sd of [-1, 1]) out.push(P(ell(cx + sd * r * 0.5, cy + r - 4, 14, 8), 'dark'));
  if (p.arms) for (const sd of [-1, 1]) out.push(P(limb(cx + sd * r * 0.85, cy + 4, cx + sd * (r + 18), cy + 22, 12), 'main'));
  out.push(P(p.shape === 'can' ? `M${cx - r * 0.85},${cy - r * 0.7} L${cx - r * 0.85},${cy + r * 0.85} Q${cx},${cy + r * 1.05} ${cx + r * 0.85},${cy + r * 0.85} L${cx + r * 0.85},${cy - r * 0.7} Q${cx},${cy - r * 1.1} ${cx - r * 0.85},${cy - r * 0.7}Z`
    : p.shape === 'cloud' ? smooth([[cx - r, cy + 10], [cx - r * 0.9, cy - r * 0.5], [cx - r * 0.3, cy - r], [cx + r * 0.4, cy - r * 0.95], [cx + r, cy - r * 0.3], [cx + r, cy + r * 0.6], [cx, cy + r * 0.95], [cx - r * 0.8, cy + r * 0.7]])
    : circ(cx, cy, r), p.role || 'main'));
  if (p.belly) out.push(P(ell(cx, cy + r * 0.35, r * 0.6, r * 0.45), 'light'));
  if (p.label) out.push(P(poly([[cx - r * 0.6, cy + 6], [cx + r * 0.6, cy + 2], [cx + r * 0.62, cy + 26], [cx - r * 0.58, cy + 30]]), 'accent'));
  if (p.spikes) for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.9 + i * Math.PI * 0.16; out.push(P(poly([[cx + r * 0.9 * Math.cos(a - 0.1), cy + r * 0.9 * Math.sin(a - 0.1)], [cx + (r + 16) * Math.cos(a), cy + (r + 16) * Math.sin(a)], [cx + r * 0.9 * Math.cos(a + 0.1), cy + r * 0.9 * Math.sin(a + 0.1)]]), 'alt')); }
  if (p.hat) out.push(...humanoidHat(p.hat, cx, cy - r + 6, r));
  if (p.weapon) out.push(...weapon(p.weapon, cx + r + 14, cy + 18, 1));
  if (p.face === false) return { shapes: out, faces: [] };
  return { shapes: out, faces: [{ x: cx, y: cy - r * 0.15, s: r / 34, kind: p.eyes || 'round', mouth: p.mouth }] };
}
function humanoidHat(kind, x, y, r) {
  if (kind === 'nightcap') return [P(`M${x - r * 0.9},${y + 8} Q${x},${y - 40} ${x + r + 30},${y - 4} Q${x + r * 0.4},${y - 10} ${x + r * 0.9},${y + 10}Z`, 'alt'), P(circ(x + r + 30, y - 4, 7), 'light'), P(`M${x - r * 0.95},${y + 10} Q${x},${y - 4} ${x + r * 0.95},${y + 10}`, 'light')];
  if (kind === 'crown') return [P(poly([[x - 18, y + 6], [x - 20, y - 14], [x - 9, y - 4], [x, y - 20], [x + 9, y - 4], [x + 20, y - 14], [x + 18, y + 6]]), 'metal')];
  if (kind === 'bolt') return [P(circ(x, y - 8, 10), 'metal'), P(poly([[x - 4, y - 18], [x + 4, y - 18], [x + 3, y - 28], [x - 3, y - 28]]), 'metal')];
  return [];
}

function robot(p) {
  const out = [], cx = 100, w = 34 * (p.bulk || 1), top = p.top || 84, bot = 140;
  if (p.wings) for (const sd of [-1, 1]) out.push(P(poly([[cx + sd * w, top + 10], [cx + sd * (w + 50), top - 30], [cx + sd * (w + 40), top + 20], [cx + sd * (w + 56), top + 40], [cx + sd * w, top + 44]]), p.wings));
  if (p.treads) out.push(P(`M${cx - w - 10},${bot} L${cx + w + 10},${bot} Q${cx + w + 26},${bot + 18} ${cx + w + 10},${bot + 34} L${cx - w - 10},${bot + 34} Q${cx - w - 26},${bot + 18} ${cx - w - 10},${bot}Z`, 'dark'), P(`M${cx - w},${bot + 17} L${cx + w},${bot + 17}`, 'line'));
  else if (p.float) out.push(P(`M${cx - 18},${bot} Q${cx},${bot + 40} ${cx + 18},${bot}Z`, 'glow'));
  else for (const sd of [-1, 1]) { out.push(P(limb(cx + sd * w * 0.5, bot, cx + sd * w * 0.6, 170, 14), 'metal')); out.push(P(poly([[cx + sd * w * 0.6 - 14, 168], [cx + sd * w * 0.6 + 14, 168], [cx + sd * w * 0.6 + 16, 178], [cx + sd * w * 0.6 - 16, 178]]), 'dark')); }
  const arms = p.arms || 'claw';
  for (const sd of [-1, 1]) {
    const ex = cx + sd * (w + 22), ey = top + 40;
    out.push(P(limb(cx + sd * w, top + 14, ex, ey, 12), 'metal'));
    if (arms === 'cannon' || (arms === 'mixed' && sd > 0)) out.push(P(poly([[ex - 10, ey - 8], [ex + sd * 34, ey - 6], [ex + sd * 34, ey + 10], [ex - 10, ey + 10]]), 'metal'), P(ell(ex + sd * 34, ey + 2, 4, 9), 'glow'));
    else if (arms === 'scythe') out.push(P(`M${ex},${ey} Q${ex + sd * 40},${ey - 10} ${ex + sd * 46},${ey + 40} Q${ex + sd * 28},${ey + 8} ${ex},${ey + 10}Z`, 'metal'));
    else if (arms === 'grinder') out.push(P(circ(ex + sd * 12, ey + 8, 16), 'metal'), P(star(ex + sd * 12, ey + 8, 16, 11, 8), 'dark'));
    else out.push(P(poly([[ex - 6, ey], [ex + sd * 14, ey + 16], [ex + sd * 4, ey + 18], [ex - 4, ey + 8], [ex - 10, ey + 20], [ex - 14, ey + 10]]), 'dark'));
  }
  out.push(P(p.body === 'round' ? ell(cx, (top + bot) / 2 + 4, w + 6, (bot - top) / 2) : poly([[cx - w, top + 4], [cx + w, top + 4], [cx + w - 6, bot], [cx - w + 6, bot]]), 'main'));
  if (p.core) out.push(P(circ(cx, top + 30, 10), 'glow'));
  if (p.vents) for (let i = 0; i < 3; i++) out.push(P(poly([[cx - 16, top + 22 + i * 8], [cx + 16, top + 22 + i * 8], [cx + 16, top + 26 + i * 8], [cx - 16, top + 26 + i * 8]]), 'glow'));
  // head
  const hw = 24 * (p.headW || 1), hy = top - 22;
  if (p.horns) for (const sd of [-1, 1]) out.push(P(poly([[cx + sd * hw * 0.5, hy - 16], [cx + sd * (hw + 8), hy - 46], [cx + sd * hw * 0.9, hy - 10]]), 'dark'));
  if (p.antenna) out.push(line(`M${cx},${hy - 20} L${cx + 4},${hy - 40}`, 3), P(circ(cx + 4, hy - 42, 5), 'glow'));
  out.push(P(p.head === 'dome' ? `M${cx - hw},${hy + 20} Q${cx - hw},${hy - 26} ${cx},${hy - 26} Q${cx + hw},${hy - 26} ${cx + hw},${hy + 20}Z` : poly([[cx - hw, hy - 18], [cx + hw, hy - 18], [cx + hw - 4, hy + 22], [cx - hw + 4, hy + 22]]), 'metal'));
  out.push(P(poly([[cx - hw + 6, hy - 4], [cx + hw - 6, hy - 4], [cx + hw - 8, hy + 8], [cx - hw + 8, hy + 8]]), 'dark'));
  out.push(P(poly([[cx - hw + 9, hy - 1], [cx + hw - 9, hy - 1], [cx + hw - 11, hy + 5], [cx - hw + 11, hy + 5]]), 'glow'));
  return { shapes: out, faces: [] };
}

function serpent(p) {
  const out = [], w = p.w || 26;
  const pts = [[40, 176], [70, 150], [130, 160], [150, 120], [110, 96], [92, 70]];
  const path = `M${pts[0]} C${pts[1]} ${pts[2]} ${pts[3]} S${pts[4]} ${pts[5]}`;
  out.push({ d: path, r: 'tube', w: w + 6 }); // outline tube
  out.push({ d: path, r: 'tubeFill', w });
  if (p.rings) for (let i = 0; i < 5; i++) out.push(P(ell(70 + i * 16, 158 - i * 10, 6, 10), 'alt'));
  const hx = 92, hy = 62, hr = p.headR || 26;
  if (p.maw) out.push(P(circ(hx, hy, hr + 6), 'main'), P(circ(hx, hy, hr - 4), 'dark'), P(star(hx, hy, hr - 4, hr - 14, 10, 0), 'light'));
  else out.push(P(`M${hx + hr},${hy} Q${hx + hr},${hy - hr} ${hx},${hy - hr} Q${hx - hr - 24},${hy - hr * 0.5} ${hx - hr - 26},${hy + 6} Q${hx - hr},${hy + hr} ${hx},${hy + hr * 0.8} Q${hx + hr},${hy + hr * 0.6} ${hx + hr},${hy}Z`, 'main'));
  if (p.hood) out.push(P(ell(hx + 6, hy - 4, hr + 16, hr + 6), 'alt'));
  return { shapes: out, faces: p.maw ? [] : [{ x: hx - 6, y: hy - 6, s: hr / 26, kind: p.eyes || 'slit', mouth: 'none' }] };
}

function squid(p) {
  const out = [], cx = 100, cy = p.cy || 84, r = p.r || 40, n = p.arms || 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x0 = cx - r * 0.7 + t * r * 1.4, sw = (t - 0.5) * 120;
    out.push({ d: `M${f1(x0)},${cy + r * 0.6} Q${f1(x0 + sw * 0.3)},${cy + r + 40} ${f1(x0 + sw * 0.8)},${cy + r + 70}`, r: 'tube', w: 13 - Math.abs(t - 0.5) * 6 });
    out.push({ d: `M${f1(x0)},${cy + r * 0.6} Q${f1(x0 + sw * 0.3)},${cy + r + 40} ${f1(x0 + sw * 0.8)},${cy + r + 70}`, r: 'tubeFill', w: 8 - Math.abs(t - 0.5) * 4 });
    if (p.spots) out.push(P(circ(x0 + sw * 0.5, cy + r + 50, 2.6), 'spot'));
  }
  out.push(P(`M${cx - r},${cy + r * 0.6} Q${cx - r - 6},${cy - r * 1.4} ${cx},${cy - r * 1.3} Q${cx + r + 6},${cy - r * 1.4} ${cx + r},${cy + r * 0.6} Q${cx},${cy + r * 0.9} ${cx - r},${cy + r * 0.6}Z`, 'main'));
  if (p.spots) for (const [dx, dy] of [[-16, -30], [-4, -40], [12, -34], [22, -18], [-24, -12]]) out.push(P(circ(cx + dx, cy + dy, 3), 'spot'));
  return { shapes: out, faces: [{ x: cx, y: cy + 6, s: r / 34, kind: p.eyes || 'glow', mouth: 'none' }] };
}

function fish(p) {
  const out = [], cx = 104, cy = p.cy || 104, rx = p.rx || 56, ry = p.ry || 34;
  out.push(P(poly([[cx + rx - 6, cy], [cx + rx + 34, cy - 30], [cx + rx + 26, cy], [cx + rx + 34, cy + 30]]), 'alt'));
  out.push(P(poly([[cx - 10, cy - ry + 4], [cx + 20, cy - ry - 26], [cx + 30, cy - ry + 6]]), 'alt'));
  out.push(P(ell(cx, cy, rx, ry), 'main'));
  if (p.belly) out.push(P(ell(cx - 6, cy + ry * 0.4, rx * 0.7, ry * 0.4), 'light'));
  if (p.lure) { out.push(line(`M${cx - rx * 0.5},${cy - ry + 4} Q${cx - rx * 0.6},${cy - ry - 50} ${cx - rx - 20},${cy - ry - 34}`, 3)); out.push(P(circ(cx - rx - 22, cy - ry - 30, 9), 'glow')); }
  if (p.teeth) out.push(P(poly([[cx - rx + 6, cy + 4], [cx - rx + 12, cy + 16], [cx - rx + 18, cy + 6], [cx - rx + 24, cy + 18], [cx - rx + 30, cy + 8], [cx - rx + 4, cy + 10]]), 'light'));
  if (p.spots) for (let i = 0; i < 6; i++) out.push(P(circ(cx - 20 + i * 12, cy - 10 + (i % 2) * 14, 3), 'spot'));
  if (p.twin) { const g = fish({ cy: cy - 62, rx: rx * 0.55, ry: ry * 0.55 }); out.push(...g.shapes.map(s => ({ ...s, tf: 'translate(46 30) scale(0.6)' }))); }
  return { shapes: out, faces: [{ x: cx - rx * 0.55, y: cy - ry * 0.25, s: ry / 30, kind: p.eyes || 'side', mouth: 'none' }] };
}

function moth(p) {
  const out = [], cx = 100, cy = 100;
  for (const sd of [-1, 1]) {
    out.push(P(`M${cx},${cy - 6} Q${cx + sd * 90},${cy - 90} ${cx + sd * 88},${cy - 10} Q${cx + sd * 60},${cy + 6} ${cx},${cy + 6}Z`, 'main'));
    out.push(P(`M${cx},${cy + 4} Q${cx + sd * 70},${cy + 10} ${cx + sd * 56},${cy + 60} Q${cx + sd * 24},${cy + 50} ${cx},${cy + 16}Z`, 'alt'));
    out.push(P(circ(cx + sd * 50, cy - 32, 12), 'accent'), P(circ(cx + sd * 50, cy - 32, 5), 'dark'));
  }
  out.push(P(ell(cx, cy + 14, 12, 42), 'dark'));
  out.push(line(`M${cx - 4},${cy - 24} Q${cx - 20},${cy - 60} ${cx - 34},${cy - 62}`, 2.5), line(`M${cx + 4},${cy - 24} Q${cx + 20},${cy - 60} ${cx + 34},${cy - 62}`, 2.5));
  return { shapes: out, faces: [{ x: cx, y: cy - 14, s: 0.6, kind: p.eyes || 'glow', mouth: 'none' }] };
}

function bird(p) {
  const out = [], cx = 104, cy = 112, r = p.r || 46;
  out.push(P(poly([[cx + r - 6, cy - 10], [cx + r + 30, cy - 40], [cx + r + 22, cy - 6], [cx + r + 36, cy - 14], [cx + r + 16, cy + 14]]), 'alt'));
  for (const sd of [-1, 1]) out.push(P(limb(cx + sd * 14, cy + r - 6, cx + sd * 18, 178, 7), 'accent'), P(poly([[cx + sd * 18 - 12, 178], [cx + sd * 18 + 12, 178], [cx + sd * 18, 172]]), 'accent'));
  out.push(P(ell(cx, cy, r, r * 0.92), 'main'));
  out.push(P(`M${cx + 6},${cy - 10} Q${cx + r + 10},${cy + 4} ${cx + r - 6},${cy + 34} Q${cx + 20},${cy + 30} ${cx + 6},${cy - 10}Z`, 'alt'));
  const hx = cx - r * 0.55, hy = cy - r * 0.85;
  out.push(P(circ(hx, hy, r * 0.55), 'main'));
  out.push(P(poly([[hx - r * 0.45, hy - 4], [hx - r * 0.95, hy + 6], [hx - r * 0.45, hy + 14]]), 'accent'));
  if (p.comb) out.push(P(`M${hx - 12},${hy - r * 0.5} q2,-18 9,-8 q5,-16 11,-4 q9,-12 9,10Z`, 'glow'));
  if (p.wattle) out.push(P(ell(hx - r * 0.5, hy + 22, 6, 9), 'glow'));
  return { shapes: out, faces: [{ x: hx - 4, y: hy - 4, s: r / 50, kind: p.eyes || 'side', mouth: 'none' }] };
}

function golem(p) {
  const out = [], cx = 100;
  if (p.tree) {
    for (const sd of [-1, 1]) out.push(P(`M${cx + sd * 10},176 Q${cx + sd * 34},170 ${cx + sd * 46},178 L${cx + sd * 14},164Z`, 'dark'));
    out.push(P(poly([[cx - 16, 176], [cx + 16, 176], [cx + 12, 100], [cx - 12, 100]]), 'main'));
    for (const [x, y, r] of [[cx - 40, 86, 30], [cx + 40, 84, 30], [cx, 60, 40], [cx - 22, 40, 22], [cx + 26, 42, 24]]) out.push(P(circ(x, y, r), 'accent'));
    for (const [x, y] of [[cx - 46, 70], [cx + 30, 30], [cx + 50, 90], [cx - 10, 36]]) out.push(P(circ(x, y, 5), 'glow'));
    return { shapes: out, faces: [{ x: cx, y: 136, s: 0.7, kind: p.eyes || 'calm', mouth: 'none' }] };
  }
  for (const sd of [-1, 1]) out.push(P(poly([[cx + sd * 18, 140], [cx + sd * 40, 140], [cx + sd * 42, 178], [cx + sd * 14, 178]]), 'dark'));
  for (const sd of [-1, 1]) out.push(P(poly([[cx + sd * 44, 74], [cx + sd * 78, 82], [cx + sd * 80, 150], [cx + sd * 54, 156], [cx + sd * 48, 110]]), 'alt'));
  out.push(P(poly([[cx - 50, 70], [cx + 50, 66], [cx + 46, 146], [cx - 46, 148]]), 'main'));
  if (p.moss) out.push(P(`M${cx - 50},${74} Q${cx - 20},${54} ${cx + 10},${68} Q${cx + 30},${52} ${cx + 50},${70} L${cx + 48},${84} Q${cx},${74} ${cx - 50},${86}Z`, 'accent'));
  if (p.branches) for (const sd of [-1, 1]) { out.push(line(`M${cx + sd * 30},${68} Q${cx + sd * 40},${36} ${cx + sd * 60},${20}`, 6)); out.push(P(circ(cx + sd * 62, 18, 14), 'accent')); }
  out.push(P(poly([[cx - 26, 40], [cx + 26, 38], [cx + 28, 76], [cx - 28, 78]]), 'main'));
  if (p.core) out.push(P(circ(cx, 106, 12), 'glow'));
  return { shapes: out, faces: [{ x: cx, y: 56, s: 0.9, kind: p.eyes || 'glow', mouth: 'none' }] };
}

function construct(p) {
  const out = [], cx = 100;
  switch (p.kind) {
    case 'bell':
      out.push(line(`M${cx},20 L${cx},40`, 4), P(`M${cx - 50},150 Q${cx - 46},50 ${cx},40 Q${cx + 46},50 ${cx + 50},150 Q${cx + 58},158 ${cx + 60},164 L${cx - 60},164 Q${cx - 58},158 ${cx - 50},150Z`, 'main'), P(circ(cx, 168, 12), 'dark'));
      for (let i = 0; i < 4; i++) out.push(P(circ(cx - 30 + i * 20, 120 + (i % 2) * 10, 5), 'accent'));
      return { shapes: out, faces: [{ x: cx, y: 100, s: 1, kind: p.eyes || 'hollow', mouth: 'o' }] };
    case 'clock':
      out.push(P(poly([[cx - 40, 168], [cx + 40, 168], [cx + 34, 70], [cx - 34, 70]]), 'alt'), P(circ(cx, 72, 46), 'metal'), P(circ(cx, 72, 36), 'light'));
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; out.push(line(`M${f1(cx + 30 * Math.cos(a))},${f1(72 + 30 * Math.sin(a))} L${f1(cx + 34 * Math.cos(a))},${f1(72 + 34 * Math.sin(a))}`, i % 3 ? 1.5 : 3)); }
      out.push(line(`M${cx},72 L${cx},48`, 3.5), line(`M${cx},72 L${cx + 14},80`, 3.5), P(circ(cx, 130, 10), 'metal'), line(`M${cx},92 L${cx},130`, 2));
      return { shapes: out, faces: p.face === false ? [] : [{ x: cx, y: 120, s: 0.7, kind: p.eyes || 'sleepy', mouth: 'none' }] };
    case 'crane':
      out.push(P(poly([[cx - 40, 178], [cx + 10, 178], [cx + 6, 70], [cx - 34, 70]]), 'main'));
      for (let i = 0; i < 5; i++) out.push(line(`M${cx - 34},${170 - i * 20} L${cx + 6},${150 - i * 20}`, 2));
      out.push(P(poly([[cx - 40, 64], [cx + 80, 50], [cx + 80, 62], [cx - 40, 76]]), 'alt'), line(`M${cx + 70},62 L${cx + 70},120`, 2), P(`M${cx + 58},120 q12,18 24,0`, 'metal'), P(poly([[cx - 36, 76], [cx, 76], [cx, 100], [cx - 36, 100]]), 'accent'));
      return { shapes: out, faces: [{ x: cx - 18, y: 88, s: 0.5, kind: p.eyes || 'round', mouth: 'none' }] };
    case 'pylon':
      out.push(P(poly([[cx - 36, 178], [cx + 36, 178], [cx + 14, 50], [cx - 14, 50]]), 'main'));
      for (let i = 0; i < 4; i++) out.push(P(poly([[cx - 30 + i * 4, 160 - i * 28], [cx + 30 - i * 4, 160 - i * 28], [cx + 28 - i * 4, 166 - i * 28], [cx - 28 + i * 4, 166 - i * 28]]), 'glow'));
      out.push(P(circ(cx, 40, 18), 'glow'), P(circ(cx, 40, 9), 'light'));
      return { shapes: out, faces: [] };
    case 'orrery':
      out.push(P(poly([[cx - 30, 178], [cx + 30, 178], [cx + 8, 110], [cx - 8, 110]]), 'metal'));
      for (const [rx, ry, rot] of [[78, 26, -14], [60, 20, 22], [40, 14, -40]]) out.push({ d: ell(cx, 86, rx, ry), r: 'ring', w: 3, tf: `rotate(${rot} ${cx} 86)` });
      out.push(P(circ(cx, 86, 18), 'glow'), P(circ(cx - 72, 74, 7), 'accent'), P(circ(cx + 52, 104, 9), 'alt'), P(circ(cx + 20, 60, 5), 'light'));
      return { shapes: out, faces: [] };
    case 'core':
      out.push(P(circ(cx, 100, 56), 'dark'), P(circ(cx, 100, 40), 'main'), P(circ(cx, 100, 22), 'glow'), P(circ(cx, 100, 10), 'dark'));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; out.push(P(limb(cx + 56 * Math.cos(a), 100 + 56 * Math.sin(a), cx + 76 * Math.cos(a), 100 + 76 * Math.sin(a), 8), 'metal')); }
      return { shapes: out, faces: [] };
    case 'mothership':
      out.push(P(`M${cx - 90},104 Q${cx},64 ${cx + 90},104 Q${cx},128 ${cx - 90},104Z`, 'metal'), P(`M${cx - 40},92 Q${cx},40 ${cx + 40},92Z`, 'glow'));
      for (let i = 0; i < 5; i++) out.push(P(circ(cx - 56 + i * 28, 110, 4), 'accent'));
      out.push(P(poly([[cx - 26, 118], [cx + 26, 118], [cx + 60, 190], [cx - 60, 190]]), 'beam'));
      return { shapes: out, faces: [] };
    case 'scale': // twin stars on a beam (Libra)
      out.push(line(`M${cx - 66},86 L${cx + 66},76`, 4), line(`M${cx},80 L${cx},150`, 4), P(poly([[cx - 26, 160], [cx + 26, 160], [cx + 18, 148], [cx - 18, 148]]), 'metal'));
      out.push(P(circ(cx - 66, 104, 22), 'main'), P(circ(cx + 66, 94, 18), 'alt'));
      return { shapes: out, faces: [{ x: cx - 66, y: 104, s: 0.7, kind: p.eyes || 'calm', mouth: 'none' }, { x: cx + 66, y: 94, s: 0.6, kind: p.eyes || 'calm', mouth: 'none' }] };
    default: return { shapes: out, faces: [] };
  }
}

// Zodiac / cosmic beings: a glowing body with a sign feature
function orb(p) {
  const out = [], cx = 100, cy = p.cy || 100, r = p.r || 38;
  if (p.tail) out.push(P(`M${cx + r * 0.5},${cy + r * 0.6} Q${cx + 70},${cy + 70} ${cx + 50},${cy - 10} Q${cx + 60},${cy + 30} ${cx + r * 0.9},${cy + r * 0.1}Z`, 'alt'), P(poly([[cx + 46, cy - 14], [cx + 62, cy - 30], [cx + 58, cy - 6]]), 'glow'));
  if (p.comet) out.push(P(`M${cx + r * 0.7},${cy - r * 0.7} Q${cx + 90},${cy - 80} ${cx + 96},${cy - 92} Q${cx + 60},${cy - 50} ${cx + r},${cy - r * 0.2}Z`, 'trail'));
  if (p.ram) for (const sd of [-1, 1]) out.push(P(`M${cx + sd * r * 0.5},${cy - r * 0.8} Q${cx + sd * (r + 40)},${cy - r - 30} ${cx + sd * (r + 26)},${cy + 6} Q${cx + sd * (r + 6)},${cy + 18} ${cx + sd * (r + 12)},${cy - 6} Q${cx + sd * (r + 22)},${cy - r} ${cx + sd * r * 0.3},${cy - r * 0.6}Z`, 'alt'));
  if (p.bullHorns) for (const sd of [-1, 1]) out.push(P(`M${cx + sd * r * 0.6},${cy - r * 0.6} Q${cx + sd * (r + 30)},${cy - r * 0.8} ${cx + sd * (r + 24)},${cy - r - 34} Q${cx + sd * (r + 12)},${cy - r * 0.9} ${cx + sd * r * 0.3},${cy - r * 0.85}Z`, 'light'));
  if (p.ring) out.push({ d: ell(cx, cy, r + 30, 12), r: 'ring', w: 5, tf: `rotate(-16 ${cx} ${cy})` });
  if (p.bow) out.push(line(`M${cx - r - 26},${cy - 50} Q${cx - r - 50},${cy} ${cx - r - 26},${cy + 50}`, 5), line(`M${cx - r - 26},${cy - 50} L${cx - r - 26},${cy + 50}`, 1.2), P(poly([[cx - r - 60, cy], [cx + 40, cy - 3], [cx + 40, cy + 3]]), 'glow'));
  if (p.sprout) out.push(line(`M${cx},${cy - r + 4} Q${cx - 4},${cy - r - 26} ${cx + 6},${cy - r - 40}`, 4), P(ell(cx - 12, cy - r - 30, 12, 6), 'alt'), P(ell(cx + 18, cy - r - 38, 12, 6), 'alt'));
  if (p.serpent) { out.push({ d: `M${cx - 80},170 C${cx - 20},120 ${cx + 80},180 ${cx + 60},110 S${cx - 30},80 ${cx},50`, r: 'tube', w: 20 }); out.push({ d: `M${cx - 80},170 C${cx - 20},120 ${cx + 80},180 ${cx + 60},110 S${cx - 30},80 ${cx},50`, r: 'tubeFill', w: 14 }); }
  out.push(P(circ(cx, cy, r), 'core'));
  if (p.fish) out.push(...fish({ cy: cy + 60, rx: 30, ry: 16 }).shapes.map(s => ({ ...s, tf: 'translate(-20 0)' })));
  return { shapes: out, faces: [{ x: cx, y: cy, s: r / 34, kind: p.eyes || 'star', mouth: p.mouth || 'none' }] };
}

const ARCH = { humanoid, quad, blob, robot, serpent, squid, fish, moth, bird, golem, construct, orb };

// ------------------------------------------------------------------ styles
// Each style: defs (patterns/filters), bg(r, spec), paint(role, pal) -> {fill, stroke, sw, extra}, eyes, post (overlays)
const pal3 = (spec, d) => Object.assign({}, d, spec.pal || {});

function defsFor(dim) {
  switch (dim) {
    case 'fallen': return `<pattern id="ht" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3" cy="3" r="1.5" fill="#111"/></pattern>
      <pattern id="ht2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="2.5" cy="2.5" r="1" fill="#3a1d05" opacity=".5"/></pattern>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a33a"/><stop offset=".6" stop-color="#e2683a"/><stop offset="1" stop-color="#7a2e1e"/></linearGradient>
      <filter id="grunge"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.25"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="shadeM" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="#000"/><stop offset=".62" stop-color="#fff"/></linearGradient><mask id="shade"><rect width="200" height="200" fill="url(#shadeM)"/></mask>`;
    case 'martial': return `<pattern id="tone" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2" cy="2" r=".95" fill="#111"/></pattern>
      <linearGradient id="shadeM" x1="0" y1="0" x2="1" y2="0"><stop offset=".5" stop-color="#000"/><stop offset=".56" stop-color="#fff"/></linearGradient><mask id="shade"><rect width="200" height="200" fill="url(#shadeM)"/></mask>`;
    case 'zodiac': return `<radialGradient id="sky" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#2a1a6a"/><stop offset="1" stop-color="#07061c"/></radialGradient>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="neb" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="4" seed="21" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="14"/></filter>`;
    case 'giants': return `<pattern id="h1" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="4" height="1.3" fill="#2b1a0b"/></pattern>
      <pattern id="h2" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><rect width="3.5" height="1.4" fill="#2b1a0b"/></pattern>
      <pattern id="h3" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#2b1a0b"/></pattern>
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="4" seed="9"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .4  0 0 0 0 .2  0 0 0 .5 0"/></filter>
      <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="1" seed="2"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter>
      <linearGradient id="shadeM" x1="0" y1="0" x2="1" y2="1"><stop offset=".45" stop-color="#000"/><stop offset=".6" stop-color="#fff"/></linearGradient><mask id="shade"><rect width="200" height="200" fill="url(#shadeM)"/></mask>`;
    case 'elven': return `<filter id="wc" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="5" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="9" result="d"/><feGaussianBlur in="d" stdDeviation=".8"/></filter>
      <filter id="wc2" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="11" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="4"/></filter>
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .35  0 0 0 .2 0"/></filter>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="moon" cx=".78" cy=".16" r=".45"><stop offset="0" stop-color="#f4f2ff"/><stop offset="1" stop-color="#f4f2ff" stop-opacity="0"/></radialGradient>`;
    case 'necro': return `<linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4fa"/><stop offset=".3" stop-color="#8a8a9a"/><stop offset=".48" stop-color="#2a2a34"/><stop offset=".52" stop-color="#c8c8d6"/><stop offset="1" stop-color="#3a3a46"/></linearGradient>
      <linearGradient id="chrome2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a5a68"/><stop offset=".5" stop-color="#16161c"/><stop offset="1" stop-color="#6a6a7a"/></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.4" fill="#000" opacity=".35"/></pattern>
      <radialGradient id="halo" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#ff1f3d" stop-opacity=".45"/><stop offset="1" stop-color="#ff1f3d" stop-opacity="0"/></radialGradient>`;
    case 'junk': return `<filter id="crayon" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="1" result="g"/><feColorMatrix in="g" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.3" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>
      <filter id="wob"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="6"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter>
      <filter id="kraft"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .33  0 0 0 0 .2  0 0 0 .35 0"/></filter>
      <filter id="shadow"><feDropShadow dx="3" dy="4" stdDeviation="2.5" flood-color="#3a2a14" flood-opacity=".45"/></filter>`;
    case 'abyss': return `<radialGradient id="sky" cx=".5" cy=".1" r="1"><stop offset="0" stop-color="#0b2a4a"/><stop offset=".5" stop-color="#04101f"/><stop offset="1" stop-color="#010409"/></radialGradient>
      <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="big" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
      <radialGradient id="eye" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ffe95a"/><stop offset="1" stop-color="#ff8a1a"/></radialGradient>`;
    case 'dream': return `<linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6ec"/><stop offset=".5" stop-color="#e6d4ff"/><stop offset="1" stop-color="#c8e6ff"/></linearGradient>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    case 'clock': return `<radialGradient id="sky" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#1f5ea6"/><stop offset="1" stop-color="#123c74"/></radialGradient>
      <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#c8922e"/><stop offset="1" stop-color="#7a5414"/></linearGradient>`;
  }
  return '';
}

function mixHex(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

// paint a role for a style. returns attribute string
function paint(dim, role, pal, uid) {
  const col = (k) => pal[k] || '#888';
  switch (dim) {
    case 'fallen': {
      const ink = 'stroke="#111" stroke-width="4" stroke-linejoin="round"';
      if (role === 'glow') return `fill="${pal.glow || '#b8ff5a'}" ${ink} filter="url(#glow)"`;
      if (role === 'line') return 'fill="none" stroke="#111" stroke-linecap="round"';
      if (role === 'beam') return 'fill="#b8ff5a" opacity=".3"';
      return `fill="${col(role)}" ${ink}`;
    }
    case 'martial': {
      const ink = 'stroke="#111" stroke-width="3.5" stroke-linejoin="round"';
      if (role === 'line') return 'fill="none" stroke="#111" stroke-linecap="round"';
      if (role === 'dark') return `fill="#111" ${ink}`;
      if (role === 'accent' || role === 'glow') return `fill="#e01b24" ${ink}`;
      return `fill="#fff" ${ink}`;
    }
    case 'zodiac': {
      if (role === 'core') return `fill="url(#core${uid})" filter="url(#glow)"`;
      if (role === 'line') return `fill="none" stroke="#fff6c8" stroke-linecap="round" filter="url(#glow)"`;
      if (role === 'ring') return `fill="none" stroke="#fff6c8" opacity=".7"`;
      if (role === 'trail') return `fill="${col('main')}" opacity=".55" filter="url(#glow)"`;
      if (role === 'glow' || role === 'light') return `fill="#fffbe0" filter="url(#glow)"`;
      return `fill="${col(role === 'dark' ? 'alt' : role)}" opacity=".85" stroke="#c9a23a" stroke-width="1.6" filter="url(#glow)"`;
    }
    case 'giants': {
      const ink = 'stroke="#2b1a0b" stroke-width="3" stroke-linejoin="round"';
      if (role === 'line') return 'fill="none" stroke="#2b1a0b" stroke-linecap="round"';
      if (role === 'dark') return `fill="#2b1a0b" ${ink}`;
      if (role === 'alt') return `fill="url(#h1)" ${ink}`;
      if (role === 'accent' || role === 'glow') return `fill="url(#h2)" ${ink}`;
      return `fill="#eadcb8" ${ink}`;
    }
    case 'elven': {
      if (role === 'line') return `fill="none" stroke="${pal.dark || '#3a2a4a'}" stroke-linecap="round" opacity=".9"`;
      if (role === 'glow') return `fill="#9affff" filter="url(#glow)"`;
      return `fill="${col(role)}" opacity="${role === 'light' ? .7 : .88}"`;
    }
    case 'necro': {
      const ink = 'stroke="#000" stroke-width="2" stroke-linejoin="round"';
      if (role === 'glow' || role === 'accent') return `fill="#ff1f3d" filter="url(#glow)"`;
      if (role === 'line') return 'fill="none" stroke="#9a9aa8" stroke-linecap="round"';
      if (role === 'dark') return `fill="#111116" stroke="#8a8a9a" stroke-width="1.2"`;
      if (role === 'alt') return `fill="url(#chrome2)" ${ink}`;
      return `fill="url(#chrome)" ${ink}`;
    }
    case 'junk': {
      const ink = 'stroke="#222" stroke-width="3.2" stroke-linejoin="round"';
      if (role === 'line') return 'fill="none" stroke="#222" stroke-linecap="round"';
      if (role === 'glow') return `fill="#9adf5a" ${ink}`;
      return `fill="${col(role)}" ${ink}`;
    }
    case 'abyss': {
      const g = pal.glow || '#3ff2ff';
      if (role === 'spot') return `fill="#ff5ad8" filter="url(#glow)"`;
      if (role === 'glow' || role === 'accent') return `fill="${role === 'accent' ? '#ff5ad8' : g}" filter="url(#glow)"`;
      if (role === 'line') return `fill="none" stroke="${g}" stroke-linecap="round" filter="url(#glow)"`;
      if (role === 'light') return `fill="#0e2238" stroke="${g}" stroke-width="1.2" filter="url(#glow)"`;
      return `fill="${role === 'dark' ? '#050c18' : '#0c1a2e'}" stroke="${g}" stroke-width="1.8" filter="url(#glow)"`;
    }
    case 'dream': {
      if (role === 'line') return `fill="none" stroke="${pal.alt || '#8a6ad8'}" stroke-linecap="round" opacity=".8"`;
      if (role === 'glow' || role === 'light') return `fill="#fff" filter="url(#bloom)"`;
      if (role === 'dark') return `fill="${mixHex(col('main'), '#5a4a8a', 0.5)}"`;
      return `fill="url(#g_${role}${uid})"`;
    }
    case 'clock': {
      const w = 'stroke="#fff" stroke-width="1.8" stroke-linejoin="round"';
      if (role === 'metal' || role === 'accent') return `fill="url(#brass)" stroke="#fff" stroke-width="1.4"`;
      if (role === 'glow') return `fill="#ffe9a8" stroke="#fff" stroke-width="1.4"`;
      if (role === 'line' || role === 'ring') return 'fill="none" stroke="#fff" stroke-linecap="round"';
      if (role === 'light') return `fill="#f4ecd6" stroke="#7a5414" stroke-width="1.4"`;
      if (role === 'dark') return `fill="#0e2f5e" ${w}`;
      return `fill="#1a4f8e" fill-opacity=".35" ${w}`;
    }
  }
  return 'fill="#888"';
}

// eyes per style
function face(dim, f, pal) {
  const { x, y } = f, s = f.s || 1, k = f.kind;
  const ink = { fallen: '#111', martial: '#111', giants: '#2b1a0b', junk: '#111', elven: '#2a3a5a', dream: '#9a7ab8', necro: '#ff1f3d', abyss: '#120400', zodiac: '#7a1a40', clock: '#fff' }[dim];
  const gap = 9 * s, ey = y - 2 * s;
  let o = '';
  if (k === 'glow' || dim === 'abyss' || dim === 'necro') {
    const c = dim === 'abyss' ? 'url(#eye)' : dim === 'necro' ? '#ff1f3d' : dim === 'elven' ? '#9affff' : dim === 'zodiac' ? '#fff' : '#b8ff5a';
    for (const sd of [-1, 1]) o += `<ellipse cx="${f1(x + sd * gap)}" cy="${f1(ey)}" rx="${f1(5 * s)}" ry="${f1(4 * s)}" fill="${c}" filter="url(#glow)"/>`;
    if (dim === 'abyss') for (const sd of [-1, 1]) o += `<rect x="${f1(x + sd * gap - 1.2 * s)}" y="${f1(ey - 4 * s)}" width="${f1(2.4 * s)}" height="${f1(8 * s)}" rx="1" fill="#120400"/>`;
    return o;
  }
  if (k === 'sleepy' || dim === 'dream' && k !== 'awake') {
    for (const sd of [-1, 1]) o += `<path d="M${f1(x + sd * gap - 5 * s)},${f1(ey)} Q${f1(x + sd * gap)},${f1(ey + 5 * s)} ${f1(x + sd * gap + 5 * s)},${f1(ey)}" fill="none" stroke="${ink}" stroke-width="${f1(2.4 * s)}" stroke-linecap="round"/>`;
    if (dim === 'dream') for (const sd of [-1, 1]) o += `<ellipse cx="${f1(x + sd * (gap + 4 * s))}" cy="${f1(ey + 8 * s)}" rx="${f1(5 * s)}" ry="${f1(3 * s)}" fill="#ff9cc2" opacity=".6"/>`;
    return o;
  }
  if (k === 'star' || dim === 'zodiac') {
    for (const sd of [-1, 1]) o += `<path d="M${f1(x + sd * gap - 6 * s)},${f1(ey - 2 * s)} L${f1(x + sd * gap + 6 * s)},${f1(ey)} L${f1(x + sd * gap + 5 * s)},${f1(ey + 4 * s)} L${f1(x + sd * gap - 5 * s)},${f1(ey + 3 * s)}Z" fill="#7a1a40"/>`;
    for (const sd of [-1, 1]) o += `<path d="M${f1(x + sd * gap - 3 * s)},${f1(ey + 1 * s)} L${f1(x + sd * gap + 3 * s)},${f1(ey + 1.5 * s)}" stroke="#fff" stroke-width="${f1(1.8 * s)}" stroke-linecap="round"/>`;
    return o;
  }
  if (k === 'slit') {
    for (const sd of [-1, 1]) o += `<ellipse cx="${f1(x + sd * gap)}" cy="${f1(ey)}" rx="${f1(5 * s)}" ry="${f1(4 * s)}" fill="#ffd23a" stroke="${ink}" stroke-width="1.5"/><rect x="${f1(x + sd * gap - 1 * s)}" y="${f1(ey - 3.6 * s)}" width="${f1(2 * s)}" height="${f1(7.2 * s)}" fill="${ink}"/>`;
    return o;
  }
  if (k === 'hollow') {
    for (const sd of [-1, 1]) o += `<ellipse cx="${f1(x + sd * gap * 1.4)}" cy="${f1(ey)}" rx="${f1(7 * s)}" ry="${f1(9 * s)}" fill="${ink}"/>`;
    return o;
  }
  if (k === 'side') {
    o += `<circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(5.5 * s)}" fill="#fff" stroke="${ink}" stroke-width="${dim === 'martial' || dim === 'fallen' ? 2.5 : 1.8}"/><circle cx="${f1(x - 1.4 * s)}" cy="${f1(ey + 0.6 * s)}" r="${f1(2.8 * s)}" fill="${ink}"/>`;
    if (dim === 'martial' || dim === 'fallen') o += `<path d="M${f1(x - 8 * s)},${f1(ey - 8 * s)} L${f1(x + 6 * s)},${f1(ey - 5 * s)}" stroke="${ink}" stroke-width="${f1(3 * s)}" stroke-linecap="round"/>`;
    return o;
  }
  if (k === 'angry' || dim === 'martial') {
    for (const sd of [-1, 1]) o += `<path d="M${f1(x + sd * (gap + 6 * s))},${f1(ey - 2 * s)} L${f1(x + sd * (gap - 6 * s))},${f1(ey - 4 * s)} L${f1(x + sd * (gap - 5 * s))},${f1(ey + 4 * s)} Q${f1(x + sd * gap)},${f1(ey + 5 * s)} ${f1(x + sd * (gap + 5 * s))},${f1(ey + 2 * s)}Z" fill="${ink}"/><rect x="${f1(x + sd * gap - (sd > 0 ? 0 : 3) * s)}" y="${f1(ey - 1 * s)}" width="${f1(3 * s)}" height="${f1(3 * s)}" fill="#fff"/>`;
    o += `<path d="M${f1(x - gap - 8 * s)},${f1(ey - 10 * s)} L${f1(x - 3 * s)},${f1(ey - 6 * s)} M${f1(x + gap + 8 * s)},${f1(ey - 10 * s)} L${f1(x + 3 * s)},${f1(ey - 6 * s)}" stroke="${ink}" stroke-width="${f1(3.4 * s)}" stroke-linecap="round"/>`;
    o += `<path d="M${f1(x - 5 * s)},${f1(ey + 12 * s)} L${f1(x + 5 * s)},${f1(ey + 12 * s)}" stroke="${ink}" stroke-width="${f1(2.4 * s)}" stroke-linecap="round"/>`;
    return o;
  }
  if (k === 'calm' || dim === 'elven') {
    for (const sd of [-1, 1]) o += `<path d="M${f1(x + sd * gap - 4 * s)},${f1(ey)} Q${f1(x + sd * gap)},${f1(ey - 3 * s)} ${f1(x + sd * gap + 4 * s)},${f1(ey)}" fill="none" stroke="${dim === 'elven' ? '#9affff' : ink}" stroke-width="${f1(2.6 * s)}" stroke-linecap="round" ${dim === 'elven' ? 'filter="url(#glow)"' : ''}/>`;
    if (dim === 'elven') for (const sd of [-1, 1]) o += `<path d="M${f1(x + sd * gap - 2 * s)},${f1(ey + 4 * s)} L${f1(x + sd * gap + sd * 2 * s)},${f1(ey + 12 * s)}" stroke="#2c6a6a" stroke-width="${f1(1.8 * s)}"/>`;
    o += `<path d="M${f1(x - 4 * s)},${f1(ey + 14 * s)} Q${f1(x)},${f1(ey + 16 * s)} ${f1(x + 4 * s)},${f1(ey + 14 * s)}" fill="none" stroke="${ink}" stroke-width="${f1(1.4 * s)}"/>`;
    return o;
  }
  // round (default)
  const rr = (dim === 'junk' ? 7 : 5) * s;
  for (const sd of [-1, 1]) {
    const ring = dim === 'junk' ? (sd < 0 ? '#d83a2a' : '#2f6fd6') : '#fff';
    o += `<circle cx="${f1(x + sd * gap)}" cy="${f1(ey)}" r="${f1(rr)}" fill="${ring}" stroke="${ink}" stroke-width="${dim === 'clock' ? 1.4 : 2.2}"/><circle cx="${f1(x + sd * gap + 0.8 * s)}" cy="${f1(ey + 0.6 * s)}" r="${f1(rr * 0.5)}" fill="${dim === 'clock' ? '#123c74' : '#111'}"/><circle cx="${f1(x + sd * gap - 0.6 * s)}" cy="${f1(ey - 1 * s)}" r="${f1(rr * 0.18)}" fill="#fff"/>`;
  }
  if (f.mouth === 'o') o += `<ellipse cx="${f1(x)}" cy="${f1(ey + 14 * s)}" rx="${f1(4 * s)}" ry="${f1(5 * s)}" fill="${ink}"/>`;
  else if (f.mouth === 'teeth') o += `<path d="M${f1(x - 9 * s)},${f1(ey + 11 * s)} Q${f1(x)},${f1(ey + 20 * s)} ${f1(x + 9 * s)},${f1(ey + 11 * s)} L${f1(x + 6 * s)},${f1(ey + 14 * s)} L${f1(x + 3 * s)},${f1(ey + 11 * s)} L${f1(x)},${f1(ey + 15 * s)} L${f1(x - 3 * s)},${f1(ey + 11 * s)} L${f1(x - 6 * s)},${f1(ey + 14 * s)}Z" fill="#fff" stroke="${ink}" stroke-width="1.6"/>`;
  else if (f.mouth !== 'none') o += `<path d="M${f1(x - 5 * s)},${f1(ey + 11 * s)} Q${f1(x)},${f1(ey + 15 * s)} ${f1(x + 5 * s)},${f1(ey + 11 * s)}" fill="none" stroke="${ink}" stroke-width="${f1(2 * s)}" stroke-linecap="round"/>`;
  return o;
}

// backgrounds per dimension, varied per being
function background(dim, r, pal, uid) {
  const R = (a, b) => a + r() * (b - a);
  switch (dim) {
    case 'fallen': {
      let sky = '<rect width="200" height="200" fill="url(#sky)"/><rect width="200" height="200" fill="url(#ht2)"/>';
      if (r() < 0.6) sky += `<path d="M${f1(R(110, 140))} 22 q20 -12 46 0 q-26 10 -46 0Z" fill="#1a1410"/>`;
      let city = 'M0 150';
      for (let x = 0; x < 200;) { const w = R(10, 24), h = R(20, 70); city += ` L${f1(x)} ${f1(150 - h)} L${f1(x + w)} ${f1(150 - h)} L${f1(x + w)} 150`; x += w + R(0, 8); }
      return sky + `<path d="${city} L200 150 L200 150Z" fill="#1a1410"/><rect y="150" width="200" height="50" fill="#2a1d14"/><path d="M0 150 L200 150" stroke="#111" stroke-width="4"/>`;
    }
    case 'martial': {
      let s = '<rect width="200" height="200" fill="#fff"/>';
      const cx = 100, cy = 104;
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * 2 * Math.PI + R(-0.03, 0.03), r0 = R(64, 84), w = R(0.6, 2.4);
        const x0 = cx + r0 * Math.cos(a), y0 = cy + r0 * Math.sin(a), x1 = cx + 160 * Math.cos(a), y1 = cy + 160 * Math.sin(a), nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
        s += `<path d="M${f1(x0)} ${f1(y0)} L${f1(x1 + nx)} ${f1(y1 + ny)} L${f1(x1 - nx)} ${f1(y1 - ny)}Z" fill="#111"/>`;
      }
      return s + '<ellipse cx="100" cy="182" rx="50" ry="7" fill="url(#tone)"/>';
    }
    case 'zodiac': {
      let s = '<rect width="200" height="200" fill="#07061c"/>';
      const cols = ['#141a52', '#1c1f66', '#26196a', '#0f2f6a', '#331a5e'];
      for (const [r0, r1, n] of [[70, 104, 12], [104, 150, 16]]) for (let i = 0; i < n; i++) {
        const a0 = i / n * 2 * Math.PI, a1 = (i + 1) / n * 2 * Math.PI;
        s += `<path d="${poly([[100 + r0 * Math.cos(a0), 100 + r0 * Math.sin(a0)], [100 + r1 * Math.cos(a0), 100 + r1 * Math.sin(a0)], [100 + r1 * Math.cos(a1), 100 + r1 * Math.sin(a1)], [100 + r0 * Math.cos(a1), 100 + r0 * Math.sin(a1)]])}" fill="${cols[Math.floor(r() * cols.length)]}" stroke="#c9a23a" stroke-width="1.6"/>`;
      }
      s += '<circle cx="100" cy="100" r="70" fill="url(#sky)" stroke="#c9a23a" stroke-width="2.5"/>';
      for (let i = 0; i < 40; i++) s += `<circle cx="${f1(R(0, 200))}" cy="${f1(R(0, 200))}" r="${f1(R(0.5, 1.5))}" fill="#fff" opacity="${f1(R(0.4, 1))}"/>`;
      s += `<g filter="url(#neb)" opacity=".7"><circle cx="${f1(R(40, 160))}" cy="${f1(R(130, 170))}" r="${f1(R(20, 34))}" fill="${pal.main}" opacity=".35"/><circle cx="${f1(R(40, 160))}" cy="${f1(R(40, 80))}" r="${f1(R(14, 24))}" fill="#ff7ad8" opacity=".25"/></g>`;
      return s;
    }
    case 'giants': {
      let s = '<rect width="200" height="200" fill="#eadcb8"/><rect width="200" height="200" filter="url(#paper)" opacity=".55"/>';
      s += '<path d="M0 168 Q50 156 100 166 T200 160 L200 200 L0 200Z" fill="url(#h3)"/>';
      if (r() < 0.7) for (let i = 0; i < 3; i++) { const x = R(6, 190); s += `<path d="M${f1(x)} 168 L${f1(x)} 150 L${f1(x - 4)} 150 L${f1(x + 4)} 136 L${f1(x + 12)} 150 L${f1(x + 8)} 150 L${f1(x + 8)} 168Z" fill="#2b1a0b" opacity=".85"/>`; }
      return s;
    }
    case 'elven': return `<rect width="200" height="200" fill="#ece8f4"/><g filter="url(#wc)"><path d="M-10 -10 L210 -10 L210 150 L-10 160Z" fill="#5a5aa8" opacity=".55"/><path d="M-10 -10 L210 -10 L210 70 Q100 90 -10 60Z" fill="#3a3a86" opacity=".5"/><rect width="200" height="200" fill="url(#moon)"/><circle cx="${f1(R(140, 170))}" cy="${f1(R(24, 40))}" r="14" fill="#f8f6ff" opacity=".95"/><path d="M0 200 L0 ${f1(R(60, 80))} Q14 30 28 74 Q40 36 50 90 L52 200Z" fill="#2c3a6e" opacity=".6"/><path d="M154 200 L156 90 Q170 50 182 92 Q194 64 206 96 L206 200Z" fill="#24346a" opacity=".6"/><path d="M-10 172 Q60 150 120 166 T210 160 L210 210 L-10 210Z" fill="#3c5a7a" opacity=".6"/></g>`;
    case 'necro': {
      let s = '<rect width="200" height="200" fill="#07070a"/><rect width="200" height="200" fill="url(#halo)"/>';
      for (let x = -200; x < 420; x += 40) s += `<path d="M100 130 L${x} 200" stroke="#ff1f3d" stroke-width=".8" opacity=".5"/>`;
      for (const y of [134, 140, 149, 161, 178, 200]) s += `<path d="M0 ${y} L200 ${y}" stroke="#ff1f3d" stroke-width=".8" opacity="${f1(0.25 + 0.4 * (y - 130) / 70)}"/>`;
      return s;
    }
    case 'junk': {
      const sc = ['#2f6fd6', '#e23a2a', '#2a9a4a', '#e2a02a'];
      let s = '<rect width="200" height="200" fill="#c9a878"/><rect width="200" height="200" filter="url(#kraft)"/><g filter="url(#crayon)" opacity=".8">';
      for (let i = 0; i < 3; i++) { const x = R(10, 170), y = R(10, 180); s += `<path d="M${f1(x)} ${f1(y)} q${f1(R(10, 30))} ${f1(R(-20, 20))} ${f1(R(30, 50))} ${f1(R(-10, 10))}" fill="none" stroke="${sc[i % 4]}" stroke-width="5" stroke-linecap="round"/>`; }
      return s + '</g>';
    }
    case 'abyss': {
      let s = '<rect width="200" height="200" fill="url(#sky)"/><path d="M70 0 L40 200 L60 200 L84 0Z M120 0 L140 200 L150 200 L128 0Z" fill="#3ff2ff" opacity=".04"/>';
      for (let i = 0; i < 50; i++) s += `<circle cx="${f1(R(0, 200))}" cy="${f1(R(0, 200))}" r="${f1(R(0.4, 1.4))}" fill="#bff" opacity="${f1(R(0.15, 0.6))}"/>`;
      return s;
    }
    case 'dream': {
      let s = `<rect width="200" height="200" fill="url(#sky)"/><g filter="url(#soft)" opacity=".9"><circle cx="${f1(R(20, 60))}" cy="${f1(R(20, 50))}" r="24" fill="#fff"/><circle cx="${f1(R(140, 180))}" cy="${f1(R(140, 170))}" r="28" fill="#fff6c8"/><ellipse cx="100" cy="188" rx="90" ry="20" fill="#fff"/></g>`;
      for (let i = 0; i < 3; i++) { const x = R(14, 186), y = R(14, 120); s += `<path d="M${f1(x)} ${f1(y)} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2Z" fill="#fff" filter="url(#bloom)"/>`; }
      return s;
    }
    case 'clock': {
      let s = '<rect width="200" height="200" fill="url(#sky)"/>';
      for (let i = 0; i <= 200; i += 10) s += `<path d="M${i} 0 L${i} 200 M0 ${i} L200 ${i}" stroke="#fff" stroke-width="${i % 40 ? 0.6 : 1}" opacity="${i % 40 ? 0.12 : 0.22}"/>`;
      s += `<circle cx="100" cy="108" r="${f1(R(56, 70))}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3 4" opacity=".45"/><path d="M100 24 L100 194 M14 108 L186 108" stroke="#fff" stroke-width="1" stroke-dasharray="10 3 2 3" opacity=".35"/>`;
      return s;
    }
  }
  return '<rect width="200" height="200" fill="#222"/>';
}

const DEFAULT_PAL = {
  fallen: { main: '#7d8a80', alt: '#5c6b4a', skin: '#e8b088', dark: '#3a3530', accent: '#c2362f', light: '#d8d0b0', metal: '#a9b2ab', glow: '#b8ff5a' },
  martial: {},
  zodiac: { main: '#ffb52e', alt: '#7a3ad8', skin: '#ffe0a0' },
  giants: {},
  elven: { main: '#4a2f6e', alt: '#dfe8ff', skin: '#b6b2ee', dark: '#3a2a4a', accent: '#6aa88a', light: '#a8a2e6', metal: '#c8d0e0' },
  necro: {},
  junk: { main: '#b8bcbe', alt: '#8c8c86', skin: '#c8b090', dark: '#5a5048', accent: '#e8d23a', light: '#f0ead8', metal: '#a0a4a8' },
  abyss: {},
  dream: { main: '#f1e8ff', alt: '#8fd0ff', skin: '#fff0f4', accent: '#ff9cc2', light: '#ffffff', metal: '#e0d0ff' },
  clock: {},
};

function render(id) {
  const def = MON[id], dim = def.type, spec = SPECS[id] || { arch: 'blob' };
  const r = makeRng(hash(id) ^ 0x5bd1e995);
  const pal = pal3(spec, DEFAULT_PAL[dim] || {});
  const uid = id.replace(/[^a-z0-9]/gi, '');
  const body = ARCH[spec.arch](spec);
  let defs = defsFor(dim);
  if (dim === 'zodiac') defs += `<radialGradient id="core${uid}" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${mixHex(pal.main, '#ffffff', 0.6)}"/><stop offset=".8" stop-color="${pal.main}"/><stop offset="1" stop-color="${pal.alt}"/></radialGradient>`;
  if (dim === 'dream') for (const k of ['main', 'alt', 'skin', 'accent', 'metal']) defs += `<radialGradient id="g_${k}${uid}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="${pal[k] || pal.main}"/><stop offset="1" stop-color="${mixHex(pal[k] || pal.main, '#9a7ad8', 0.35)}"/></radialGradient>`;
  const bg = background(dim, r, pal, uid);
  // shapes -> svg
  const shape = (s) => {
    if (s.r === 'tube' || s.r === 'tubeFill' || s.r === 'ring') {
      let st;
      const outline = { fallen: '#111', martial: '#111', giants: '#2b1a0b', junk: '#222', necro: '#000', abyss: pal.glow || '#3ff2ff', elven: pal.dark || '#3a2a4a', dream: '#c9b6ff', zodiac: '#c9a23a', clock: '#fff' }[dim];
      if (s.r === 'ring') st = paint(dim, 'ring', pal, uid);
      else if (s.r === 'tube') st = `fill="none" stroke="${outline}" ${dim === 'abyss' ? 'filter="url(#glow)"' : ''}`;
      else {
        const fillAttr = paint(dim, 'main', pal, uid).match(/fill="([^"]+)"/);
        st = `fill="none" stroke="${dim === 'abyss' ? '#0c1a2e' : dim === 'clock' ? '#1a4f8e' : fillAttr ? fillAttr[1] : '#888'}"`;
      }
      return `<path d="${s.d}" ${st} stroke-width="${s.w}" ${st.includes('linecap') ? '' : 'stroke-linecap="round"'} ${s.tf ? `transform="${s.tf}"` : ''}/>`;
    }
    const a = paint(dim, s.r, pal, uid);
    return `<path d="${s.d}" ${a} ${s.w ? `stroke-width="${s.w}"` : ''} ${s.tf ? `transform="${s.tf}"` : ''}/>`;
  };
  let fig = body.shapes.map(shape).join('');
  const faces = body.faces.map(f => face(dim, f, pal)).join('');
  // style post-processing around the figure
  const solid = body.shapes.filter(s => s.r !== 'line' && s.r !== 'tube' && s.r !== 'tubeFill' && s.r !== 'ring' && s.r !== 'beam' && s.r !== 'glow');
  const shadeFill = (pat) => `<g mask="url(#shade)">${solid.map(s => `<path d="${s.d}" fill="url(#${pat})" ${s.tf ? `transform="${s.tf}"` : ''}/>`).join('')}</g>`;
  let out = '';
  switch (dim) {
    case 'fallen': out = fig + shadeFill('ht') + faces + '<rect width="200" height="200" fill="#3a2210" filter="url(#grunge)" opacity=".45"/>'; break;
    case 'martial': out = fig + shadeFill('tone') + faces; break;
    case 'giants': out = `<g filter="url(#rough)">${fig}${shadeFill('h2')}${faces}</g><rect x="5" y="5" width="190" height="190" fill="none" stroke="#2b1a0b" stroke-width="2"/><rect x="9" y="9" width="182" height="182" fill="none" stroke="#2b1a0b" stroke-width=".8"/>`; break;
    case 'elven': out = `<g filter="url(#wc2)">${fig}</g>${body.shapes.filter(s => s.r !== 'line').map(s => `<path d="${s.d}" fill="none" stroke="#3a3070" stroke-width=".8" opacity=".45" ${s.tf ? `transform="${s.tf}"` : ''}/>`).join('')}${faces}<rect width="200" height="200" filter="url(#paper)"/>`; break;
    case 'necro': out = fig + faces + '<rect width="200" height="200" fill="url(#scan)"/>'; break;
    case 'junk': out = `<g filter="url(#shadow)"><g filter="url(#wob)">${solid.map(s => `<path d="${s.d}" fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round" ${s.tf ? `transform="${s.tf}"` : ''}/>`).join('')}</g></g><g filter="url(#wob)">${fig}${faces}</g><rect x="${f1(20 + r() * 20)}" y="22" width="46" height="14" fill="#f2e6b8" opacity=".75" transform="rotate(-24 57 33)"/><rect x="124" y="166" width="50" height="14" fill="#f2e6b8" opacity=".75" transform="rotate(18 149 173)"/>`; break;
    case 'zodiac': out = `<circle cx="100" cy="100" r="60" fill="${pal.main}" opacity=".25" filter="url(#soft)"/>${fig}${faces}<rect x="2" y="2" width="196" height="196" fill="none" stroke="#c9a23a" stroke-width="4"/>`; break;
    case 'clock': out = fig + faces + `<g font-family="Consolas, 'Courier New', monospace" fill="#fff" font-size="7"><text x="10" y="16">${def.name.toUpperCase().slice(0, 18)}</text><text x="10" y="26" opacity=".7">SHEET T${def.tier}</text></g>`; break;
    case 'abyss': out = fig + faces + `<circle cx="100" cy="190" r="40" fill="${pal.glow || '#3ff2ff'}" opacity=".06" filter="url(#big)"/>`; break;
    default: out = fig + faces;
  }
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${bg}${out}</svg>`;
}

// full SVG source (also used by tools to export a gallery)
export function monSource(id) {
  if (HAND[id]) return HAND[id];
  return render(id);
}

export function monSvg(id) {
  if (cache.has(id)) return cache.get(id);
  const src = monSource(id);
  const html = `<img class="mon-svg mon-img" alt="" draggable="false" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}">`;
  cache.set(id, html);
  return html;
}
