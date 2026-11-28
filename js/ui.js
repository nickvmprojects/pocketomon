// Pocketomon UI — v0.7.6 ("Rift" presentation from v0.7.5). Same rules and engine as v0.7; the old UI lives in /classic/.
// Mobile first. Taps only ever select; moving, buying and selling is drag-only (plus the Buy/Sell buttons).
import * as D from './data.js?v=0.7.7';
import * as R from './run.js?v=0.7.7';
import { simulate, previewTeam } from './battle.js?v=0.7.7';
import { monSvg } from './art.js?v=0.7.7';
import { LIBRARY } from './snapdata.js?v=0.7.7';
import { IC, SIGIL, COORD } from './icons.js?v=0.7.7';
import { sfx, unlock as unlockAudio, setMuted } from './sfx.js?v=0.7.7';
import { FxLayer } from './fx.js?v=0.7.7';

const { MON, TYPES, FX, RULES } = D;
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');
const KEY_RUN = 'pocketomon.run.v2', KEY_RUN_OLD = 'pocketomon.run.v1', KEY_PROF = 'pocketomon.profile.v1';
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
// v0.7.6: the run is saved under its own key (classic v0.7 keeps the old one, since its rules differ now)
let run = load(KEY_RUN) || load(KEY_RUN_OLD);
if (run && run.v !== 3) run = null; // older saves use beings from before the v0.7 multiverse
if (run) R.migrateRun(run);
let prof = Object.assign({ rp: 0, runs: 0, champs: 0, bestWins: 0, speed: 2, seen: '', mute: false, caught: [], spotted: [], bestKO: null }, load(KEY_PROF) || {});
if (prof.rank === undefined) prof.rank = Math.min(D.RANKS.length - 1, Math.floor((prof.rp || 0) / 100)); // migrate v0.1 RP
prof.peakRank = Math.max(prof.peakRank || 0, prof.rank);
setMuted(prof.mute);
let ui = { screen: run && run.phase !== 'over' ? 'run' : 'title', sel: null, pending: null, battle: null, dexType: 'fallen' };

const saveRun = () => store(KEY_RUN, run);
const saveProf = () => store(KEY_PROF, prof);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const SPLASHES = ['Now with blackjack. And hookers.', 'Gotta merge \'em all!', 'Ties go to you. Always.', '100% organic, free-range beings', 'Sudden death is just a suggestion', 'Recycle your trash beings!', 'Ten dimensions. Zero refunds.', 'Side effects include rifts.'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

let toastT = 0;
function toast(msg) {
  if (!msg) return;
  $toast.textContent = msg; $toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => $toast.classList.remove('show'), 1800);
}

// ---------------------------------------------------------------- discovery (Multidex: spotted / caught)
const caught = new Set(prof.caught), spotted = new Set(prof.spotted);
let discQ = [], discBusy = false;
function spot(ids) { let n = 0; for (const id of ids) if (id && MON[id] && !spotted.has(id)) { spotted.add(id); n++; } if (n) { prof.spotted = [...spotted]; saveProf(); } }
function discover(silent) {
  if (!run || !run.team) return;
  const ids = [...run.team, ...run.bench].filter(Boolean).map(m => m.id);
  spot(ids); if (run.shop) spot(run.shop.filter(o => o && o.mon).map(o => o.mon.id));
  const fresh = [...new Set(ids)].filter(id => !caught.has(id));
  if (!fresh.length) return;
  for (const id of fresh) caught.add(id);
  prof.caught = [...caught]; saveProf();
  run.disc = (run.disc || 0) + fresh.length; saveRun();
  if (!silent) { discQ.push(...fresh); nextDisc(); }
}
function nextDisc() {
  if (discBusy || !discQ.length) return;
  if (ui.battle || ui.screen !== 'run' || !run || run.phase === 'over') { discQ = []; return; } // only celebrate in the shop/event
  discBusy = true;
  const id = discQ.shift(), def = MON[id], T = TYPES[def.type];
  const more = discQ.length; discQ = []; // several at once: one stamp, "+N more
  const el = document.createElement('div');
  el.className = 'discover'; el.style.setProperty('--tc', T.color);
  el.innerHTML = `<div class="dc-art">${monSvg(id)}</div><div class="dc-txt"><div class="dc-k">${IC.spark} NEW DISCOVERY</div><div class="dc-n">${esc(def.name)}${more ? ` <small>+${more} more</small>` : ''}</div><div class="dc-s">${SIGIL[def.type]} ${esc(T.name)} · caught ${caught.size}/${D.MONS.length}</div></div>`;
  document.body.appendChild(el); sfx.discover();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); discBusy = false; nextDisc(); }, 260); }, 1500);
}
discover(true); // existing players: count what they already own without fanfare

// ---------------------------------------------------------------- shared bits
// buff highlight class by ratio effective / base (base = the being at that level with average rolls)
const buffCls = (r) => (r < 1.04 ? (r < 0.96 ? 'nerf' : '') : r < 1.25 ? 'b1' : r < 1.75 ? 'b2' : r < 2.5 ? 'b3' : 'b4');
function numHtml(base, eff, unit = '') {
  const r = base > 0 ? eff / base : 1, c = buffCls(r);
  if (!c || c === 'nerf') return `<b class="${c}">${fmt(eff)}${unit}</b>`;
  return `<span class="was">${fmt(base)}</span>→<b class="${c}">${fmt(eff)}${unit}</b>`;
}
// a being's text with live numbers ({key}) and tappable **keywords**
export const kwHtml = (t) => t.replace(/\*\*(.+?)\*\*/g, (_, w) => D.KEYWORDS[w] ? `<b class="kw" data-act="kw" data-k="${w}">${w}</b>` : `<b>${w}</b>`);
function descHtml(def, lvl = 1, atk = 1, pow = 1, plus = 0) {
  const t = esc(def.text).replace(/\{(\w+)\}/g, (_, k) => {
    if (k === 'dmg') return numHtml(D.fxValue('dmg', def.dmg, def, lvl, 1), D.fxValue('dmg', def.dmg, def, lvl, atk) + plus);
    const base = def.fx[k] ?? def.pas[k];
    if (base === undefined) return '?';
    const by = FX[k] && FX[k].scale === 'dmg' ? atk : pow;
    let b = D.fxValue(k, base, def, lvl, 1), e = D.fxValue(k, base, def, lvl, by);
    if (D.ECHO_KEYS.includes(k) || k === 'copyLast') { b = Math.min(125, b); e = Math.min(125, e); }
    return numHtml(b, e);
  });
  return kwHtml(t);
}
function tagLine(def) {
  const bits = [`<span class="rolechip r-${def.role}">${D.ROLES[def.role]}</span>`];
  for (const t of def.x.tags || []) bits.push(`<span class="tagchip">${D.TAGS[t]}</span>`);
  if (def.x.el) bits.push(`<span class="tagchip">${D.ELEMENTS[def.x.el]}</span>`);
  return bits.join(' ');
}
// effective (battle-start) multipliers for a being at a location; team slots include auras, charms, slot trinkets
function effOf(m, zone, i) {
  const pv = zone === 'team' && ui.prev && ui.prev[i];
  return pv ? { atk: pv.atk, pow: pv.pow, spd: pv.spd, src: pv.src, plus: m.plus || 0 } : { atk: m.atk || 1, pow: m.pow || 1, spd: 1, src: [], plus: m.plus || 0 };
}
// the two numbers under a card's art: hit + main effect, glowing more the more they are buffed
function statBadges(m, eff) {
  const def = MON[m.id], lvl = m.lvl || 1;
  const hb = D.fxValue('dmg', def.dmg, def, lvl, 1), he = D.fxValue('dmg', def.dmg, def, lvl, eff.atk) + eff.plus;
  let out = `<span class="sb hit ${buffCls(he / hb)}">${fmt(he)}</span>`;
  const BADGE = ['burn', 'poison', 'doom', 'heal', 'shield', 'cleanse', 'scrap', 'pressure', 'ki', 'growth', 'haste', 'chill', 'expose', 'weaken', 'selfgrow', 'healPct', 'freeze', 'freezeTop', 'freezeAll', 'charge', 'echo', 'copyLast', 'confuse'];
  const key = Object.keys(def.fx).find(k => BADGE.includes(k));
  if (key) {
    const xe = D.fxValue(key, def.fx[key], def, lvl, eff.pow), xb = D.fxValue(key, def.fx[key], def, lvl, 1);
    out += `<span class="sb fxb ${buffCls(xe / xb)}">${FX[key].icon}${fmt(xe)}${FX[key].unit === '%' ? '%' : ''}</span>`;
  }
  return `<div class="sbadges">${out}</div>`;
}
const stars = (l) => (l <= 3 ? '★'.repeat(l) : `★${l}`);
const dimStyle = (type) => `--tc:${TYPES[type].color};--td:${TYPES[type].dark}`;
const silo = (id) => !caught.has(id);

