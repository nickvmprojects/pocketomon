// Procedural mon art: every mon gets a stable little creature from its id, styled by type and tier.
import { MON, TYPES } from './data.js';
import { makeRng, hash } from './rng.js';

const INK = '#1b1424';
const cache = new Map();

function mix(hex, to, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

// smooth closed blob through polar points
function blob(cx, cy, rx, ry, wob, n, r, flatBottom) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    let k = 1 + (r() - 0.5) * wob;
    let y = cy + Math.sin(a) * ry * k;
    if (flatBottom && Math.sin(a) > 0.6) y = Math.min(y, cy + ry * 0.92);
    pts.push([cx + Math.cos(a) * rx * k, y]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) { const l = pts[n - 1]; d += `M${((l[0] + p[0]) / 2).toFixed(1)},${((l[1] + p[1]) / 2).toFixed(1)}`; }
    d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
  }
  return d + 'Z';
}

export function monSvg(id) {
  if (cache.has(id)) return cache.get(id);
  const def = MON[id];
  const T = TYPES[def.type];
  const r = makeRng(hash(id));
  const ALT = { fire: '#ff3d5a', water: '#3fe0d0', grass: '#b8e04a', electric: '#ffb12e', ice: '#b9c8ff', rock: '#9c8f86', poison: '#ff5ad0', psychic: '#c77dff', ghost: '#5b5fd6', junk: '#7f9a8a', sound: '#ff7a5a' };
  const base = mix(T.color, ALT[def.type], r() * 0.45);
  const c = mix(base, r() < 0.5 ? '#ffffff' : '#000000', r() * 0.15), dk = mix(c, '#000000', 0.38), lt = mix(c, '#ffffff', 0.55);
  const accent = mix(ALT[def.type], '#ffffff', 0.2);
  const tier = def.tier;
  const rx = 12 + tier * 1.3 + r() * 2.5;
  const ry = rx * (0.78 + r() * 0.35);
  const cx = 32, cy = 40 - (ry - 14) * 0.3;
  const top = cy - ry, ghost = def.type === 'ghost';
  const back = [], front = [], body = [];
  const sw = 1.6;

  // ---- aura for tier 5
  if (tier === 5) back.push(`<circle cx="32" cy="${cy}" r="${rx + 10}" fill="${lt}" opacity="0.28"/><circle cx="32" cy="${cy}" r="${rx + 5}" fill="${lt}" opacity="0.25"/>`);

  // ---- type features behind the body
  const t = def.type;
  if (t === 'fire') {
    const fx = cx + (r() - 0.5) * 6;
    back.push(`<path d="M${fx - 7},${top + 6} Q${fx - 9},${top - 8} ${fx},${top - 14 - tier} Q${fx + 2},${top - 4} ${fx + 5},${top - 8} Q${fx + 10},${top - 1} ${fx + 7},${top + 6}Z" fill="#ffb02e" stroke="${INK}" stroke-width="${sw}"/>`);
    back.push(`<path d="M${fx - 3},${top + 5} Q${fx - 4},${top - 3} ${fx},${top - 7} Q${fx + 4},${top - 2} ${fx + 3},${top + 5}Z" fill="#fff07a"/>`);
    back.push(`<path d="M${cx + rx - 3},${cy + 4} Q${cx + rx + 9},${cy} ${cx + rx + 8},${cy - 9} Q${cx + rx + 4},${cy - 3} ${cx + rx - 2},${cy - 2}Z" fill="#ff8a2e" stroke="${INK}" stroke-width="${sw}"/>`);
  } else if (t === 'water') {
    back.push(`<path d="M${cx - 5},${top + 4} Q${cx + 2},${top - 12} ${cx + 9},${top - 9} Q${cx + 5},${top - 2} ${cx + 6},${top + 5}Z" fill="${lt}" stroke="${INK}" stroke-width="${sw}"/>`);
    back.push(`<path d="M${cx - rx + 2},${cy + 2} Q${cx - rx - 9},${cy - 2} ${cx - rx - 7},${cy + 9} Q${cx - rx - 2},${cy + 7} ${cx - rx + 3},${cy + 8}Z" fill="${lt}" stroke="${INK}" stroke-width="${sw}"/>`);
  } else if (t === 'grass') {
    const n = 1 + Math.min(3, Math.floor(tier / 2) + r.int(2));
    for (let i = 0; i < n; i++) {
      const a = -30 + (60 / Math.max(1, n - 1)) * i * (n > 1 ? 1 : 0) + (n === 1 ? 0 : 0);
      back.push(`<ellipse cx="${cx}" cy="${top - 6}" rx="4.5" ry="9" fill="#7be26f" stroke="${INK}" stroke-width="${sw}" transform="rotate(${a} ${cx} ${top + 2})"/>`);
    }
  } else if (t === 'electric') {
    const ex = rx * 0.55;
    for (const s of [-1, 1]) back.push(`<path d="M${cx + s * ex - 4},${top + 6} L${cx + s * (ex + 6)},${top - 12} L${cx + s * ex + 1},${top - 2} L${cx + s * (ex + 3)},${top + 6}Z" fill="${c}" stroke="${INK}" stroke-width="${sw}"/><path d="M${cx + s * (ex + 6)},${top - 12} L${cx + s * (ex + 3.4)},${top - 5} L${cx + s * (ex + 5.6)},${top - 6}Z" fill="${INK}"/>`);
    back.push(`<path d="M${cx + rx - 2},${cy + 3} L${cx + rx + 6},${cy - 2} L${cx + rx + 3},${cy - 4} L${cx + rx + 11},${cy - 12} L${cx + rx + 5},${cy - 9} L${cx + rx + 8},${cy - 6} L${cx + rx - 1},${cy - 2}Z" fill="${c}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`);
  } else if (t === 'ice') {
    const n = 2 + Math.min(3, Math.floor(tier / 2));
    for (let i = 0; i < n; i++) {
      const x = cx - rx * 0.6 + (rx * 1.2 / (n - 1)) * i, h = 8 + r() * 6 + (i % 2 ? 0 : 3);
      back.push(`<path d="M${x - 3.5},${top + 7} L${x},${top - h} L${x + 3.5},${top + 7}Z" fill="#e6fbff" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`);
    }
  } else if (t === 'rock') {
    for (let i = 0; i < 3; i++) {
      const x = cx - rx * 0.5 + rx * 0.5 * i, y = top + 2 + (i === 1 ? -3 : 0);
      back.push(`<path d="M${x - 6},${y + 5} L${x - 4},${y - 4} L${x + 3},${y - 6} L${x + 6},${y + 3}Z" fill="#8f8a82" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`);
    }
  } else if (t === 'junk') {
    back.push(`<line x1="${cx + 3}" y1="${top + 2}" x2="${cx + 8}" y2="${top - 11}" stroke="${INK}" stroke-width="2"/><circle cx="${cx + 8}" cy="${top - 12}" r="3.2" fill="#ff5a5a" stroke="${INK}" stroke-width="${sw}"/>`);
  } else if (t === 'sound') {
    for (const s of [-1, 1]) back.push(`<circle cx="${cx + s * rx * 0.75}" cy="${top + 2}" r="6" fill="${dk}" stroke="${INK}" stroke-width="${sw}"/><circle cx="${cx + s * rx * 0.75}" cy="${top + 2}" r="3" fill="${lt}" stroke="${INK}" stroke-width="1"/>`);
  } else if (t === 'psychic') {
    for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2; back.push(`<circle cx="${(32 + Math.cos(a) * (rx + 7)).toFixed(1)}" cy="${(cy + Math.sin(a) * (ry + 6)).toFixed(1)}" r="2.2" fill="${lt}" stroke="${INK}" stroke-width="1"/>`); }
  }

  // ---- horns / ears for tier 3+
  if (tier >= 3 && !['electric', 'sound', 'fire'].includes(t)) {
    const hx = rx * 0.5;
    for (const s of [-1, 1]) back.push(`<path d="M${cx + s * hx - 3},${top + 6} Q${cx + s * (hx + 4)},${top - 6 - tier} ${cx + s * (hx + 7)},${top - 4 - tier} Q${cx + s * (hx + 4)},${top + 2} ${cx + s * hx + 4},${top + 7}Z" fill="${tier >= 4 ? '#f3e7c9' : dk}" stroke="${INK}" stroke-width="${sw}"/>`);
  }

  // ---- species features (independent of type) so mons of a type look like different animals
  const feats = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 1 + r.int(2));
  const busyTop = ['fire', 'electric', 'grass', 'ice', 'sound'].includes(t) || tier >= 3;
  for (const f of feats) {
    if (f === 1 && !busyTop) for (const s2 of [-1, 1]) back.push(`<path d="M${cx + s2 * rx * 0.25},${top + 4} L${cx + s2 * rx * 0.62},${top - 8} L${cx + s2 * rx * 0.85},${top + 6}Z" fill="${c}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/><path d="M${cx + s2 * rx * 0.42},${top + 3} L${cx + s2 * rx * 0.62},${top - 3} L${cx + s2 * rx * 0.72},${top + 4}Z" fill="#ff9ab0"/>`);
    if (f === 2 && !busyTop) for (const s2 of [-1, 1]) back.push(`<circle cx="${cx + s2 * rx * 0.7}" cy="${top + 3}" r="5" fill="${dk}" stroke="${INK}" stroke-width="${sw}"/>`);
    if (f === 3 && !busyTop) for (const s2 of [-1, 1]) back.push(`<ellipse cx="${cx + s2 * 5}" cy="${top - 7}" rx="3.4" ry="10" fill="${c}" stroke="${INK}" stroke-width="${sw}" transform="rotate(${s2 * 14} ${cx + s2 * 5} ${top + 2})"/>`);
    if (f === 4 && !busyTop) for (const s2 of [-1, 1]) back.push(`<path d="M${cx + s2 * 3},${top + 2} Q${cx + s2 * 6},${top - 8} ${cx + s2 * 10},${top - 10}" stroke="${INK}" stroke-width="1.6" fill="none"/><circle cx="${cx + s2 * 10}" cy="${top - 10}" r="2.2" fill="${accent}" stroke="${INK}" stroke-width="1"/>`);
    if (f === 5 && t !== 'fire' && t !== 'electric') back.push(`<path d="M${cx + rx - 3},${cy + ry * 0.4} Q${cx + rx + 10},${cy + ry * 0.5} ${cx + rx + 7},${cy - 4} Q${cx + rx + 3},${cy - 6} ${cx + rx + 3},${cy - 1}" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M${cx + rx - 3},${cy + ry * 0.4} Q${cx + rx + 10},${cy + ry * 0.5} ${cx + rx + 7},${cy - 4} Q${cx + rx + 3},${cy - 6} ${cx + rx + 3},${cy - 1}" stroke="${dk}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
    if (f === 6 && t !== 'water') for (const s2 of [-1, 1]) back.push(`<path d="M${cx + s2 * rx * 0.8},${cy - 2} Q${cx + s2 * (rx + 12)},${cy - 14} ${cx + s2 * (rx + 9)},${cy + 3} Q${cx + s2 * (rx + 5)},${cy} ${cx + s2 * rx * 0.8},${cy + 4}Z" fill="${accent}" stroke="${INK}" stroke-width="${sw}"/>`);
    if (f === 7) body.push('BEAK');
    if (f === 8) body.push('PATTERN');
  }

  // ---- feet
  if (!ghost && t !== 'water') for (const s of [-1, 1]) back.push(`<ellipse cx="${cx + s * rx * 0.45}" cy="${cy + ry - 1}" rx="5" ry="3.5" fill="${dk}" stroke="${INK}" stroke-width="${sw}"/>`);

  // ---- body
  let d;
  if (ghost) {
    const w = rx, bt = cy + ry;
    d = `M${cx - w},${cy} Q${cx - w},${top} ${cx},${top} Q${cx + w},${top} ${cx + w},${cy} L${cx + w},${bt} Q${cx + w * 0.66},${bt - 6} ${cx + w * 0.33},${bt} Q${cx},${bt - 6} ${cx - w * 0.33},${bt} Q${cx - w * 0.66},${bt - 6} ${cx - w},${bt}Z`;
  } else d = blob(cx, cy, rx, ry, t === 'rock' ? 0.22 : 0.12, t === 'rock' ? 7 : 10, r, true);
  const wantBeak = body.includes('BEAK'), wantPattern = body.includes('PATTERN');
  body.length = 0;
  body.push(`<path d="${d}" fill="${c}" stroke="${INK}" stroke-width="2" ${ghost ? 'opacity="0.9"' : ''}/>`);
  if (wantPattern) {
    const kind = r.int(2);
    if (kind === 0) for (let i = 0; i < 3; i++) body.push(`<path d="M${cx - rx * 0.9},${cy - ry * 0.55 + i * 5} Q${cx - rx * 0.6},${cy - ry * 0.45 + i * 5} ${cx - rx * 0.45},${cy - ry * 0.6 + i * 5}" stroke="${dk}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M${cx + rx * 0.9},${cy - ry * 0.55 + i * 5} Q${cx + rx * 0.6},${cy - ry * 0.45 + i * 5} ${cx + rx * 0.45},${cy - ry * 0.6 + i * 5}" stroke="${dk}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    else body.push(`<path d="M${cx - rx * 0.95},${cy + 2} Q${cx},${cy - ry * 0.25} ${cx + rx * 0.95},${cy + 2} L${cx + rx * 0.9},${cy + 6} Q${cx},${cy - ry * 0.1} ${cx - rx * 0.9},${cy + 6}Z" fill="${accent}" opacity="0.85"/>`);
  }
  body.push(`<ellipse cx="${cx}" cy="${cy + ry * 0.35}" rx="${rx * 0.55}" ry="${ry * 0.45}" fill="${lt}" opacity="0.75"/>`);

  // ---- markings
  if (t === 'poison') for (let i = 0; i < 3 + tier; i++) body.push(`<circle cx="${(cx + (r() - 0.5) * rx * 1.3).toFixed(1)}" cy="${(cy + (r() - 0.6) * ry * 1.2).toFixed(1)}" r="${(1.5 + r() * 2).toFixed(1)}" fill="${dk}" opacity="0.8"/>`);
  if (t === 'junk') body.push(`<rect x="${cx + rx * 0.2}" y="${cy + 2}" width="7" height="6" fill="#cfc9a8" stroke="${INK}" stroke-width="1" transform="rotate(12 ${cx + rx * 0.2} ${cy + 2})"/><circle cx="${cx - rx * 0.55}" cy="${cy + 5}" r="1.6" fill="${INK}"/>`);
  if (t === 'rock') body.push(`<path d="M${cx - rx * 0.6},${cy + 4} l5,2 l3,-3" stroke="${INK}" stroke-width="1.2" fill="none"/>`);
  if (t === 'ice') body.push(`<path d="M${cx + rx * 0.4},${cy - 2} l3,3 m0,-3 l-3,3" stroke="#ffffff" stroke-width="1.2"/>`);
  if (t === 'water') for (let i = 0; i < 2; i++) front.push(`<circle cx="${cx + rx + 3 + i * 3}" cy="${top + 4 - i * 6}" r="${2 - i * 0.6}" fill="none" stroke="${lt}" stroke-width="1.2"/>`);

  // ---- face
  const eyeY = cy - ry * 0.2, gap = Math.max(5, rx * 0.38);
  const style = r.int(4);
  for (const s of [-1, 1]) {
    const ex = cx + s * gap;
    if (ghost) front.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="3" ry="4.2" fill="${INK}"/>`);
    else if (style === 0) front.push(`<circle cx="${ex}" cy="${eyeY}" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.3"/><circle cx="${ex + s * 0.6}" cy="${eyeY + 0.5}" r="2" fill="${INK}"/><circle cx="${ex + s * 0.6 - 0.8}" cy="${eyeY - 0.4}" r="0.7" fill="#fff"/>`);
    else if (style === 1) front.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="2.2" ry="3" fill="${INK}"/><circle cx="${ex - 0.6}" cy="${eyeY - 1}" r="0.8" fill="#fff"/>`);
    else if (style === 2) front.push(`<circle cx="${ex}" cy="${eyeY}" r="3.4" fill="#fff" stroke="${INK}" stroke-width="1.3"/><circle cx="${ex}" cy="${eyeY + 0.6}" r="1.7" fill="${INK}"/><path d="M${ex - 4},${eyeY - 4 + (s > 0 ? 1.5 : 0)} L${ex + 4},${eyeY - 4 + (s < 0 ? 1.5 : 0)}" stroke="${INK}" stroke-width="1.6"/>`);
    else front.push(`<path d="M${ex - 3},${eyeY} Q${ex},${eyeY - 3} ${ex + 3},${eyeY}" stroke="${INK}" stroke-width="1.6" fill="none"/>`);
  }
  if (t === 'psychic') front.push(`<path d="M${cx},${eyeY - 9} l3,3 l-3,3 l-3,-3Z" fill="#ffe36b" stroke="${INK}" stroke-width="1"/>`);
  const my = eyeY + 6 + ry * 0.08, mstyle = r.int(4);
  if (wantBeak) front.push(`<path d="M${cx - 4},${my - 2} L${cx + 4},${my - 2} L${cx},${my + 4}Z" fill="#ffb02e" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`);
  else if (mstyle === 0) front.push(`<path d="M${cx - 3},${my} Q${cx},${my + 3} ${cx + 3},${my}" stroke="${INK}" stroke-width="1.5" fill="none"/>`);
  else if (mstyle === 1) front.push(`<path d="M${cx - 4},${my} Q${cx},${my + 5} ${cx + 4},${my}Z" fill="#7a2335" stroke="${INK}" stroke-width="1.2"/>`);
  else if (mstyle === 2) front.push(`<path d="M${cx - 4},${my} Q${cx},${my + 2.5} ${cx + 4},${my}" stroke="${INK}" stroke-width="1.5" fill="none"/><path d="M${cx + 1.5},${my + 1} l1,2.6 l1,-2.8" fill="#fff" stroke="${INK}" stroke-width="0.8"/>`);
  else front.push(`<ellipse cx="${cx}" cy="${my + 1}" rx="1.8" ry="1.4" fill="${INK}"/>`);
  if (tier >= 2 && !ghost) for (const s of [-1, 1]) front.push(`<ellipse cx="${cx + s * (gap + 4)}" cy="${eyeY + 4.5}" rx="2.4" ry="1.4" fill="#ff7a9a" opacity="0.6"/>`);

  // ---- crown on tier 5, lid hat on junk
  if (tier === 5) front.push(`<path d="M${cx - 7},${top + 1} L${cx - 7},${top - 7} L${cx - 3.5},${top - 3} L${cx},${top - 9} L${cx + 3.5},${top - 3} L${cx + 7},${top - 7} L${cx + 7},${top + 1}Z" fill="#ffd54a" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`);
  if (t === 'junk' && tier !== 5) front.push(`<ellipse cx="${cx - 3}" cy="${top + 1}" rx="9" ry="2.6" fill="#b9bcc4" stroke="${INK}" stroke-width="1.3"/>`);
  if (t === 'sound') front.push(`<text x="${cx + rx + 1}" y="${top + 2}" font-size="10" fill="${INK}">♪</text>`);

  const svg = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="mon-svg">${back.join('')}${body.join('')}${front.join('')}</svg>`;
  cache.set(id, svg);
  return svg;
}