function card(m, o = {}) {
  if (!m) return `<div class="card empty ${o.sel ? 'sel' : ''} ${o.target ? 'target' : ''} ${o.aura ? 'aurahit' : ''}" data-z="${o.zone}" data-i="${o.i}">${o.label ? `<span class="slotno">${o.label}</span>` : ''}</div>`;
  const def = MON[m.id];
  const shop = o.price !== undefined;
  const tagIc = (def.x.tags || []).map(t => D.TAGS[t].split(' ')[0]).join('') + (def.x.el ? D.ELEMENTS[def.x.el].split(' ')[0] : '');
  const marks = (D.TRIGGERS[m.id] ? `<i class="mk trig">${IC.bell}</i>` : '') + (D.AURAS[m.id] ? `<i class="mk aura">${IC.aura}</i>` : '') + (tagIc ? `<i class="mk tag">${tagIc}</i>` : '');
  const eff = o.zone === 'dex' ? { atk: 1, pow: 1, plus: 0 } : effOf(m, o.zone, o.i);
  const unknown = o.zone === 'dex' && silo(m.id);
  const lvTag = m.lvl && !shop && o.zone !== 'dex' ? `<span class="lvtag l${m.lvl}">${stars(m.lvl)}</span>` : '';
  return `<div class="card t-${def.type} ${o.sel ? 'sel' : ''} ${o.target ? 'target' : ''} ${o.small ? 'small' : ''} ${o.aura ? 'aurahit' : ''} ${unknown ? 'unknown' : ''} ${m.lvl >= 2 && !shop ? 'lv' + m.lvl : ''}" data-z="${o.zone}" data-i="${o.i}" style="${dimStyle(def.type)}">
    <div class="art">${monSvg(m.id)}</div>
    <div class="c-top"><span class="tierpill t${def.tier}">T${def.tier}</span>${lvTag}<span class="sig">${SIGIL[def.type]}</span></div>
    ${marks && o.zone !== 'dex' ? `<div class="marks">${marks}</div>` : ''}${o.locked ? `<div class="lock">${IC.lock}</div>` : ''}
    ${o.own ? `<div class="own ${o.own.startsWith('MERGE') ? 'merge' : ''}">${o.own}</div>` : ''}
    ${o.small || o.zone === 'dex' ? '' : statBadges(m, eff)}
    <div class="nm"><span class="nmt">${unknown && !spotted.has(m.id) ? '???' : def.name}</span>${shop ? `<span class="price ${run && run.gold < o.price ? 'no' : ''}">${o.price}</span>` : ''}</div></div>`;
}
// where a being's stats come from (rolls/growth, flat damage, auras, trinkets)
function srcLines(m, eff) {
  const parts = [`<span>🎲 Rolls & growth: ATK ${Math.round((m.atk || 1) * 100)}% · POW ${Math.round((m.pow || 1) * 100)}%</span>`];
  if (eff.plus) parts.push(`<span class="b1">💪 +${fmt(eff.plus)} hit damage earned</span>`);
  for (const x of eff.src || []) {
    const bits = [];
    if (x.atk) bits.push(`+${Math.round(x.atk)}% ATK`);
    if (x.pow) bits.push(`+${Math.round(x.pow)}% POW`);
    if (x.spd) bits.push(`+${Math.round(x.spd)}% speed`);
    if (bits.length) parts.push(`<span class="b1">${x.label.endsWith('aura') ? '✨' : '🎒'} ${esc(x.label)}: ${bits.join(', ')}</span>`);
  }
  return `<div class="srcs">${parts.join('')}</div>`;
}
function detail(m, ctx) {
  const def = MON[m.id], T = TYPES[def.type];
  const lvl = m.lvl || 1;
  const eff = ctx.eff || (ctx.zone === 'dex' ? { atk: 1, pow: 1, spd: 1, src: [], plus: 0 } : effOf(m, ctx.zone, ctx.i));
  let btns = '', note = '';
  if (ctx.zone === 'shop') {
    const price = R.offerPrice(run, def);
    const copies = R.owned(run).filter(o => o.m.id === m.id && o.m.lvl === 1).length;
    if (copies >= 2) note = `<div class="note good">You own 2 copies: buying this merges them into level 2!</div>`;
    else if (copies === 1) note = `<div class="note">You own 1 copy. Get 3 to merge into level 2.</div>`;
    btns = `<button class="primary" data-act="buy" ${run.gold < price ? 'disabled' : ''}>Buy · <span class="g">${IC.coin}${price}</span></button>
      <button data-act="lock">${ctx.locked ? IC.unlock + ' Unlock' : IC.lock + ' Lock for next day'}</button>`;
  } else if ((ctx.zone === 'team' || ctx.zone === 'bench') && !ctx.info) {
    btns = `<button data-act="sell">${IC.trash} Sell · <span class="g">+${R.sellValue(run, m)}</span></button>`;
    note = `<div class="note dim">${lvl === 1 ? 'Merge 3 copies → level 2.' : lvl === 2 ? 'Merge with another level 2 → level 3.' : `Merge with another level ${lvl} copy → level ${lvl + 1} (and a legendary trinket pick).`}</div>`;
  }
  const unknown = ctx.zone === 'dex' && silo(m.id);
  return `<div class="detail ${ctx.sheet ? 'sheet' : ''} ${ctx.zone === 'shop' ? 'top' : ''} ${unknown ? 'unknown' : ''}" style="${dimStyle(def.type)}">
    ${ctx.sheet ? `<button class="sheetx icon" data-act="deselect">${IC.close}</button>` : ''}
    <div class="d-head"><div class="d-art">${monSvg(m.id)}</div>
      <div class="d-id"><div class="d-coord">${SIGIL[def.type]} ${COORD[def.type]} · ${esc(T.name)}</div>
      <div class="d-name">${def.name} ${ctx.zone === 'dex' ? '' : `<span class="lvtxt">${stars(lvl)}</span>`}</div>
      <div class="d-meta"><span class="tierpill t${def.tier}">Tier ${def.tier}</span> <span class="num">⏱ ${def.cd}s</span> ${tagLine(def)}</div>
      ${ctx.zone !== 'dex' ? `<div class="d-meta"><span>ATK <b class="${buffCls(eff.atk)}">${Math.round(eff.atk * 100)}%</b></span> <span>POW <b class="${buffCls(eff.pow)}">${Math.round(eff.pow * 100)}%</b></span>${eff.spd > 1.001 ? ` <span>Speed <b class="${buffCls(eff.spd)}">+${Math.round((eff.spd - 1) * 100)}%</b></span>` : ''}</div>` : ''}</div></div>
    ${unknown ? `<div class="note">Not caught yet: own one in a run to add it to your Multidex.</div>` : ''}
    <div class="desc">${descHtml(def, lvl, eff.atk, eff.pow, eff.plus)}</div>
    ${ctx.zone !== 'dex' ? srcLines(m, eff) : ''}
    ${D.TRIGGERS[m.id] ? `<div class="trigline"><i>${IC.bell}</i> ${esc(D.triggerText(def, lvl, eff.pow))}</div>` : ''}
    ${D.AURAS[m.id] ? `<div class="trigline aura"><i>${IC.aura}</i> ${esc(D.auraText(def, lvl))}</div>` : ''}
    <div class="flavor">${esc(def.flavor)}</div>${note}
    ${btns ? `<div class="btns">${btns}</div>` : ''}</div>`;
}

function trinketIcons(list) {
  const counts = {}; for (const t of list) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).map(([t, n]) => `<span class="trk ${D.TRINKET[t].tier === 0 ? 'junk' : ''}" data-act="trinket" data-id="${t}">${D.TRINKET[t].icon}${n > 1 ? `<sub>×${n}</sub>` : ''}</span>`).join('');
}
function trinketCard(o, sel) {
  if (!o || !o.id) return `<div class="card sold tcard">SOLD<small>trinkets: 1 a day</small></div>`;
  const t = D.TRINKET[o.id], price = D.trinketPrice(t);
  return `<div class="card tcard ${sel ? 'sel' : ''}" data-z="tshop" data-i="0">
    <div class="c-top"><span class="tierpill t${t.tier}">T${t.tier}</span></div>
    ${o.locked ? `<div class="lock">${IC.lock}</div>` : ''}<div class="ticon">${t.icon}</div><div class="tlabel">TRINKET</div><div class="nm"><span class="nmt">${esc(t.name)}</span><span class="price ${run.gold < price ? 'no' : ''}">${price}</span></div></div>`;
}
function trinketSheet(o) {
  const t = D.TRINKET[o.id], price = D.trinketPrice(t);
  return `<div class="detail sheet top" style="--tc:#ffcc3d"><button class="sheetx icon" data-act="deselect">${IC.close}</button>
    <div class="d-head"><div class="d-art ticonbig">${t.icon}</div><div class="d-id"><div class="d-coord">TRINKET</div><div class="d-name">${esc(t.name)}</div>
    <div class="d-meta"><span class="tierpill t${t.tier}">Tier ${t.tier} trinket</span></div></div></div>
    <div class="trigline">${esc(t.desc)}</div>
    <div class="note dim">Trinkets last the whole run. You can buy ${R.trinketBuysLeft(run) > 1 ? R.trinketBuysLeft(run) + ' more' : 'one'} today; rerolls don't restock this slot.</div>
    <div class="btns"><button class="primary" data-act="buytrinket" ${run.gold < price || R.trinketBuysLeft(run) <= 0 ? 'disabled' : ''}>Buy · <span class="g">${IC.coin}${price}</span></button>
    <button data-act="locktrinket">${o.locked ? IC.unlock + ' Unlock' : IC.lock + ' Lock for next day'}</button></div></div>`;
}
// wins as a row of diamonds, lives as hearts: the whole run at a glance
function winPips(w) { let h = ''; for (let i = 0; i < RULES.winsToChampion; i++) h += `<i class="${i < w ? 'on' : ''}"></i>`; return `<span class="pips" title="Wins">${h}</span>`; }
function lifeHearts(l) { let h = ''; for (let i = 0; i < RULES.startLives; i++) h += i < l ? `<i class="on">${IC.heart}</i>` : `<i>${IC.heartO}</i>`; return `<span class="hearts" title="Lives">${h}</span>`; }
function topbar() {
  const rk = D.RANKS[prof.rank];
  const ids = [...new Set(run.trinkets)];
  const MAXT = 6;
  return `<header class="topbar">
    <div class="tb-day"><small>DAY</small><b>${run.day}</b>${run.mode === 'ranked' ? `<span class="mode" style="color:${rk.color}">${rk.icon}</span>` : ''}</div>
    <div class="tb-track"><div class="tb-w">${winPips(run.wins)}<span class="num">${run.wins}/${RULES.winsToChampion}</span></div>${lifeHearts(run.lives)}</div>
    <div class="tb-gold" title="Gold">${IC.coin}<b>${run.gold}</b></div>
    <button class="icon" data-act="menu" aria-label="Menu">${IC.menu}</button></header>
    <div class="infobar"><span class="ib-pw" title="Power (for fun)">${IC.bolt}${R.runPower(run)}</span><span class="ib-hp" title="Team HP">${IC.hp}${R.maxHpFor(run.day, run.hpBonus, run.avatar, run.trinkets)}</span>
      <span class="trks">${trinketIcons(run.trinkets.filter(t => ids.indexOf(t) < MAXT))}${ids.length > MAXT ? `<span class="trk more" data-act="menu">+${ids.length - MAXT}</span>` : ''}</span></div>`;
}
// dimension tally of the team: just counts, never says what a set does (synergies stay hidden)
function dimTally() {
  const n = {}; for (const m of run.team) if (m) n[MON[m.id].type] = (n[MON[m.id].type] || 0) + 1;
  const ks = Object.keys(n).sort((a, b) => n[b] - n[a]);
  return ks.map(k => `<span class="tally ${n[k] >= 3 ? 'hot' : ''}" style="--tc:${TYPES[k].color}">${SIGIL[k]}${n[k]}</span>`).join('');
}

function teamRows(opts = {}) {
  const tgt = opts.target;
  const isSel = (z, i) => ui.sel && ui.sel.zone === z && ui.sel.i === i;
  const tOk = (m) => tgt && R.validTarget(run, tgt, m);
  // selecting an aura being on the team outlines the slots it buffs
  const sm = ui.sel && ui.sel.zone === 'team' && run.team[ui.sel.i];
  const au = sm && D.AURAS[sm.id];
  const hit = (i) => au && D.inZone(au.who, ui.sel.i, i);
  return `<div class="zlabel zteam"><b>Team</b><span>front row casts first</span><span class="tallies">${dimTally()}</span></div>
    <div class="zone team">${run.team.map((m, i) => card(m, { zone: 'team', i, sel: isSel('team', i), label: i < 3 ? `Front ${i + 1}` : `Back ${i + 1}`, target: tOk(m), aura: hit(i) })).join('')}</div>
    <div class="zlabel zbench"><b>Bench</b><span>doesn't fight</span></div>
    <div class="zone bench" style="--n:${run.bench.length}">${run.bench.map((m, i) => card(m, { zone: 'bench', i, sel: isSel('bench', i), target: tOk(m), small: true })).join('')}</div>`;
}

// ---------------------------------------------------------------- screens
function computePreview() {
  ui.prev = run && run.team ? previewTeam(R.battleTeamFromSnap({ day: run.day, hpBonus: run.hpBonus, avatar: run.avatar, trinkets: run.trinkets.filter(t => D.isBattleTrinket(t)), ntrink: run.trinkets.length, team: run.team })) : null;
}
function render() {
  computePreview();
  if (ui.battle) return; // battle owns the screen
  if (ui.screen === 'dex') return renderDex();
  if (ui.screen === 'title' || !run) return renderTitle();
  if (run.phase === 'over') return renderOver();
  discover();
  if (run.phase === 'event') { if (R.ensurePassable(run)) saveRun(); renderEvent(); return playCelebrations(); }
  renderShop(); playCelebrations();
}

// ---------------------------------------------------------------- celebrations: merge fanfare + trinket gifts
let celebrating = false;
function playCelebrations() {
  if (celebrating || !run || !run.celebrate || !run.celebrate.length) return;
  celebrating = true;
  const next = () => {
    const q = run.celebrate;
    if (!q.length) { celebrating = false; saveRun(); return; }
    let item = q.shift();
    // batch consecutive junk gifts into one
    if (item.k === 'gift' && D.TRINKET[item.id].tier === 0) {
      const ids = [item.id];
      while (q.length && q[0].k === 'gift' && D.TRINKET[q[0].id].tier === 0) ids.push(q.shift().id);
      item = { k: 'junk', ids };
    }
    showCelebration(item, next);
  };
  next();
}
function confetti(n) {
  const cols = ['#ffcc3d', '#ff4a5c', '#3cf2c0', '#8fd8ff', '#c77dff', '#efe9dc'];
  let h = '';
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 160;
    h += `<i class="conf" style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d - 40)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;background:${cols[i % cols.length]};animation-delay:${Math.round(Math.random() * 120)}ms"></i>`;
  }
  return h;
}
function showCelebration(item, done) {
  const el = document.createElement('div');
  el.className = 'celebrate';
  let dur = 1500;
  if (item.k === 'merge') {
    const def = MON[item.id];
    el.innerHTML = `<div class="cel-box merge l${Math.min(3, item.lvl)}" style="${dimStyle(def.type)}"><div class="burst"></div>${confetti(item.lvl >= 3 ? 44 : 28)}
      <div class="cel-art">${monSvg(item.id)}</div><div class="cel-title">LEVEL ${item.lvl}${item.lvl >= 3 ? '!!' : '!'}</div>
      <div class="cel-sub">${def.name} <span class="stars">${stars(item.lvl)}</span></div></div>`;
    dur = item.lvl >= 3 ? 2000 : 1500;
    sfx.merge(Math.min(3, item.lvl));
    if (navigator.vibrate) navigator.vibrate(item.lvl >= 3 ? [30, 40, 60] : 30);
  } else if (item.k === 'gift') {
    const t = D.TRINKET[item.id];
    el.innerHTML = `<div class="cel-box gift"><div class="giftbox">${IC.gift}</div>
      <div class="gift-open">${confetti(20)}<div class="cel-ticon">${t.icon}</div><div class="cel-title sm">${esc(t.name)}</div>
      <div class="cel-sub"><span class="tierpill t${t.tier}">Tier ${t.tier} trinket</span></div><div class="cel-desc">${esc(t.desc)}</div></div></div>`;
    dur = 2100; sfx.gift();
  } else {
    const counts = {}; for (const id of item.ids) counts[id] = (counts[id] || 0) + 1;
    el.innerHTML = `<div class="cel-box gift junkgift"><div class="giftbox small">${IC.gift}</div>
      <div class="gift-open"><div class="cel-ticon">${Object.keys(counts).map(id => D.TRINKET[id].icon + (counts[id] > 1 ? `<sub>×${counts[id]}</sub>` : '')).join(' ')}</div>
      <div class="cel-title sm">Junk ×${item.ids.length}</div><div class="cel-desc">No effect, but every one counts as a trinket!</div></div></div>`;
    dur = 1300; sfx.coin();
  }
  document.body.appendChild(el);
  let closed = false;
  const close = () => { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => { el.remove(); done(); }, 180); };
  el.addEventListener('click', close);
  setTimeout(close, dur);
}

// "DAY N" card between days: the run at a glance (tap to skip)
function dayIntro() {
  if (!run || run.phase === 'over' || REDUCED) return;
  const old = document.querySelector('.dayintro'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'dayintro';
  const hp = R.maxHpFor(run.day, run.hpBonus, run.avatar, run.trinkets);
  const left = RULES.winsToChampion - run.wins;
  el.innerHTML = `<div class="di-box"><div class="di-k">${run.mode === 'ranked' ? 'RANKED RUN' : 'RUN'} · ${left} WIN${left === 1 ? '' : 'S'} TO CHAMPION</div>
    <div class="di-day"><small>DAY</small>${run.day}</div>
    <div class="di-track">${winPips(run.wins)}</div><div class="di-lives">${lifeHearts(run.lives)}</div>
    <div class="di-s">Team HP ${hp} · enemies up to tier ${D.maxTier(run.day)}</div></div>`;
  document.body.appendChild(el); sfx.day();
  let closed = false;
  const close = () => { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', close);
  setTimeout(close, 1500);
}

// ---------------------------------------------------------------- title: a rift that cycles beings from every dimension
let splashI = Math.floor(Math.random() * SPLASHES.length), portalT = 0, portalI = 0;
const PORTAL = D.MONS.map(m => m.id).sort(() => Math.random() - 0.5);
function portalHtml(id) {
  const def = MON[id], T = TYPES[def.type];
  return { art: monSvg(id), label: `<span class="pl-c">${SIGIL[def.type]} ${COORD[def.type]} · ${esc(T.name)}</span><b>${esc(def.name)}</b>`, color: T.color };
}
function cyclePortal(step = 1) {
  const p = document.getElementById('portal'); if (!p) { clearInterval(portalT); portalT = 0; return; }
  portalI = (portalI + step + PORTAL.length) % PORTAL.length;
  const h = portalHtml(PORTAL[portalI]);
  p.classList.remove('glitch'); void p.offsetWidth; p.classList.add('glitch');
  setTimeout(() => {
    const a = document.getElementById('pArt'), l = document.getElementById('pLabel');
    if (a) a.innerHTML = h.art; if (l) l.innerHTML = h.label;
    document.getElementById('rift')?.style.setProperty('--pc', h.color);
  }, 140);
}
function renderTitle() {
  const ri = prof.rank, rk = D.RANKS[ri];
  const canContinue = run && run.phase !== 'over';
  const seenNew = prof.seen === D.VERSION;
  const h = portalHtml(PORTAL[portalI]);
  const orbit = D.TYPE_KEYS.map((k, i) => `<i style="--a:${i * 36}deg;color:${TYPES[k].color}">${SIGIL[k]}</i>`).join('');
  $app.innerHTML = `<div class="title">
    <div class="t-kick">A MULTIVERSE AUTO-BATTLER</div>
    <h1 class="logo">POCKET<span class="o"></span>MON</h1>
    <div class="splash" data-act="splash">${esc(SPLASHES[splashI % SPLASHES.length])}</div>
    <div class="rift-hero" id="rift" data-act="portal" style="--pc:${h.color}">
      <div class="orbit">${orbit}</div>
      <div class="portal" id="portal"><div class="p-art" id="pArt">${h.art}</div><div class="p-scan"></div></div>
    </div>
    <div class="p-label" id="pLabel">${h.label}</div>
    <div class="t-stats">
      <div class="ts" style="--rc:${rk.color}"><b>${rk.icon} ${rk.name}</b><small>rank</small></div>
      <div class="ts"><b>${caught.size}<i>/${D.MONS.length}</i></b><small>caught</small></div>
      <div class="ts"><b>${prof.bestKO ? prof.bestKO.toFixed(1) + 's' : '—'}</b><small>best KO</small></div>
      <div class="ts"><b>${prof.champs}</b><small>titles</small></div>
    </div>
    <div class="menu">
      ${canContinue ? `<button class="primary big" data-act="continue">${IC.play} Continue <small>day ${run.day} · ${run.mode}</small></button>` : ''}
      <div class="btnrow2">
        <button class="${canContinue ? '' : 'primary'} big" data-act="new" data-mode="normal">New run</button>
        <button class="big ranked" data-act="new" data-mode="ranked" style="--rc:${rk.color}">Ranked ${rk.icon}</button>
      </div>
      <div class="btnrow"><button data-act="help">${IC.book}<span>How to play</span></button><button data-act="dex">${IC.grid}<span>Multidex</span></button><button data-act="news">${IC.spark}<span>What's new</span>${seenNew ? '' : '<span class="dot"></span>'}</button></div>
    </div>
    <div class="t-foot"><button class="icon snd" data-act="mute" aria-label="Sound">${prof.mute ? IC.soundOff : IC.soundOn}</button>
      <a class="classic" href="classic/">${IC.classic} Play classic v0.7</a><span class="ver">v${D.VERSION}</span></div></div>`;
  clearInterval(portalT); portalT = setInterval(() => cyclePortal(1), 2400);
}

function renderEvent() {
  const ev = run.event;
  const pend = ui.pending !== null ? ev.choices[ui.pending] : null;
  const isSel = ui.sel;
  const selM = isSel && (isSel.zone === 'team' ? run.team : run.bench)[isSel.i];
  $app.innerHTML = `${topbar()}<main class="fit eventfit">
    <div class="evhead"><div class="kick">${ev.avatar ? 'BEFORE YOU CROSS' : `DAY ${run.day} · PICK ONE`}</div><h2>${esc(ev.title)}</h2>
    ${pend ? `<div class="note pick">Tap a glowing being for <b>${esc(pend.title)}</b> <button class="small" data-act="cancelpick">Cancel</button></div>` : ''}</div>
    <div class="choices tarot ${ev.avatar ? 'big' : ''}">${ev.choices.map((c, i) => {
      const blocked = R.choiceBlocked(run, c);
      const mon = c.id && MON[c.id] && c.kind === 'wild';
      return `<button class="choice ${ui.pending === i ? 'sel' : ''} ${mon ? 'hasmon' : ''}" data-act="choose" data-i="${i}" ${blocked ? 'disabled' : ''} ${mon ? `style="${dimStyle(MON[c.id].type)}"` : ''}>
        <div class="c-num">${ROMAN[i + 1]}</div>
        ${mon ? `<div class="c-mon">${monSvg(c.id)}</div>` : `<div class="c-ic">${c.icon}</div>`}
        <div class="c-t">${esc(c.title)}</div><div class="c-d">${esc(c.desc)}</div>
        ${blocked ? `<div class="c-x">${blocked}</div>` : ''}</button>`;
    }).join('')}</div>
    ${run.avatar ? `<div class="evteam">${teamRows({ target: pend && pend.needsTarget ? pend : null })}</div>`
      : `<div class="evintro"><div class="dims">${D.TYPE_KEYS.map(k => `<i style="color:${TYPES[k].color}">${SIGIL[k]}</i>`).join('')}</div>
         <p>All 10 dimensions are open. Recruit beings, merge copies, and send your team through the rift for one 30 second showdown a day.</p>
         <p class="dim">Your trainer's perk lasts the whole run. Win ${RULES.winsToChampion} before you lose ${RULES.startLives} lives.</p></div>`}
  </main>${selM && !pend ? detail(selM, { zone: isSel.zone, i: isSel.i, sheet: true, info: true }) : ''}`;
}

function renderShop() {
  const sel = ui.sel;
  let selM = null, ctx = null;
  if (sel) {
    if (sel.zone === 'tshop') { if (!(run.tshop && run.tshop.id)) ui.sel = null; }
    else if (sel.zone === 'shop') { const o = run.shop[sel.i]; if (o && o.mon) { selM = o.mon; ctx = { zone: 'shop', locked: o.locked, sheet: true }; } }
    else { selM = (sel.zone === 'team' ? run.team : run.bench)[sel.i]; if (selM) ctx = { zone: sel.zone, i: sel.i, sheet: true }; }
    if (!selM && ui.sel && ui.sel.zone !== 'tshop') ui.sel = null;
  }
  const tsel = ui.sel && ui.sel.zone === 'tshop';
  const rc = R.rerollCostNow(run);
  const freeR = run.freeRerolls + run.rerollBank;
  const tq = R.currentTrinketChoice(run);
  if (tq) saveRun();
  const tpanel = tq ? `<div class="popup"><div class="tpick"><div class="kick">MERGE REWARD</div><h2>Pick a tier ${tq.tier} trinket</h2><div class="sub">It lasts the whole run.${run.trinketQueue.length > 1 ? ` (${run.trinketQueue.length - 1} more after this)` : ''}</div>
    <div class="choices">${tq.options.map(id => { const t = D.TRINKET[id]; return `<button class="choice row" data-act="picktrinket" data-id="${id}">
      <div class="c-ic">${t.icon}</div><div class="c-t">${esc(t.name)} <span class="ttier t${t.tier}">T${t.tier}</span></div><div class="c-d">${esc(t.desc)}</div></button>`; }).join('')}</div></div></div>` : '';
  const ownTag = (id) => {
    const n = R.owned(run).filter(x => x.m.id === id && x.m.lvl === 1).length; return n ? (n >= 2 ? 'MERGE ▲' : `own ${n}`) : '';
  };
  const nOff = run.shop.length + 1;
  const cols = nOff > 6 ? 4 : 3;
  $app.innerHTML = `${topbar()}<main class="fit shopfit" data-act-bg="1">
    ${teamRows()}
    <div class="zlabel zshop"><b>Shop</b><span>tiers up to ${D.maxTier(run.day)}${run.sale ? ' · <b class="good">SALE −5</b>' : ''}</span></div>
    <div class="zone shop" style="--c:${cols};--r:${Math.ceil(nOff / cols)}">${run.shop.map((o, i) => o.mon ? card(o.mon, {
      zone: 'shop', i, price: R.offerPrice(run, MON[o.mon.id]), locked: o.locked, sel: sel && sel.zone === 'shop' && sel.i === i, own: ownTag(o.mon.id),
    }) : `<div class="card sold">SOLD</div>`).join('')}${trinketCard(run.tshop, sel && sel.zone === 'tshop')}</div>
  </main>${tpanel}
  ${selM ? detail(selM, ctx) : tsel ? trinketSheet(run.tshop) : ''}
  <footer class="actionbar" id="actionbar">
    <button class="reroll" data-act="reroll" ${run.gold < rc ? 'disabled' : ''}>${IC.dice}<span>${rc ? `Reroll <b class="g">${IC.coin}${rc}</b>` : `Free reroll <b>${freeR}</b>`}</span></button>
    <button class="primary fightbtn" data-act="battle" ${tq ? 'disabled' : ''}>${IC.fight}<span>Battle</span></button>
  </footer>`;
}

function renderOver() {
  const champ = run.result === 'champion';
  const wins = run.history.filter(h => h.won && h.t);
  const best = wins.length ? Math.min(...wins.map(h => h.t)) : null;
  $app.innerHTML = `<main class="scroll over">
    <div class="ov-head ${champ ? 'champ' : ''}"><div class="kick">${run.mode === 'ranked' ? 'RANKED' : 'NORMAL'} RUN · ENDED DAY ${run.day}</div>
      <div class="ov-t">${champ ? 'CHAMPION' : 'RUN OVER'}</div>${rankChangeLine()}</div>
    <div class="ov-stats"><div><b>${run.wins}</b><small>wins</small></div><div><b>${run.losses}</b><small>losses</small></div>
      <div><b>${best ? best.toFixed(1) + 's' : '—'}</b><small>fastest KO</small></div><div><b>${run.disc || 0}</b><small>new caught</small></div></div>
    <h3>Every battle</h3><div class="hist">${run.history.map(h => `<div class="h ${h.won ? 'w' : 'l'}"><small>D${h.day}</small><b>${h.won ? 'W' : 'L'}</b><span>${h.t ? h.t.toFixed(1) + 's' : ''}</span></div>`).join('')}</div>
    <h3>Final team</h3><div class="grid3 team">${run.team.map((m, i) => card(m, { zone: 'final', i })).join('')}</div>
    <div class="menu"><button class="primary big" data-act="new" data-mode="${run.mode}">Play again</button><button class="big" data-act="title">Title</button></div>
  </main>`;
}

function renderDex() {
  const t = ui.dexType;
  const list = D.MONS.filter(m => m.type === t);
  const s = ui.dexSel ? MON[ui.dexSel] : null;
  const T = TYPES[t];
  const got = list.filter(m => caught.has(m.id)).length;
  $app.innerHTML = `<header class="topbar"><div class="tb-day dex"><b>MULTIDEX</b></div><div class="dexcount"><b>${caught.size}</b> caught · ${spotted.size} seen · ${D.MONS.length}</div><button class="icon" data-act="title" aria-label="Close">${IC.close}</button></header>
  <main class="scroll dex" style="${dimStyle(t)}">
    <div class="dextabs">${D.TYPE_KEYS.map(k => `<button class="${k === t ? 'sel' : ''}" data-act="dextype" data-t="${k}" style="--tc:${TYPES[k].color}">${SIGIL[k]}</button>`).join('')}</div>
    <div class="dexhead"><div class="d-coord">${SIGIL[t]} ${COORD[t]} · ${got}/${list.length} caught</div><h2>${esc(T.name)}</h2>
      <div class="mech">${esc(T.mech)}</div><p>${kwHtml(esc(T.blurb).replace(/\b(Ki|Transform|Aligned|Scrap|Pressure|Sleep|Assimilate|Last Stand)\b/, '**$1**'))}</p></div>
    <div class="row5">${list.map(m => card({ id: m.id, lvl: 0 }, { zone: 'dex', i: m.id, sel: ui.dexSel === m.id })).join('')}</div>
    ${s ? detail({ id: s.id, lvl: 1, atk: 1, pow: 1 }, { zone: 'dex' }) : '<div class="hint">Tap a being. Silhouettes are beings you haven\'t caught yet: own one in a run to reveal it. Numbers are shown at level 1 with average rolls.</div>'}
  </main>`;
}

// ---------------------------------------------------------------- modals
function modal(html, ownButtons) { $modal.innerHTML = `<div class="m-box">${html}${ownButtons ? '' : '<div class="btns"><button class="primary" data-act="closemodal">OK</button></div>'}</div>`; $modal.classList.remove('hidden'); }
function closeModal() { $modal.classList.add('hidden'); $modal.innerHTML = ''; }

function helpHtml() {
  return `<div class="kick">FIELD MANUAL</div><h2>How to play</h2>
  <p>Each <b>day</b>: pick 1 of 3 <b>event</b> choices, shop for beings, then fight <b>one 30 second battle</b> against another trainer's snapshot from the same day. Win 10 battles to become Champion; lose 5 lives and the run ends.</p>
  <p><b>Battles</b> are automatic. Every being casts its move each time its cooldown fills, in slot order (slot 1 first). All beings hit the enemy team's <b>shared HP bar</b>. After 30s, <b>sudden death</b> drains both teams faster every second. Ties go to you.</p>
  <p><b>KO time</b>: every win is graded by how fast you emptied their HP: <b>S</b> under 6s, <b>A</b> under 10s, <b>B</b> under 15s, <b>C</b> under 30s, <b>D</b> in sudden death. Great teams win in seconds: chase your best KO.</p>
  <p><b>Shop</b>: up to 6 beings on your team, extras wait on the bench. Each shop copy has its own ATK and POW roll. Tiers 1-3 grow more slowly than tiers 4-5 from permanent growth effects. Buy <b>3 copies</b> of a being to merge it into <b>level 2</b>, and two level 2s into <b>level 3</b>. After that, <b>two copies at the same level merge into the next one</b> (two level 3s → level 4, two level 4s → level 5... no cap), each with a legendary trinket pick. Levels past 3 are meant to be rare: beings you own at level 3+ show up less often in the shop. Merging keeps the best ATK and POW of the copies. Tier never changes. Lock offers you want to keep for tomorrow; unspent gold carries over.</p>
  <p><b>The multiverse</b>: beings come from <b>10 dimensions</b>, each with its own style and tricks, and every dimension is in every run. Beings from the same dimension often work well together, and some combos cross dimensions. Nothing tells you which: experiment! The sigils next to "Team" count how many beings of each dimension you field.</p>
  <p><b>Tap</b> any card to see its details (tap another to switch, ✕ or empty space to close). Taps never move or buy anything.</p>
  <p><b>Drag</b> to act: drag a shop card onto an empty team or bench slot to buy it there (or onto a slot holding 2 copies to merge). Drag your beings onto other slots to swap them, or onto the bottom bar to sell. Releasing anywhere else cancels. The details panel also has Buy and Sell buttons.</p>
  <p><b>Trinkets</b>: you can buy <b>one trinket a day</b> from the shop (rerolls don't restock it). They bend the rules instead of adding flat stats, and they never make beings cast extra times: repeat casts come from combinations of beings. Each dimension has a <b>relic</b> that changes how its trick works. You can own several of the same trinket (effects stack), except Big Backpack and Treasure Map (2 max) and tier 6 legendaries (1 each). One is always for sale in the shop. Some beings make junk trinkets (no effect, but they count for "when you gain a trinket" triggers) or find real ones.</p>
  <p><b>Team grid</b>: slots 1-3 are the front row and cast first; 4-6 are the back row. In battle the front rows face each other across the rift. "Behind" means the slot directly behind; "adjacent" means left, right, front or behind (no diagonals).</p>
  <p><b>Triggers</b> (bell icon): some beings react to things (being bought or sold, levelling up, trinkets, rerolls, wins, allies casting, low HP, sudden death...). In battle a gold link shows which ally set a trigger off. A being is never triggered by a copy of itself, and fires at most once per chain. <b>Auras</b> (sun icon) constantly buff nearby (or far) allies.</p>
  <p><b>Chains</b>: when many casts and triggers fire close together, the CHAIN counter climbs (and so does the music).</p>
  <p><b>Power</b> (bolt) is just the sum of your beings' numbers, for fun. It isn't how strong your team really is: Ranked uses a hidden rating.</p>
  <p><b>Buffs</b>: numbers on cards and in the details are what the being will have when the battle starts (auras, charms, slot trinkets and growth included). The more a number is buffed, the brighter it glows.</p>
  <p><b>In battle</b>: tap any being to see its live stats; the small number on each being is the damage it has dealt so far. Pause, 2× and Skip are at the bottom. After the fight, "Hide" lets you inspect the board.</p>
  <p><b>Multidex</b>: every being you own is <b>caught</b> for good; beings you meet in shops or battles are <b>seen</b>. Uncaught beings show as silhouettes.</p>
  <p><b>Merge rewards</b>: every merge lets you pick 1 of 3 <b>trinkets</b> of the merged being's tier. Reaching level 3 gives a single pick one tier higher, up to legendary tier 6. Every merge past level 3 gives a tier 6 pick. Trinkets last the whole run.</p>
  <p><b>Prices</b>: a being costs about 10 × its tier, ±5 depending on how strong it is. Selling refunds half per copy.</p>
  <p><b>Ranked</b>: opponents are picked to match your team's hidden strength (a bit above it at higher ranks). Your rank moves when the run ends: <b>6+ wins → rank up</b>, <b>5 wins → rank holds</b>, <b>under 5 → rank down</b>. Ranks: ${D.RANKS.map(r => r.icon + ' ' + r.name).join(' → ')}.</p>
  <p><b>After a battle</b>, the result shows how much damage and support (heals, shields, buffs) each being gave on both teams, with an MVP each.</p>
  <h3>Dimensions</h3>${D.TYPE_KEYS.map(k => `<p><b style="color:${TYPES[k].color}">${SIGIL[k]} ${TYPES[k].name} (${TYPES[k].mech})</b>: ${esc(TYPES[k].blurb)}</p>`).join('')}
  <h3>Keywords</h3><p class="dim">Tap a bold word in any details panel for its meaning.</p>${['Burn', 'Poison', 'Shield', 'Chill', 'Haste', 'Growth', 'Expose', 'Weaken', 'Doom', 'Ki', 'Aligned', 'Scrap', 'Pressure', 'Sleep', 'Assimilate', 'Last Stand', 'Overclock'].map(k => `<p><b class="kw" data-act="kw" data-k="${k}">${k}</b>: ${esc(D.KEYWORDS[k])}</p>`).join('')}
  <p class="dim">Healing above max HP turns into shield at half value. Shield caps at 50% of max HP.</p>
  <p class="dim">Prefer the old look? <a href="classic/">Classic v0.7</a> is still there (with the v0.7 rules and its own saved run).</p>`;
}
function newsHtml() {
  return `<div class="kick">CHANGELOG</div><h2>What's new</h2>${D.CHANGELOG.map(c => `<h3>v${c.v} · ${c.date}</h3><ul>${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`).join('')}`;
}
function menuHtml() {
  return `<div class="kick">DAY ${run.day} · ${run.mode.toUpperCase()}</div><h2>Menu</h2><div class="menu">
    <button data-act="help">${IC.book} How to play</button><button data-act="dex">${IC.grid} Multidex</button>
    <button data-act="mute">${prof.mute ? IC.soundOff + ' Sound is off' : IC.soundOn + ' Sound is on'}</button>
    <button data-act="title">${IC.back} Back to title (run is saved)</button>
    <button class="danger" data-act="abandon">Abandon run</button></div>
    <h3>Trinkets</h3>${run.trinkets.length ? [...new Set(run.trinkets)].map(t => { const n = run.trinkets.filter(x => x === t).length; return `<p>${D.TRINKET[t].icon} <b>${D.TRINKET[t].name}</b>${n > 1 ? ` ×${n}` : ''} <span class="ttier t${D.TRINKET[t].tier}">T${D.TRINKET[t].tier}</span>: ${D.TRINKET[t].desc}</p>`; }).join('') : '<p class="dim">None yet.</p>'}
    ${run.avatar ? `<h3>Trainer</h3><p>${D.AVATAR[run.avatar].face} <b>${D.AVATAR[run.avatar].name}</b>: ${D.AVATAR[run.avatar].perk}</p>` : ''}`;
}

// ---------------------------------------------------------------- actions
function startRun(mode) {
  run = R.newRun(mode);
  run.disc = 0;
  ui = { ...ui, screen: 'run', sel: null, pending: null };
  saveRun(); closeModal(); render(); dayIntro();
}

function tapSlot(zone, i) {
  if (zone === 'dex') { ui.dexSel = ui.dexSel === i ? null : i; sfx.select(); return render(); }
  if (zone === 'final') return;
  // event targeting
  if (run.phase === 'event' && ui.pending !== null) {
    const m = (zone === 'team' ? run.team : run.bench)[i];
    if (!m) return;
    if (!R.validTarget(run, run.event.choices[ui.pending], m)) return toast('That being can\'t be picked for this');
    const res = R.chooseEvent(run, ui.pending, { zone, i });
    if (!res.ok) return toast(res.msg);
    ui.pending = null; saveRun(); toast(res.msg); sfx.buy(); return render();
  }
  // taps only ever select (or deselect); moving, swapping and buying into a slot is drag-only
  if (zone === 'tshop') { ui.sel = ui.sel && ui.sel.zone === 'tshop' ? null : { zone: 'tshop', i: 0 }; sfx.select(); return render(); }
  const slotM = zone === 'shop' ? (run.shop[i] && run.shop[i].mon) : (zone === 'team' ? run.team : run.bench)[i];
  if (ui.sel && ui.sel.zone === zone && ui.sel.i === i) ui.sel = null;
  else ui.sel = slotM ? { zone, i } : null;
  if (ui.sel) sfx.select();
  render();
}

const actions = {
  continue() { ui.screen = 'run'; render(); },
  splash() { splashI++; const el = document.querySelector('.splash'); if (el) el.textContent = SPLASHES[splashI % SPLASHES.length]; sfx.tap(); },
  portal() { cyclePortal(1); clearInterval(portalT); portalT = setInterval(() => cyclePortal(1), 2400); sfx.cast(MON[PORTAL[(portalI) % PORTAL.length]].type); },
  mute() { prof.mute = !prof.mute; saveProf(); setMuted(prof.mute); if (!prof.mute) { unlockAudio(); sfx.coin(); } if (!$modal.classList.contains('hidden') && run && ui.screen === 'run') modal(menuHtml()); else render(); },
  deselect() { ui.sel = null; render(); },
  buytrinket() { const res = R.buyTrinket(run); toast(res.msg); if (res.ok) { ui.sel = null; saveRun(); sfx.buy(); } render(); },
  locktrinket() { R.toggleTrinketLock(run); saveRun(); sfx.tap(); render(); },
  picktrinket(el) { const res = R.chooseTrinket(run, el.dataset.id); toast(res.msg); saveRun(); sfx.gift(); render(); },
  new(el) {
    const mode = el.dataset.mode;
    if (run && run.phase !== 'over') {
      modal(`<h2>Start over?</h2><p>Your current ${run.mode} run (day ${run.day}, ${run.wins} wins) will end${run.mode === 'ranked' ? ' and count for your rank' : ''}.</p><button class="danger" data-act="confirmnew" data-mode="${mode}">Yes, start a new ${mode} run</button>`);
      return;
    }
    startRun(mode);
  },
  confirmnew(el) { if (run && run.phase !== 'over') { run.phase = 'over'; run.result = 'out'; finishRunStats(); } startRun(el.dataset.mode); },
  title() { closeModal(); ui.screen = 'title'; ui.sel = null; render(); },
  dex() { closeModal(); ui.screen = 'dex'; if (run && run.team) { const own = [...run.team, ...run.bench].find(Boolean); if (own && !ui.dexSel) ui.dexType = MON[own.id].type; } render(); },
  dextype(el) { ui.dexType = el.dataset.t; ui.dexSel = null; sfx.tap(); render(); },
  help() { modal(helpHtml()); },
  news() { prof.seen = D.VERSION; saveProf(); modal(newsHtml()); },
  menu() { modal(menuHtml()); },
  closemodal() { closeModal(); if (ui.screen === 'title') render(); },
  trinket(el) { const t = D.TRINKET[el.dataset.id]; toast(`${t.icon} ${t.name} (T${t.tier}): ${t.desc}`); },
  abandon() { modal(`<h2>Abandon run?</h2><p>This ends the run now.${run.mode === 'ranked' ? ` Ranked: your ${run.wins} wins count for your rank.` : ''}</p><button class="danger" data-act="confirmabandon">Abandon</button>`); },
  confirmabandon() { run.phase = 'over'; run.result = 'out'; finishRunStats(); saveRun(); closeModal(); render(); },
  choose(el) {
    const i = Number(el.dataset.i), c = run.event.choices[i];
    if (c.needsTarget) { ui.pending = ui.pending === i ? null : i; sfx.select(); return render(); }
    const res = R.chooseEvent(run, i);
    if (!res.ok) return toast(res.msg);
    ui.pending = null; saveRun(); toast(res.msg); if (c.kind === 'gold') sfx.coin(); else sfx.buy(); render();
  },
  cancelpick() { ui.pending = null; render(); },
  buy() { const res = R.buy(run, ui.sel.i); toast(res.msg); if (res.ok) { ui.sel = res.at || null; saveRun(); sfx.buy(); } render(); },
  lock() { R.toggleLock(run, ui.sel.i); saveRun(); sfx.tap(); render(); },
  sell() { const res = R.sell(run, ui.sel.zone, ui.sel.i); toast(res.msg); ui.sel = null; saveRun(); sfx.sell(); render(); },
  reroll() { const res = R.reroll(run); if (!res.ok) return toast(res.msg); if (ui.sel && ui.sel.zone === 'shop') ui.sel = null; saveRun(); sfx.reroll(); render(); rerollFlash(); },
  battle() {
    if (!run.team.some(Boolean)) return toast('Put at least one being on your team!');
    if (R.currentTrinketChoice(run)) return toast('Pick your merge trinket first!');
    const empty = run.team.filter(x => !x).length, benched = run.bench.filter(Boolean).length;
    const warn = [];
    if (empty && benched) warn.push(`${empty} empty team slot${empty > 1 ? 's' : ''} while ${benched} being${benched > 1 ? 's sit' : ' sits'} on the bench`);
    else if (empty) warn.push(`${empty} empty team slot${empty > 1 ? 's' : ''}`);
    if (run.gold >= 10) warn.push(`${run.gold} gold unspent (it carries over)`);
    modal(`<div class="kick">DAY ${run.day}</div><h2>Ready to battle?</h2><p class="pw">${IC.bolt} Power ${R.runPower(run)}</p>
      ${warn.length ? `<ul>${warn.map(w => `<li>${w}</li>`).join('')}</ul>` : '<p class="dim">Team looks complete.</p>'}
      <div class="btns"><button data-act="closemodal">Not yet</button><button class="primary" data-act="gobattle">${IC.fight} Fight!</button></div>`, true);
  },
  gobattle() { closeModal(); startBattle(); },
  speed2() { prof.speed = prof.speed === 2 ? 1 : 2; saveProf(); if (ui.battle) { ui.battle.speed = prof.speed; markSpeed(); } },
  pause() { const b = ui.battle; if (!b || b.done) return; b.paused = !b.paused; const el = $('pausebtn'); if (el) { el.innerHTML = b.paused ? IC.play : IC.pause; el.classList.toggle('on', b.paused); } },
  kw(el) { kwPop(el); },
  rtab(el) { if (ui.battle) { ui.battle.rtab = Number(el.dataset.t); $('rep').outerHTML = reportHtml(); } },
  hideresult() { $('ko')?.classList.remove('show'); $('bresult').classList.add('hidden'); $('bshow').classList.remove('hidden'); dmgBadges(true); },
  showresult() { if (ui.battle) { ui.battle.insp = null; renderInsp(); } dmgBadges(false); $('bshow').classList.add('hidden'); $('bresult').classList.remove('hidden'); },
  bclose() { if (ui.battle) { ui.battle.insp = null; renderInsp(); } },
  skip() { if (ui.battle) skipBattle(); },
  afterbattle() { const over = run.phase === 'over'; ui.battle = null; ui.sel = null; render(); if (!over) dayIntro(); },
};
function rerollFlash() { document.querySelectorAll('.zone.shop .card').forEach((c, i) => { c.style.animationDelay = (i * 35) + 'ms'; c.classList.add('flip'); }); }

// Ranked: rank moves once, when the run ends, by total wins (6+ up, 5 stay, under 5 down)
function finishRunStats() {
  if (run.statsDone) return;
  run.statsDone = true;
  prof.runs++; if (run.result === 'champion') prof.champs++;
  prof.bestWins = Math.max(prof.bestWins, run.wins);
  if (run.mode === 'ranked') {
    const before = prof.rank;
    prof.rank = Math.max(0, Math.min(D.RANKS.length - 1, prof.rank + D.rankDelta(run.wins)));
    prof.peakRank = Math.max(prof.peakRank, prof.rank);
    run.rankChange = { before, after: prof.rank };
  }
  saveProf();
}
function rankForecast() {
  const w = run.wins;
  if (w >= D.RANK_RULE.up) return '<span class="good">rank up locked in ▲</span>';
  if (w === D.RANK_RULE.stay) return 'rank holds · 1 more win to rank up';
  return `${D.RANK_RULE.stay - w} more win${D.RANK_RULE.stay - w > 1 ? 's' : ''} to hold rank`;
}
function rankChangeLine() {
  const c = run.rankChange; if (!c) return '';
  const a = D.RANKS[c.after];
  const word = c.after > c.before ? '<b class="good">RANK UP!</b>' : c.after < c.before ? '<b class="bad">Rank down</b>' : (c.before === D.RANKS.length - 1 && run.wins >= D.RANK_RULE.up ? 'Still at the top!' : 'Rank holds');
  return `<div class="rankchg">${word} ${a.icon} ${a.name} <span class="dim">(${run.wins} wins)</span></div>`;
}

function kwPop(el) {
  const old = document.getElementById('kwpop'); if (old) old.remove();
  const k = el.dataset.k, box = document.createElement('div');
  box.id = 'kwpop'; box.className = 'kwpop';
  box.innerHTML = `<b>${esc(k)}</b> ${esc(D.KEYWORDS[k] || '')}`;
  document.body.appendChild(box);
  const r = el.getBoundingClientRect(), w = Math.min(280, window.innerWidth - 16);
  box.style.width = w + 'px';
  box.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  const h = box.offsetHeight;
  box.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8) + 'px';
}
document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
document.addEventListener('click', (e) => {
  const kp = document.getElementById('kwpop');
  if (kp && !(e.target.closest && e.target.closest('.kw'))) { kp.remove(); if (!e.target.closest('[data-act]')) return; }
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) { e.preventDefault(); const fn = actions[a.dataset.act]; if (fn) fn(a); return; }
  const c = e.target.closest('.card[data-z]');
  if (c && suppressClick) return;
  if (c && c.closest('#app')) { const z = c.dataset.z; tapSlot(z, z === 'dex' ? c.dataset.i : Number(c.dataset.i)); return; }
  if (e.target === $modal) closeModal();
  // tapping empty space closes the details sheet
  else if (ui.sel && e.target.closest && e.target.closest('main.fit') && !e.target.closest('.card, button')) { ui.sel = null; render(); }
});

// ---------------------------------------------------------------- drag and drop (shop screen)
// Touch or mouse: press a card and move ~20px to start dragging (the shop never scrolls, so no hold is needed).
// Only a release over a valid target does anything; anywhere else cancels. Taps still open the details sheet.
const DRAG = { on: false, pend: null };
let suppressClick = false;
const slotsOf = (z) => (z === 'team' ? run.team : run.bench);
function dragSource(card) {
  if (!run || run.phase !== 'shop' || ui.battle || ui.screen !== 'run' || R.currentTrinketChoice(run)) return null;
  const z = card.dataset.z, i = Number(card.dataset.i);
  if (z === 'shop') return run.shop[i] && run.shop[i].mon ? { zone: z, i } : null;
  if (z === 'tshop') return run.tshop && run.tshop.id ? { zone: z, i: 0 } : null;
  if (z === 'team' || z === 'bench') return slotsOf(z)[i] ? { zone: z, i } : null;
  return null;
}
function canDrop(src, z, i) {
  if (z !== 'team' && z !== 'bench') return false;
  if (src.zone === 'tshop') return true;
  if (src.zone === 'shop') {
    const m = slotsOf(z)[i], id = run.shop[src.i].mon.id;
    if (!m) return true;
    return m.id === id && m.lvl === 1 && R.owned(run).filter(o => o.m.id === id && o.m.lvl === 1).length >= 2; // completes a merge
  }
  return !(src.zone === z && src.i === i);
}
function beginDrag() {
  const p = DRAG.pend; if (!p) return;
  DRAG.on = true; DRAG.src = p.src; suppressClick = true;
  const r = p.card.getBoundingClientRect();
  const g = p.card.cloneNode(true);
  g.classList.add('ghost'); g.classList.remove('sel');
  g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
  document.body.appendChild(g); DRAG.ghost = g; DRAG.w = r.width; DRAG.h = r.height;
  p.card.classList.add('dragging');
  document.querySelectorAll('#app .card[data-z]').forEach(c => { if (canDrop(p.src, c.dataset.z, Number(c.dataset.i))) c.classList.add('droptarget'); });
  if (p.src.zone === 'team' || p.src.zone === 'bench') {
    const bar = document.getElementById('actionbar');
    if (bar) bar.innerHTML = `<div class="sellzone" id="sellzone">${IC.trash} Drop here to sell · +${R.sellValue(run, slotsOf(p.src.zone)[p.src.i])} gold</div>`;
  }
  if (navigator.vibrate) navigator.vibrate(15);
  sfx.tap();
  moveGhost(p.x, p.y);
  DRAG.pend = null;
}
function moveGhost(x, y) {
  DRAG.x = x; DRAG.y = y;
  if (DRAG.ghost) DRAG.ghost.style.transform = `translate(${x - DRAG.w / 2}px, ${y - DRAG.h * 0.6}px) scale(1.08) rotate(-3deg)`;
  document.querySelectorAll('.droptarget.hover, .sellzone.hover').forEach(c => c.classList.remove('hover'));
  const t = hitTarget(x, y); if (t) t.classList.add('hover');
}
function hitTarget(x, y) {
  if (DRAG.ghost) DRAG.ghost.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (DRAG.ghost) DRAG.ghost.style.display = '';
  if (!el) return null;
  return el.closest('#sellzone') || el.closest('.card.droptarget');
}
function endDrag(x, y) {
  const src = DRAG.src, t = hitTarget(x, y);
  DRAG.on = false; if (DRAG.ghost) DRAG.ghost.remove(); DRAG.ghost = null;
  setTimeout(() => { suppressClick = false; }, 60);
  let res = null;
  if (t && t.id === 'sellzone') { res = R.sell(run, src.zone, src.i); if (res.ok !== false) sfx.sell(); }
  else if (t) {
    const z = t.dataset.z, i = Number(t.dataset.i);
    if (src.zone === 'shop') res = R.buy(run, src.i, { zone: z, i });
    else if (src.zone === 'tshop') res = R.buyTrinket(run);
    else { R.move(run, src, { zone: z, i }); res = { ok: true }; sfx.drop(); }
    if (res && res.ok && src.zone !== 'team' && src.zone !== 'bench') sfx.buy();
  }
  if (res) { if (res.msg) toast(res.msg); if (res.ok) saveRun(); }
  ui.sel = null;
  render();
}
function pointDown(e, x, y, touch) {
  const card = e.target.closest && e.target.closest('#app .card[data-z]');
  if (!card) return;
  const src = dragSource(card); if (!src) return;
  DRAG.pend = { src, card, x, y, x0: x, y0: y, touch };
}
function pointMove(e, x, y) {
  if (DRAG.on) { e.preventDefault(); moveGhost(x, y); return; }
  const p = DRAG.pend; if (!p) return;
  const d = Math.hypot(x - p.x0, y - p.y0);
  p.x = x; p.y = y;
  if (p.touch) e.preventDefault();
  if (d > 20) beginDrag();
}
function pointUp(x, y) {
  if (DRAG.pend) DRAG.pend = null;
  if (DRAG.on) endDrag(x, y);
}
document.addEventListener('touchstart', (e) => { const t = e.touches[0]; pointDown(e, t.clientX, t.clientY, true); }, { passive: true });
document.addEventListener('touchmove', (e) => { const t = e.touches[0]; pointMove(e, t.clientX, t.clientY); }, { passive: false });
document.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; pointUp(t.clientX, t.clientY); });
document.addEventListener('touchcancel', () => { if (DRAG.on) { DRAG.on = false; if (DRAG.ghost) DRAG.ghost.remove(); render(); } DRAG.pend = null; });
document.addEventListener('mousedown', (e) => { if (e.button === 0) pointDown(e, e.clientX, e.clientY, false); });
document.addEventListener('mousemove', (e) => pointMove(e, e.clientX, e.clientY));
document.addEventListener('mouseup', (e) => pointUp(e.clientX, e.clientY));
document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.card[data-z]')) e.preventDefault(); });

// ================================================================ battle
// The engine runs the whole fight up front (deterministic); this replays its log with attribution:
// every hit beams from the being that cast it, trigger links show who set off whom, chains build a counter.
const $ = (id) => document.getElementById(id);
const GRADES = [[6, 'S'], [10, 'A'], [15, 'B'], [30, 'C'], [Infinity, 'D']];
const gradeOf = (t) => GRADES.find(g => t <= g[0])[1];

function renderInsp(liveOnly) {
  const b = ui.battle, el = $('binsp'); if (!b || !el) return;
  document.querySelectorAll('.bmon.insp').forEach(x => x.classList.remove('insp'));
  if (!b.insp) { el.innerHTML = ''; return; }
  const { s, p } = b.insp;
  const snap = s === 0 ? b.me : b.opp, m = snap.team[p], f = b.frame, st = f.s[s];
  const bm = $(`bm${s}${p}`); if (bm) bm.classList.add('insp');
  const pv = b.prev[s][p];
  const live = `<div class="live"><span>⏱ ${Math.round(st.ch[p] * 100)}%</span><span>💥 ${st.dm ? st.dm[p] : 0} dealt</span>${st.rp && st.rp[p] ? `<span class="b2">💪 Ramp +${Math.round(st.rp[p])}%</span>` : ''}${st.growth > 0.5 ? `<span class="b1">🌿 Team +${Math.round(st.growth)}%</span>` : ''}${st.pl && st.pl[p] ? `<span class="b1">+${fmt(st.pl[p])} hit dmg</span>` : ''}</div>`;
  if (liveOnly && el.querySelector('.live')) { el.querySelector('.live').outerHTML = live; return; }
  el.innerHTML = detail(m, { zone: 'battle', sheet: true, eff: { atk: pv.atk, pow: pv.pow, spd: pv.spd, src: pv.src, plus: m.plus || 0 }, side: s })
    .replace(`<button class="sheetx icon" data-act="deselect">${IC.close}</button>`, `<button class="sheetx icon" data-act="bclose">${IC.close}</button><div class="whose ${s ? 'bad' : 'good'}">${s ? 'Opponent' : 'Your being'}</div>`)
    .replace('<div class="flavor">', live + '<div class="flavor">');
}
document.addEventListener('click', (e) => {
  const bm = e.target.closest && e.target.closest('.bmon[data-bs]');
  if (!bm || !ui.battle) return;
  const s = Number(bm.dataset.bs), p = Number(bm.dataset.bp), b = ui.battle;
  b.insp = b.insp && b.insp.s === s && b.insp.p === p ? null : { s, p };
  sfx.select();
  renderInsp();
});

function startBattle() {
  const opp = R.pickOpponent(run, LIBRARY, prof.rank);
  const me = R.snapshot(run, 'You');
  const res = simulate(R.battleTeamFromSnap(me), R.battleTeamFromSnap(opp), { log: true });
  const won = res.winner === 0;
  const daysBefore = run.day;
  const sum = R.finishBattle(run, won, opp, res.gains[0], res.hp[1] / res.maxHp[1]);
  const h = run.history[run.history.length - 1]; if (h) h.t = Math.round(res.t * 10) / 10;
  // KO time records (wins only)
  let rec = null;
  if (won) {
    const t = Math.round(res.t * 10) / 10;
    rec = { t, grade: gradeOf(t), prevBest: prof.bestKO, best: !prof.bestKO || t < prof.bestKO };
    if (rec.best) prof.bestKO = t;
  }
  spot(opp.team.filter(Boolean).map(m => m.id));
  if (run.phase === 'over') finishRunStats();
  saveRun(); saveProf();
  if (prof.speed !== 1 && prof.speed !== 2) prof.speed = 2;
  ui.battle = { opp, me, res, sum, rec, day: daysBefore, pt: 0, fi: 0, speed: prof.speed, done: false, last: 0, live: 0, insp: null, paused: false,
    prev: [previewTeam(R.battleTeamFromSnap(me)), previewTeam(R.battleTeamFromSnap(opp))], frame: res.log[0],
    chain: [{ n: 0, t: -9, shown: 0 }, { n: 0, t: -9, shown: 0 }], hold: 0, shake: 0, lastDm: [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]] };
  buildBattle();
  requestAnimationFrame(stepBattle);
}

function bSide(snap, side, title) {
  const isOpp = side === 1;
  const av = snap.avatar ? D.AVATAR[snap.avatar] : null;
  const head = `<div class="b-head"><div class="portrait">${av ? av.face : '🙂'}</div><div class="b-who"><b>${esc(title)}</b>
    <span>${isOpp ? `${snap.wins}W-${snap.losses}L · ` : ''}${IC.bolt}${snap.power} ${snap.trinkets.map(t => D.TRINKET[t].icon).join('')}</span></div><div class="hpnum num" id="hn${side}"></div></div>`;
  const hp = `<div class="hpwrap" id="hp${side}"><div class="hpbar"><div class="hpghost"></div><div class="hpfill"></div><div class="shfill"></div><div class="hpticks"></div></div></div>`;
  const chips = `<div class="schips" id="sc${side}"></div>`;
  // front rows face each other across the rift: the opponent's front row is drawn at the bottom of their block
  const order = isOpp ? [3, 4, 5, 0, 1, 2] : [0, 1, 2, 3, 4, 5];
  const mons = `<div class="brow">${order.map(i => { const m = snap.team[i]; return m ? `<div class="bmon t-${MON[m.id].type} ${i < 3 ? 'front' : 'back'}" id="bm${side}${i}" data-bs="${side}" data-bp="${i}" style="${dimStyle(MON[m.id].type)}">
      <div class="art">${monSvg(m.id)}</div><span class="lvtag l${m.lvl}">${stars(m.lvl)}</span><span class="ki num"></span><span class="dm num"></span><div class="cd"><div></div></div></div>` : `<div class="bmon none"></div>`; }).join('')}</div>`;
  return `<div class="bside ${isOpp ? 'opp' : 'me'}">${isOpp ? head + hp + chips + mons : mons + chips + hp + head}</div>`;
}
function vsRow(snap) { return `<div class="vs-row">${snap.team.map(m => m ? `<div class="vs-m" style="${dimStyle(MON[m.id].type)}">${monSvg(m.id)}</div>` : '<div class="vs-m none"></div>').join('')}</div>`; }

function buildBattle() {
  const b = ui.battle;
  const av = b.opp.avatar ? D.AVATAR[b.opp.avatar] : null;
  $app.innerHTML = `<div class="battle" id="battle">
    <div class="stage" id="stage">
      ${bSide(b.opp, 1, b.opp.name)}
      <div class="rift" id="riftband"><div class="rline"></div><div class="timer num" id="timer">30.0</div>
        <div class="chain c1" id="ch1"></div><div class="chain c0" id="ch0"></div><div class="banner" id="banner"></div></div>
      ${bSide(b.me, 0, 'You')}
      <canvas id="fxc"></canvas><div id="fxlayer"></div><div class="ko" id="ko"></div>
    </div>
    <div class="b-ctl"><button id="pausebtn" class="pausebtn icon" data-act="pause" aria-label="Pause">${IC.pause}</button><button class="spd" id="spd2" data-act="speed2">2×</button><button class="skipbtn" data-act="skip">Skip ${IC.skip}</button></div>
    <div id="binsp"></div><div id="bresult" class="hidden"></div>
    <button id="bshow" class="primary bshow hidden" data-act="showresult">Show result</button>
    <div class="countdown" id="countdown">
      <div class="vs-side opp"><div class="vs-k">DAY ${b.day} · ${run.mode === 'ranked' ? 'RANKED' : 'RIVAL'} TRAINER</div><div class="vs-name">${av ? av.face + ' ' : ''}${esc(b.opp.name)}</div>
        <div class="vs-sub">${av ? esc(av.name) + ' · ' : ''}${b.opp.wins}W-${b.opp.losses}L · ${IC.bolt}${b.opp.power}</div>${vsRow(b.opp)}</div>
      <div class="vs-mid"><div class="vs-line"></div><div class="cd-n" id="cdn">3</div><div class="vs-line"></div></div>
      <div class="vs-side me">${vsRow(b.me)}<div class="vs-name">YOU</div><div class="vs-sub">${IC.bolt}${b.me.power}</div></div>
    </div></div>`;
  b.fx = new FxLayer($('fxc'));
  b.cd = 3; b.cdShown = 3; sfx.count(3);
  markSpeed();
  applyState(b.res.log[0]);
  handleEvents(b.res.log[0].ev);
}
function markSpeed() { const el = $('spd2'); if (el) el.classList.toggle('sel', ui.battle.speed === 2); }

function stepBattle(ts) {
  const b = ui.battle;
  if (!b || b.done) return;
  if (!b.last) b.last = ts;
  const dtReal = Math.min(0.1, (ts - b.last) / 1000);
  b.last = ts;
  shakeTick(dtReal);
  // 3-second VS countdown (real time, any speed), then FIGHT!
  if (b.cd > -0.6) {
    b.cd -= dtReal;
    const n = b.cd > 0 ? Math.ceil(b.cd) : 0;
    if (n !== b.cdShown) { b.cdShown = n; sfx.count(n); const el = $('cdn'); if (el) { el.textContent = n || 'FIGHT!'; el.classList.toggle('fight', !n); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; } if (!n) $('countdown')?.classList.add('go'); }
    if (b.cd <= -0.6) { const c = $('countdown'); if (c) c.remove(); }
    if (b.cd > 0) { requestAnimationFrame(stepBattle); return; }
  }
  if (b.paused || performance.now() < b.hold) { requestAnimationFrame(stepBattle); return; }
  b.pt += dtReal * b.speed;
  const log = b.res.log;
  let lastF = null;
  while (b.fi < log.length && log[b.fi].t <= b.pt) { lastF = log[b.fi]; applyState(lastF); handleEvents(lastF.ev); b.fi++; if (performance.now() < b.hold) break; }
  if (lastF) applyState(lastF);
  chainTick();
  if (b.fi >= log.length) { b.done = true; koSequence(); return; }
  requestAnimationFrame(stepBattle);
}

function skipBattle() {
  const b = ui.battle; if (b.done) return;
  if (b.cd > 0) { b.cd = 0; const c = $('countdown'); if (c) c.remove(); b.cd = -1; return; } // first Skip skips the countdown
  b.done = true;
  const log = b.res.log;
  applyState(log[log.length - 1]);
  for (const f of log) for (const e of f.ev) if (e.k === 'sudden') { banner('SUDDEN DEATH'); break; }
  koSequence(true);
}

function applyState(f) {
  const b = ui.battle;
  b.frame = f;
  if (b.insp && (!b.inspT || performance.now() - b.inspT > 250)) { b.inspT = performance.now(); renderInsp(true); }
  const left = Math.max(0, RULES.battleSeconds - f.t);
  const tm = $('timer');
  tm.textContent = f.t > RULES.battleSeconds ? `+${(f.t - RULES.battleSeconds).toFixed(1)}` : left.toFixed(1);
  tm.classList.toggle('sd', f.t > RULES.battleSeconds);
  for (let s = 0; s < 2; s++) {
    const st = f.s[s], max = b.res.maxHp[s];
    const w = $('hp' + s);
    const pct = Math.max(0, st.hp / max * 100);
    w.querySelector('.hpfill').style.width = pct + '%';
    w.querySelector('.hpghost').style.width = pct + '%';
    w.querySelector('.shfill').style.width = Math.min(100, st.sh / max * 100) + '%';
    $('hn' + s).innerHTML = `${Math.max(0, Math.ceil(st.hp))}${st.sh > 0.5 ? `<small>+${Math.round(st.sh)}</small>` : ''}`;
    w.classList.toggle('low', st.hp / max < 0.3);
    const chips = [];
    if (st.burn > 0.4) chips.push(`🔥${fmt(st.burn)}`);
    if (st.poison > 0.1) chips.push(`☠️${fmt(st.poison)}`);
    if (st.doom > 0.5) chips.push(`💀${Math.round(st.doom)} <small>${st.doomT}s</small>`);
    if (st.chill > 0.5) chips.push(`❄️${Math.round(st.chill)}%`);
    if (st.expose > 0.5) chips.push(`🎯${Math.round(st.expose)}%`);
    if (st.weaken > 0.5) chips.push(`🌀${Math.round(st.weaken)}%`);
    if (st.haste > 0.5) chips.push(`⚡${Math.round(st.haste)}%`);
    if (st.growth > 0.5) chips.push(`🌿${Math.round(st.growth)}%`);
    if (st.scrap > 0.5) chips.push(`🔩${Math.round(st.scrap)}`);
    if (st.pressure > 0.5) chips.push(`🌊${Math.round(st.pressure)}`);
    if (st.sleep > 0.05) chips.push('💤');
    const sc = chips.map(c => `<span class="schip">${c}</span>`).join('');
    const scEl = $('sc' + s); if (scEl.dataset.h !== sc) { scEl.innerHTML = sc; scEl.dataset.h = sc; }
    st.ch.forEach((c, i) => {
      const el = $(`bm${s}${i}`); if (!el) return;
      el.querySelector('.cd div').style.width = (c * 100) + '%';
      el.classList.toggle('ready', c > 0.85);
      el.classList.toggle('trans', !!(st.tr && st.tr[i]));
      const k = el.querySelector('.ki'); const kv = st.ki ? st.ki[i] : 0; if (k) k.textContent = kv >= 0.5 ? 'KI ' + Math.floor(kv) : '';
      const dmv = st.dm ? st.dm[i] : 0;
      if (dmv !== b.lastDm[s][i]) { b.lastDm[s][i] = dmv; const d = el.querySelector('.dm'); if (d) { d.textContent = dmv > 0 ? dmv : ''; d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); } }
    });
  }
}

// ---- positions (relative to the stage, which is what the canvas and the floating numbers live in)
function rel(el, fx = 0.5, fy = 0.5) {
  const L = $('stage').getBoundingClientRect(), r = el.getBoundingClientRect();
  return [r.left - L.left + r.width * fx, r.top - L.top + r.height * fy];
}
// where hits land: the current edge of the target's HP fill, so damage visibly "bites" the bar
function hpPoint(side, jitter = 0) {
  const b = ui.battle, w = $('hp' + side).querySelector('.hpbar');
  const st = b.frame.s[side], pct = Math.max(0.02, Math.min(1, st.hp / b.res.maxHp[side]));
  const [x, y] = rel(w, pct, 0.5);
  return [x + (Math.random() - 0.5) * jitter, y];
}
function floatNum(x, y, text, cls, size = 16) {
  const b = ui.battle; if (b.live > 22) return;
  const el = document.createElement('div');
  el.className = 'float ' + cls; el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.fontSize = Math.round(size) + 'px';
  $('fxlayer').appendChild(el); b.live++;
  setTimeout(() => { el.remove(); b.live--; }, 950);
}
function lunge(el, side) { if (!el) return; el.classList.remove('cast', 'up', 'down'); void el.offsetWidth; el.classList.add('cast', side === 0 ? 'up' : 'down'); }
function pulse(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function banner(t, cls = '') { const el = $('banner'); el.textContent = t; el.className = 'banner show ' + cls; clearTimeout(banner.t); banner.t = setTimeout(() => el.classList.remove('show'), 1300); }
function shake(px, holdMs = 0) {
  const b = ui.battle; if (REDUCED) return;
  b.shake = Math.max(b.shake, px);
  if (holdMs) b.hold = Math.max(b.hold, performance.now() + holdMs);
}
function shakeTick(dt) {
  const b = ui.battle, st = $('stage'); if (!st) return;
  if (b.shake > 0.3) { st.style.transform = `translate(${(Math.random() - 0.5) * b.shake}px, ${(Math.random() - 0.5) * b.shake}px)`; b.shake *= Math.pow(0.0015, dt); }
  else if (b.shake) { b.shake = 0; st.style.transform = ''; }
}
function bumpChain(s) {
  const b = ui.battle, c = b.chain[s];
  c.n = b.pt - c.t < 0.9 ? c.n + 1 : 1; c.t = b.pt;
  return c.n;
}
function chainTick() {
  const b = ui.battle;
  for (let s = 0; s < 2; s++) {
    const c = b.chain[s], el = $('ch' + s); if (!el) continue;
    const live = b.pt - c.t < 0.9 && c.n >= 3;
    if (live && c.shown !== c.n) {
      c.shown = c.n;
      const lv = c.n >= 12 ? 3 : c.n >= 7 ? 2 : 1;
      el.innerHTML = `<small>CHAIN</small>×${c.n}`; el.className = `chain c${s} on lv${lv}`;
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    } else if (!live && c.shown) { c.shown = 0; el.classList.remove('on'); }
  }
}

function handleEvents(evs) {
  if (!evs || !evs.length) return;
  const b = ui.battle, fx = b.fx;
  // sum this frame's hits per attacker, and other damage per side
  const hits = [{}, {}], other = [{}, {}];
  for (const e of evs) if (e.k === 'dmg') {
    if (e.kind === 'hit' && e.by !== undefined) { const a = 1 - e.s; hits[a][e.by] = (hits[a][e.by] || 0) + e.v; }
    else other[e.s][e.kind] = (other[e.s][e.kind] || 0) + e.v;
  }
  let healS = [0, 0], shS = [0, 0];
  for (const e of evs) {
    if (e.k === 'cast') {
      const el = $(`bm${e.s}${e.pos}`); if (!el) continue;
      const def = MON[(e.s === 0 ? b.me : b.opp).team[e.pos].id], col = TYPES[def.type].color;
      const n = e.start ? 0 : bumpChain(e.s);
      lunge(el, e.s);
      sfx.cast(def.type, n);
      const [x1, y1] = rel(el, 0.5, e.s === 0 ? 0.15 : 0.85);
      const amt = hits[e.s][e.pos];
      if (amt) {
        // an attack: beam into the enemy HP bar, number where it lands
        delete hits[e.s][e.pos];
        const [x2, y2] = hpPoint(1 - e.s, 10);
        const size = amt / b.res.maxHp[1 - e.s];
        fx.beam(x1, y1, x2, y2, col, 2 + Math.min(4, size * 40));
        fx.sparks(x2, y2, col, 6 + Math.min(18, Math.round(size * 160)), 120 + size * 900);
        floatNum(x2, y2 + (e.s === 0 ? 26 : -26), `-${fmt(amt)}`, 'dmg hit ' + (e.s === 0 ? 'mine' : 'theirs'), 15 + Math.min(26, Math.sqrt(size) * 70));
        sfx.hit(Math.min(1, size * 6));
        if (size > 0.05) shake(3 + Math.min(10, size * 50), size > 0.1 ? 70 : 0);
        if (size > 0.14) fx.flash(col, 0.25, 0.22);
        pulse($('hp' + (1 - e.s)), 'hit');
      } else {
        // a support cast: a ring on the caster
        fx.ring(...rel(el), col, 8, 52, 0.45);
      }
      if (e.echo) floatNum(x1, y1, 'ECHO', 'tag', 12);
    } else if (e.k === 'trig') {
      const el = $(`bm${e.s}${e.pos}`); if (!el) continue;
      const n = bumpChain(e.s);
      pulse(el, 'trig'); sfx.trig(n);
      const [x, y] = rel(el);
      if (e.from !== undefined && $(`bm${e.s}${e.from}`)) { const [fx1, fy1] = rel($(`bm${e.s}${e.from}`)); fx.link(fx1, fy1, x, y, '#ffcc3d'); }
      fx.ring(x, y, '#ffcc3d', 4, 38, 0.35, 2);
    } else if (e.k === 'heal' && e.v >= 0.5) healS[e.s] += e.v;
    else if (e.k === 'shield' && e.v >= 0.5) shS[e.s] += e.v;
    else if (e.k === 'fx' && e.fx === 'freeze') { const list = e.pos !== undefined ? [e.pos] : [0, 1, 2, 3, 4, 5]; for (const p of list) { const el = $(`bm${e.s}${p}`); if (el) { pulse(el, 'slept'); floatNum(...rel(el, 0.5, 0.3), 'Zz', 'tag sleep', 14); } } }
    else if (e.k === 'fx' && e.fx === 'transform') { const el = $(`bm${e.s}${e.pos}`); if (el) { fx.ring(...rel(el), '#ff8a3d', 10, 80, 0.6, 4); fx.sparks(...rel(el), '#ffcc3d', 22, 220); } banner('TRANSFORM!', 'gold'); sfx.transform(); shake(4); }
    else if (e.k === 'fx' && e.fx === 'confused') { const el = $(`bm${e.s}${e.pos}`); if (el) floatNum(...rel(el, 0.5, 0.3), '???', 'tag', 14); }
    else if (e.k === 'fx' && e.fx === 'overclock') banner('OVERCLOCK!', 'cyan');
    else if (e.k === 'fx' && e.fx === 'charge' && e.pos !== undefined) { const el = $(`bm${e.s}${e.pos}`); if (el) fx.ring(...rel(el), '#8fd8ff', 6, 40, 0.35); }
    else if (e.k === 'boom') { const [x, y] = hpPoint(e.s); fx.ring(x, y, '#b0b4ff', 10, 110, 0.6, 5); fx.sparks(x, y, '#b0b4ff', 30, 300); floatNum(x, y + (e.s === 1 ? 34 : -34), `DOOM -${fmt(e.v)}`, 'dmg doom', 26); shake(10, 120); sfx.boom(); }
    else if (e.k === 'rebirth') { const [x, y] = hpPoint(e.s); fx.ring(x, y, '#7dff9a', 10, 120, 0.7, 4); banner(e.rewind ? 'REWIND!' : e.rally ? 'LAST STAND!' : e.wind ? 'WIND-UP!' : 'REBIRTH!', 'green'); sfx.heal(); }
    else if (e.k === 'sudden' && !b.sdShown) { b.sdShown = true; banner('SUDDEN DEATH', 'red'); sfx.sudden(); $('riftband').classList.add('sd'); }
  }
  // leftover hits (triggered damage with no cast this frame, e.g. reactions) still land, from the being's portal
  for (let a = 0; a < 2; a++) for (const [pos, amt] of Object.entries(hits[a])) {
    const el = $(`bm${a}${pos}`); if (!el) continue;
    const [x1, y1] = rel(el, 0.5, a === 0 ? 0.15 : 0.85), [x2, y2] = hpPoint(1 - a, 10), col = TYPES[MON[(a === 0 ? b.me : b.opp).team[pos].id].type].color;
    fx.beam(x1, y1, x2, y2, col, 2); floatNum(x2, y2 + (a === 0 ? 26 : -26), `-${fmt(amt)}`, 'dmg hit ' + (a === 0 ? 'mine' : 'theirs'), 15);
  }
  const DOT = { burn: '#ff9a3d', poison: '#c77dff', sudden: '#bbbbbb', self: '#ff4a5c' };
  for (let s = 0; s < 2; s++) {
    for (const [k, v] of Object.entries(other[s])) {
      if (v < 0.5 || k === 'doom') continue;
      const [x, y] = hpPoint(s, 24);
      floatNum(x, y + (s === 1 ? 30 : -30), `-${fmt(v)}`, 'dmg ' + k, 14);
      if (DOT[k]) b.fx.sparks(x, y, DOT[k], 4, 60);
      if (k === 'burn' || k === 'poison') sfx.burn();
      pulse($('hp' + s), 'hit');
    }
    if (healS[s] >= 0.5) { const [x, y] = rel($('hp' + s).querySelector('.hpbar'), 0.5, 0.5); floatNum(x + 40, y + (s === 1 ? 30 : -30), `+${fmt(healS[s])}`, 'heal', 14); sfx.heal(); }
    if (shS[s] >= 0.5) { const [x, y] = rel($('hp' + s).querySelector('.hpbar'), 0.5, 0.5); floatNum(x - 40, y + (s === 1 ? 30 : -30), `+${fmt(shS[s])}`, 'shield', 14); sfx.shield(); }
  }
}

// the finish: hit-stop, flash, the loser's bar shatters, K.O. slams in
function koSequence(quick) {
  const b = ui.battle, res = b.res;
  const loser = res.winner === 0 ? 1 : 0;
  const ko = res.hp[loser] <= 0;
  const el = $('ko');
  if (el) {
    el.innerHTML = `<b>${ko ? 'K.O.' : 'TIME'}</b><small>${res.t.toFixed(1)}s</small>`;
    el.className = 'ko show ' + (res.winner === 0 ? 'win' : 'lose');
    $('riftband')?.classList.add('over');
  }
  $('hp' + loser)?.classList.add('shatter');
  if (!quick) { b.fx.flash('#fff', 0.35, 0.6); shake(14); }
  if (ko) sfx.ko();
  if (navigator.vibrate && !quick) navigator.vibrate([40, 30, 80]);
  setTimeout(() => { if (ui.battle === b) { res.winner === 0 ? sfx.win() : sfx.lose(); showResult(); } }, quick ? 500 : 1300);
}

// battle report: damage (red) and support (green: heals, shields, buffs) per being, bars scaled to the battle's top dealer
function reportHtml() {
  const b = ui.battle, rep = b.res.report, t = b.rtab || 0;
  let top = 1; for (const side of rep) for (const x of side) if (x) top = Math.max(top, x.dmg, x.sup);
  const score = (x) => x.dmg + x.sup * 0.8;
  const rows = rep[t].map((x, i) => ({ x, i })).filter(o => o.x);
  const mvp = rows.reduce((a, o) => (!a || score(o.x) > score(a.x) ? o : a), null);
  const snap = t === 0 ? b.me : b.opp;
  return `<div class="report" id="rep"><div class="rtabs"><button class="${t === 0 ? 'sel' : ''}" data-act="rtab" data-t="0">You</button><button class="${t === 1 ? 'sel' : ''}" data-act="rtab" data-t="1">Opponent</button></div>
    ${rows.map(({ x, i }) => { const m = snap.team[i], def = MON[m.id];
      return `<div class="rrow ${mvp && mvp.i === i ? 'mvp' : ''}" style="${dimStyle(def.type)}"><div class="rart">${monSvg(m.id)}</div><div class="rmid"><div class="rname">${esc(def.name)}${mvp && mvp.i === i ? ' <span class="mvptag">MVP</span>' : ''}</div>
      <div class="rbar dmg"><i style="width:${Math.round(x.dmg / top * 100)}%"></i><span class="num">${x.dmg}</span></div>
      ${x.sup > 0 ? `<div class="rbar sup"><i style="width:${Math.round(x.sup / top * 100)}%"></i><span class="num">${x.sup}</span></div>` : ''}</div></div>`; }).join('')}
    <div class="rkey"><span class="kd">■</span> damage <span class="ks">■</span> support (heals, shields, buffs)</div></div>`;
}
// after "Hide": total damage badges on the board
function dmgBadges(on) {
  const b = ui.battle; if (!b) return;
  document.querySelectorAll('.dbadge').forEach(x => x.remove());
  if (!on) return;
  b.res.report.forEach((side, s) => side.forEach((x, i) => { const el = $(`bm${s}${i}`); if (x && el) el.insertAdjacentHTML('beforeend', `<span class="dbadge num">${x.dmg}</span>`); }));
}
function showResult() {
  const b = ui.battle;
  b.insp = null; renderInsp(); // close any open details so the result buttons are reachable
  const won = b.res.winner === 0, s = b.sum;
  const tie = b.res.hp[0] <= 0 && b.res.hp[1] <= 0;
  const over = run.phase === 'over';
  const rkLine = run.mode === 'ranked' ? (over ? rankChangeLine() : `<div class="rp">${D.RANKS[prof.rank].icon} Ranked · ${rankForecast()}</div>`) : '';
  let headline = '';
  if (won && b.rec) {
    const r = b.rec;
    headline = `<div class="r-ko"><div class="grade g${r.grade}">${r.grade}</div><div class="r-kot"><b>KO in ${r.t.toFixed(1)}s</b>
      <small>${r.best ? (r.prevBest ? `New best! (was ${r.prevBest.toFixed(1)}s)` : 'Your first recorded KO') : `Best ${prof.bestKO.toFixed(1)}s`} · S is under 6s</small></div>${r.best ? '<div class="stamp">NEW BEST</div>' : ''}</div>`;
  } else if (!won) {
    const left = Math.ceil(b.res.hp[1]), pct = left / b.res.maxHp[1] * 100;
    headline = `<div class="r-close ${pct < 15 ? 'near' : ''}">${pct < 15 ? '<b>SO CLOSE!</b> ' : ''}They had <b>${left} HP</b> left (${Math.max(1, Math.round(pct))}%). Down at ${b.res.t.toFixed(1)}s.</div>`;
  }
  const el = $('bresult');
  el.innerHTML = `<div class="r-box ${won ? 'win' : 'lose'}"><div class="kick">DAY ${b.day} · ${esc(b.opp.name)}</div><div class="r-t">${won ? (tie ? 'TIE · YOU WIN' : 'VICTORY') : 'DEFEAT'}</div>
    ${headline}
    <div class="r-track">${winPips(run.wins)}${lifeHearts(run.lives)}</div>
    ${rkLine}
    ${b.res.gains[0].some(g => g > 0) ? `<div class="gains">${b.res.gains[0].map((g, i) => g > 0 ? `<span>${MON[b.me.team[i].id].name} +${Math.round(g * 100) / 100} dmg</span>` : '').join('')}</div>` : ''}
    ${s.grew ? `<div class="sub">${esc(s.grew)}</div>` : ''}
    ${s.wish ? `<div class="r-close near"><b>WISHBONE!</b> It snapped and saved your life.</div>` : ''}
    ${s.salvage ? `<div class="sub">🪙 Salvage +${s.salvage} gold</div>` : ''}${s.egg ? `<div class="sub">🥚 Trinkets +${s.egg} gold for the win</div>` : ''}
    ${reportHtml()}
    <button class="hidebtn" data-act="hideresult">Hide to inspect the battle</button>
    <button class="primary big" data-act="afterbattle">${over ? (run.result === 'champion' ? 'Claim the title 🏆' : 'See run summary') : `Day ${run.day} ${IC.arrow}`}</button></div>`;
  el.classList.remove('hidden');
}

window.addEventListener('resize', () => { if (ui.battle && ui.battle.fx) ui.battle.fx.resize(); });

// first visit: show help once
render();
if (ui.screen === 'run' && run && run.phase === 'event') dayIntro();
if (!prof.runs && !load('pocketomon.helpseen')) { store('pocketomon.helpseen', 1); modal(helpHtml()); }
