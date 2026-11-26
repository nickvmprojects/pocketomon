// Pocketomon UI: title, events, shop, battle replay, run end. Mobile first, tap to select.
import * as D from './data.js?v=0.6';
import * as R from './run.js?v=0.6';
import { simulate, previewTeam } from './battle.js?v=0.6';
import { monSvg } from './art.js?v=0.6';
import { LIBRARY } from './snapdata.js?v=0.6';

const { MON, TYPES, FX, RULES } = D;
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');
const KEY_RUN = 'pocketomon.run.v1', KEY_PROF = 'pocketomon.profile.v1';

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
let run = load(KEY_RUN);
if (run && run.v !== 2) run = null; // v0.1 saves used the old trinkets/prices
let prof = Object.assign({ rp: 0, runs: 0, champs: 0, bestWins: 0, speed: 2, seen: '' }, load(KEY_PROF) || {});
if (prof.rank === undefined) prof.rank = Math.min(D.RANKS.length - 1, Math.floor((prof.rp || 0) / 100)); // migrate v0.1 RP
prof.peakRank = Math.max(prof.peakRank || 0, prof.rank);
let ui = { screen: run && run.phase !== 'over' ? 'run' : 'title', sel: null, pending: null, battle: null, dexType: 'fire' };

const saveRun = () => store(KEY_RUN, run);
const saveProf = () => store(KEY_PROF, prof);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const SPLASHES = ['Now with blackjack. And hookers.', 'Gotta merge \'em all!', 'Ties go to you. Always.', '100% organic, free-range mons', 'Sudden death is just a suggestion', 'Recycle your trash mons!'];

let toastT = 0;
function toast(msg) {
  if (!msg) return;
  $toast.textContent = msg; $toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => $toast.classList.remove('show'), 1800);
}

// ---------------------------------------------------------------- shared bits
// buff highlight class by ratio effective / base (base = the mon at that level with average rolls)
const buffCls = (r) => (r < 1.04 ? (r < 0.96 ? 'nerf' : '') : r < 1.25 ? 'b1' : r < 1.75 ? 'b2' : r < 2.5 ? 'b3' : 'b4');
function numHtml(base, eff, unit = '') {
  const r = base > 0 ? eff / base : 1, c = buffCls(r);
  if (!c || c === 'nerf') return `<b class="${c}">${fmt(eff)}${unit}</b>`;
  return `<span class="was">${fmt(base)}</span>→<b class="${c}">${fmt(eff)}${unit}</b>`;
}
function moveChips(def, lvl = 1, atk = 1, pow = 1, plus = 0) {
  const hitB = D.fxValue('dmg', def.dmg, def, lvl, 1), hitE = D.fxValue('dmg', def.dmg, def, lvl, atk) + plus;
  const out = [`<span class="chip" title="Hit">💥 ${numHtml(hitB, hitE)}</span>`];
  for (const [k, v] of Object.entries(def.fx)) {
    const meta = FX[k]; if (!meta) continue;
    let x = D.fxValue(k, v, def, lvl, pow), xb = D.fxValue(k, v, def, lvl, 1);
    if (D.ECHO_KEYS.includes(k)) { x = Math.min(125, x); xb = Math.min(125, xb); }
    out.push(`<span class="chip" title="${meta.label}">${meta.icon} ${meta.label} ${numHtml(xb, x, meta.unit || '')}</span>`);
  }
  const p = def.pas;
  if (p.start) for (const [k, v] of Object.entries(p.start)) out.push(`<span class="chip pas">Start: ${FX[k].icon} ${FX[k].label} ${numHtml(D.fxValue(k, v, def, lvl, 1), D.fxValue(k, v, def, lvl, pow), FX[k].unit || '')}</span>`);
  if (p.regen) out.push(`<span class="chip pas">✨ Regen ${numHtml(D.fxValue('regen', p.regen, def, lvl, 1), D.fxValue('regen', p.regen, def, lvl, pow))}/s</span>`);
  if (p.salvage) out.push(`<span class="chip pas">🪙 +${p.salvage * lvl} gold after battle</span>`);
  if (p.rebirth) out.push(`<span class="chip pas">🪶 Once: heal ${fmt(D.fxValue('rebirth', p.rebirth, def, lvl, pow))}% at &lt;30% HP</span>`);
  return out.join('');
}
// effective (battle-start) multipliers for a mon at a location; team slots include auras, charms, slot trinkets
function effOf(m, zone, i) {
  const pv = zone === 'team' && ui.prev && ui.prev[i];
  return pv ? { atk: pv.atk, pow: pv.pow, spd: pv.spd, src: pv.src, plus: m.plus || 0 } : { atk: m.atk || 1, pow: m.pow || 1, spd: 1, src: [], plus: m.plus || 0 };
}
// the two numbers shown under a card's art: hit + main effect, coloured by how buffed they are
function statBadges(m, eff) {
  const def = MON[m.id], lvl = m.lvl || 1;
  const hb = D.fxValue('dmg', def.dmg, def, lvl, 1), he = D.fxValue('dmg', def.dmg, def, lvl, eff.atk) + eff.plus;
  let out = `<span class="sb hit ${buffCls(he / hb)}">${fmt(he)}</span>`;
  const key = Object.keys(def.fx).find(k => FX[k] && FX[k].scale !== 'pct' && FX[k].scale !== 'sec') || Object.keys(def.fx).find(k => FX[k]);
  if (key) {
    let xe = D.fxValue(key, def.fx[key], def, lvl, eff.pow), xb = D.fxValue(key, def.fx[key], def, lvl, 1);
    out += `<span class="sb fxb ${buffCls(xe / xb)}" style="--bc:${TYPES[def.type].color}">${FX[key].icon}${fmt(xe)}${FX[key].unit === '%' ? '%' : ''}</span>`;
  }
  return `<div class="sbadges">${out}</div>`;
}

const stars = (lvl) => '★'.repeat(lvl) + '<span class="dim">' + '★'.repeat(3 - lvl) + '</span>';
const rollCls = (x) => x >= 1.1 ? 'good' : x <= 0.9 ? 'bad' : '';

function card(m, o = {}) {
  if (!m) return `<div class="card empty ${o.sel ? 'sel' : ''} ${o.target ? 'target' : ''} ${o.aura ? 'aurahit' : ''}" data-z="${o.zone}" data-i="${o.i}">${o.label ? `<span class="slotno">${o.label}</span>` : ''}</div>`;
  const def = MON[m.id], T = TYPES[def.type];
  const shop = o.price !== undefined;
  const marks = (D.TRIGGERS[m.id] ? '<span title="Has a trigger">🔔</span>' : '') + (D.AURAS[m.id] ? '<span title="Has an aura">✨</span>' : '');
  const eff = o.zone === 'dex' ? { atk: 1, pow: 1, plus: 0 } : effOf(m, o.zone, o.i);
  return `<div class="card t-${def.type} ${o.sel ? 'sel' : ''} ${o.target ? 'target' : ''} ${o.small ? 'small' : ''} ${o.aura ? 'aurahit' : ''}" data-z="${o.zone}" data-i="${o.i}" style="--tc:${T.color};--td:${T.dark}">
    <div class="c-top"><span class="tierpill t${def.tier}">T${def.tier}</span>${m.lvl && !shop ? `<span class="lvtag">LV.${m.lvl}</span>` : ''}</div>
    ${marks ? `<div class="marks">${marks}</div>` : ''}${o.locked ? '<div class="lock">🔒</div>' : ''}
    <div class="art">${monSvg(m.id)}</div>
    ${o.own ? `<div class="own ${o.own.startsWith('⤴') ? 'merge' : ''}">${o.own}</div>` : ''}
    ${o.small || o.zone === 'dex' ? '' : statBadges(m, eff)}
    <div class="nm"><span class="nmt">${def.name}</span>${shop ? `<span class="price ${run && run.gold < o.price ? 'no' : ''}">${o.price}</span>` : ''}</div></div>`;
}
// where a mon's stats come from (rolls/growth, flat damage, auras, trinkets)
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
    btns = `<button class="primary" data-act="buy" ${run.gold < price ? 'disabled' : ''}>Buy 💰${price}</button>
      <button data-act="lock">${ctx.locked ? '🔓 Unlock' : '🔒 Lock for next day'}</button>`;
  } else if ((ctx.zone === 'team' || ctx.zone === 'bench') && !ctx.info) {
    btns = `<button data-act="sell">Sell +💰${R.sellValue(run, m)}</button>`;
    if (lvl < 3) note = `<div class="note dim">${lvl === 1 ? 'Merge 3 copies → level 2.' : 'Merge with another level 2 → level 3.'}</div>`;
  }
  return `<div class="detail ${ctx.sheet ? 'sheet' : ''} ${ctx.zone === 'shop' ? 'top' : ''}" style="--tc:${T.color}">
    ${ctx.sheet ? '<button class="sheetx" data-act="deselect">✕</button>' : ''}
    <div class="d-head"><div class="d-art">${monSvg(m.id)}</div>
      <div><div class="d-name">${def.name} <span class="lvtxt">${ctx.zone === 'dex' ? '' : 'Lv' + lvl}</span></div>
      <div class="d-meta"><span class="typechip" style="background:${T.color}">${T.icon} ${T.name}</span> <span class="tierpill t${def.tier}">Tier ${def.tier}</span> <span>⏱ ${def.cd}s</span></div>
      ${ctx.zone !== 'dex' ? `<div class="d-meta"><span>ATK <b class="${buffCls(eff.atk)}">${Math.round(eff.atk * 100)}%</b></span> <span>POW <b class="${buffCls(eff.pow)}">${Math.round(eff.pow * 100)}%</b></span>${eff.spd > 1.001 ? ` <span>Speed <b class="${buffCls(eff.spd)}">+${Math.round((eff.spd - 1) * 100)}%</b></span>` : ''}</div>` : ''}</div></div>
    <div class="chips">${moveChips(def, lvl, eff.atk, eff.pow, eff.plus)}</div>
    ${ctx.zone !== 'dex' ? srcLines(m, eff) : ''}
    ${D.TRIGGERS[m.id] ? `<div class="trigline">🔔 ${esc(D.triggerText(def, lvl, eff.pow))}</div>` : ''}
    ${D.AURAS[m.id] ? `<div class="trigline aura">✨ ${esc(D.auraText(def, lvl))}</div>` : ''}
    <div class="flavor">${esc(def.flavor)}</div>${note}
    ${btns ? `<div class="btns">${btns}</div>` : ''}</div>`;
}

function trinketIcons(list) {
  const counts = {}; for (const t of list) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).map(([t, n]) => `<span class="trk ${D.TRINKET[t].tier === 0 ? 'junk' : ''}" data-act="trinket" data-id="${t}">${D.TRINKET[t].icon}${n > 1 ? `<sub>×${n}</sub>` : ''}</span>`).join('');
}
function trinketCard(o, sel) {
  if (!o || !o.id) return `<div class="card sold tcard">SOLD</div>`;
  const t = D.TRINKET[o.id], price = D.trinketPrice(t);
  return `<div class="card tcard ${sel ? 'sel' : ''}" data-z="tshop" data-i="0">
    <div class="c-top"><span class="tierpill t${t.tier}">T${t.tier}</span></div>
    ${o.locked ? '<div class="lock">🔒</div>' : ''}<div class="ticon">${t.icon}</div><div class="tlabel">TRINKET</div><div class="nm"><span class="nmt">${esc(t.name)}</span><span class="price ${run.gold < price ? 'no' : ''}">${price}</span></div></div>`;
}
function trinketSheet(o) {
  const t = D.TRINKET[o.id], price = D.trinketPrice(t);
  return `<div class="detail sheet top" style="--tc:#ffd54a"><button class="sheetx" data-act="deselect">✕</button>
    <div class="d-head"><div class="d-art ticonbig">${t.icon}</div><div><div class="d-name">${esc(t.name)}</div>
    <div class="d-meta"><span class="tierpill t${t.tier}">Tier ${t.tier} trinket</span></div></div></div>
    <div class="trigline">${esc(t.desc)}</div>
    <div class="note dim">Trinkets last the whole run. Buying one also fires "when you gain a trinket" triggers.</div>
    <div class="btns"><button class="primary" data-act="buytrinket" ${run.gold < price ? 'disabled' : ''}>Buy 💰${price}</button>
    <button data-act="locktrinket">${o.locked ? '🔓 Unlock' : '🔒 Lock for next day'}</button></div></div>`;
}
function topbar() {
  const rk = D.RANKS[prof.rank];
  const ids = [...new Set(run.trinkets)];
  const MAXT = 7;
  return `<header class="topbar">
    <div class="tb-l"><span class="day">Day ${run.day}</span>${run.mode === 'ranked' ? `<span class="mode" style="color:${rk.color}">${rk.icon}</span>` : ''}</div>
    <div class="tb-r"><span title="Lives">❤️${run.lives}</span><span class="goldpill" title="Gold">$${run.gold}</span><span title="Wins">🏆${run.wins}/${RULES.winsToChampion}</span>
    <button class="icon" data-act="menu">☰</button></div></header>
    <div class="infobar"><span>⚡${R.runPower(run)}</span><span>🩷${R.maxHpFor(run.day, run.hpBonus, run.avatar, run.trinkets)}</span>
      <span class="tys">${run.types.map(t => `<i style="background:${TYPES[t].color}">${TYPES[t].icon}</i>`).join('')}</span>
      <span class="trks">${trinketIcons(run.trinkets.filter(t => ids.indexOf(t) < MAXT))}${ids.length > MAXT ? `<span class="trk more" data-act="menu">+${ids.length - MAXT}</span>` : ''}</span></div>`;
}

function teamRows(opts = {}) {
  const tgt = opts.target;
  const isSel = (z, i) => ui.sel && ui.sel.zone === z && ui.sel.i === i;
  const tOk = (m) => tgt && R.validTarget(run, tgt, m);
  // selecting an aura mon on the team outlines the slots it buffs
  const sm = ui.sel && ui.sel.zone === 'team' && run.team[ui.sel.i];
  const au = sm && D.AURAS[sm.id];
  const hit = (i) => au && D.inZone(au.who, ui.sel.i, i);
  return `<div class="zlabel zteam">My team <span>front row casts first</span></div>
    <div class="zone team">${run.team.map((m, i) => card(m, { zone: 'team', i, sel: isSel('team', i), label: i < 3 ? `Front ${i + 1}` : `Back ${i + 1}`, target: tOk(m), aura: hit(i) })).join('')}</div>
    <div class="zlabel zbench">Bench <span>doesn't fight</span></div>
    <div class="zone bench" style="--n:${run.bench.length}">${run.bench.map((m, i) => card(m, { zone: 'bench', i, sel: isSel('bench', i), target: tOk(m), small: true })).join('')}</div>`;
}

// ---------------------------------------------------------------- screens
function computePreview() {
  ui.prev = run && run.team ? previewTeam(R.battleTeamFromSnap({ day: run.day, hpBonus: run.hpBonus, avatar: run.avatar, trinkets: run.trinkets.filter(t => D.isBattleTrinket(t)), team: run.team })) : null;
}
function render() {
  computePreview();
  if (ui.battle) return; // battle owns the screen
  if (ui.screen === 'dex') return renderDex();
  if (ui.screen === 'title' || !run) return renderTitle();
  if (run.phase === 'over') return renderOver();
  if (run.phase === 'event') { renderEvent(); return playCelebrations(); }
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
function confetti(n, host) {
  const cols = ['#ffd54a', '#ff5a7a', '#6fe08a', '#5fb0ff', '#c77dff', '#ffa94d'];
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
    const def = MON[item.id], T = TYPES[def.type];
    el.innerHTML = `<div class="cel-box merge l${item.lvl}" style="--tc:${T.color}"><div class="burst"></div>${confetti(item.lvl === 3 ? 44 : 28)}
      <div class="cel-art">${monSvg(item.id)}</div><div class="cel-title">LEVEL ${item.lvl}${item.lvl === 3 ? '!!' : '!'}</div>
      <div class="cel-sub">${def.name} ${'★'.repeat(item.lvl)}</div></div>`;
    dur = item.lvl === 3 ? 2000 : 1500;
    if (navigator.vibrate) navigator.vibrate(item.lvl === 3 ? [30, 40, 60] : 30);
  } else if (item.k === 'gift') {
    const t = D.TRINKET[item.id];
    el.innerHTML = `<div class="cel-box gift"><div class="giftbox">🎁</div>
      <div class="gift-open">${confetti(20)}<div class="cel-ticon">${t.icon}</div><div class="cel-title sm">${esc(t.name)}</div>
      <div class="cel-sub"><span class="tierpill t${t.tier}">Tier ${t.tier} trinket</span></div><div class="cel-desc">${esc(t.desc)}</div></div></div>`;
    dur = 2100;
  } else {
    const counts = {}; for (const id of item.ids) counts[id] = (counts[id] || 0) + 1;
    el.innerHTML = `<div class="cel-box gift junkgift"><div class="giftbox small">🎁</div>
      <div class="gift-open"><div class="cel-ticon">${Object.keys(counts).map(id => D.TRINKET[id].icon + (counts[id] > 1 ? `<sub>×${counts[id]}</sub>` : '')).join(' ')}</div>
      <div class="cel-title sm">Junk ×${item.ids.length}</div><div class="cel-desc">No effect, but every one counts as a trinket!</div></div></div>`;
    dur = 1300;
  }
  document.body.appendChild(el);
  let closed = false;
  const close = () => { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => { el.remove(); done(); }, 180); };
  el.addEventListener('click', close);
  setTimeout(close, dur);
}

let splashI = 0;
const PARADE = D.TYPE_KEYS.map(t => D.MONS.filter(m => m.type === t)[Math.floor(Math.random() * 10)].id).sort(() => Math.random() - 0.5).slice(0, 6);
function renderTitle() {
  const ri = prof.rank, rk = D.RANKS[ri];
  const canContinue = run && run.phase !== 'over';
  const seenNew = prof.seen === D.VERSION;
  $app.innerHTML = `<div class="title">
    <div class="logowrap"><div class="logo">POCKET<span>O</span>MON</div>
    <div class="splash" data-act="splash">${esc(SPLASHES[splashI % SPLASHES.length])}</div></div>
    <div class="tag">Buy mons. Merge mons. 30 second showdowns.</div>
    <div class="parade">${PARADE.map(id => `<div>${monSvg(id)}</div>`).join('')}</div>
    <div class="rankbox" style="--rc:${rk.color}">
      <div class="rk-name">${rk.icon} ${rk.name}</div>
      <div class="ladder">${D.RANKS.map((r, i) => `<span class="${i === ri ? 'on' : i < ri ? 'past' : ''}" title="${r.name}">${r.icon}</span>`).join('')}</div>
      <div class="sub">Ranked runs: 6+ wins rank up · 5 holds · under 5 ranks down</div>
      <div class="sub">Runs ${prof.runs} · Champion ${prof.champs}× · Best ${prof.bestWins} wins · Peak ${D.RANKS[prof.peakRank].icon}</div>
    </div>
    <div class="menu">
      ${canContinue ? `<button class="primary big" data-act="continue">▶ Continue (Day ${run.day}, ${run.mode})</button>` : ''}
      <button class="${canContinue ? '' : 'primary'} big" data-act="new" data-mode="normal">New Normal run</button>
      <button class="big ranked" data-act="new" data-mode="ranked">New Ranked run ${rk.icon}</button>
      <div class="btnrow"><button data-act="help">How to play</button><button data-act="dex">Mondex</button><button data-act="news">What's new${seenNew ? '' : ' <span class="dot"></span>'}</button></div>
    </div>
    <div class="ver">v${D.VERSION}</div></div>`;
}

function renderEvent() {
  const ev = run.event;
  const pend = ui.pending !== null ? ev.choices[ui.pending] : null;
  const isSel = ui.sel;
  const selM = isSel && (isSel.zone === 'team' ? run.team : run.bench)[isSel.i];
  $app.innerHTML = `${topbar()}<main class="fit eventfit">
    <div class="evhead"><h2>${ev.avatar ? '👋 ' : '🗺️ '}${esc(ev.title)}</h2>
    ${pend ? `<div class="note pick">Tap a glowing mon for <b>${esc(pend.title)}</b> <button class="small" data-act="cancelpick">Cancel</button></div>` : ''}</div>
    <div class="choices ${ev.avatar ? 'big' : ''}">${ev.choices.map((c, i) => {
      const blocked = R.choiceBlocked(run, c);
      return `<button class="choice ${ui.pending === i ? 'sel' : ''}" data-act="choose" data-i="${i}" ${blocked ? 'disabled' : ''}>
        <div class="c-ic">${c.icon}</div><div class="c-t">${esc(c.title)}</div><div class="c-d">${esc(c.desc)}</div>
        ${c.id && MON[c.id] && c.kind === 'wild' ? `<div class="c-mon">${monSvg(c.id)}</div>` : ''}
        ${blocked ? `<div class="c-x">${blocked}</div>` : ''}</button>`;
    }).join('')}</div>
    ${run.avatar ? `<div class="evteam">${teamRows({ target: pend && pend.needsTarget ? pend : null })}</div>` : `<div class="sub center">Today's shop types: ${run.types.map(t => TYPES[t].icon + ' ' + TYPES[t].name).join(' · ')}. Trainer perks last the whole run.</div>`}
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
  const tpanel = tq ? `<div class="popup"><div class="tpick"><h2>✨ Merge reward!</h2><div class="sub">Pick a tier ${tq.tier} trinket. It lasts the whole run.${run.trinketQueue.length > 1 ? ` (${run.trinketQueue.length - 1} more after this)` : ''}</div>
    <div class="choices">${tq.options.map(id => { const t = D.TRINKET[id]; return `<button class="choice" data-act="picktrinket" data-id="${id}">
      <div class="c-ic">${t.icon}</div><div class="c-t">${esc(t.name)} <span class="ttier t${t.tier}">T${t.tier}</span></div><div class="c-d">${esc(t.desc)}</div></button>`; }).join('')}</div></div></div>` : '';
  const ownTag = (id) => { const n = R.owned(run).filter(x => x.m.id === id && x.m.lvl === 1).length; return n ? (n >= 2 ? '⤴ MERGE' : `own ${n}`) : ''; };
  const nOff = run.shop.length + 1;
  const cols = nOff > 6 ? 4 : 3;
  $app.innerHTML = `${topbar()}<main class="fit shopfit" data-act-bg="1">
    ${teamRows()}
    <div class="zlabel zshop">Shop <span>tiers up to ${D.maxTier(run.day)}${run.sale ? ' · <b class="good">SALE −5</b>' : ''}</span></div>
    <div class="zone shop" style="--c:${cols};--r:${Math.ceil(nOff / cols)}">${run.shop.map((o, i) => o.mon ? card(o.mon, {
      zone: 'shop', i, price: R.offerPrice(run, MON[o.mon.id]), locked: o.locked, sel: sel && sel.zone === 'shop' && sel.i === i, own: ownTag(o.mon.id),
    }) : `<div class="card sold">SOLD</div>`).join('')}${trinketCard(run.tshop, sel && sel.zone === 'tshop')}</div>
  </main>${tpanel}
  ${selM ? detail(selM, ctx) : tsel ? trinketSheet(run.tshop) : ''}
  <footer class="actionbar" id="actionbar">
    <button data-act="reroll" ${run.gold < rc ? 'disabled' : ''}>🎲 ${rc ? 'Reroll $' + rc : `Free (${freeR})`}</button>
    <button class="primary" data-act="battle" ${tq ? 'disabled' : ''}>⚔️ Battle!</button>
  </footer>`;
}

function renderOver() {
  const champ = run.result === 'champion';
  $app.innerHTML = `<main class="scroll over">
    <div class="bigicon">${champ ? '🏆' : '🥀'}</div>
    <h2 class="center">${champ ? 'Champion!' : 'Run over'}</h2>
    <div class="center sub">${run.mode === 'ranked' ? 'Ranked' : 'Normal'} run · ${run.wins} wins · ${run.losses} losses · reached day ${run.day}</div>
    ${rankChangeLine()}
    <h3>Final team</h3><div class="grid3 team">${run.team.map((m, i) => card(m, { zone: 'final', i })).join('')}</div>
    <h3>Battles</h3><div class="hist">${run.history.map(h => `<div class="${h.won ? 'good' : 'bad'}">D${h.day} ${h.won ? 'W' : 'L'} vs ${esc(h.opp)} <span class="dim">(⚡${h.power} vs ${h.oppPower})</span></div>`).join('')}</div>
    <div class="menu"><button class="primary big" data-act="new" data-mode="${run.mode}">Play again</button><button class="big" data-act="title">Title</button></div>
  </main>`;
}

function renderDex() {
  const t = ui.dexType;
  const list = D.MONS.filter(m => m.type === t);
  const s = ui.dexSel ? MON[ui.dexSel] : null;
  $app.innerHTML = `<header class="topbar"><div class="tb-l"><span class="day">Mondex</span></div><div class="tb-r"><button class="icon" data-act="title">✕</button></div></header>
  <main class="scroll">
    <div class="dextabs">${D.TYPE_KEYS.map(k => `<button class="${k === t ? 'sel' : ''}" data-act="dextype" data-t="${k}" style="--tc:${TYPES[k].color}">${TYPES[k].icon}</button>`).join('')}</div>
    <div class="note"><b>${TYPES[t].icon} ${TYPES[t].name} — ${TYPES[t].mech}.</b> ${TYPES[t].blurb}</div>
    <div class="row5">${list.map(m => card({ id: m.id, lvl: 0 }, { zone: 'dex', i: m.id, sel: ui.dexSel === m.id })).join('')}</div>
    ${s ? detail({ id: s.id, lvl: 1, atk: 1, pow: 1 }, { zone: 'dex' }) : '<div class="hint">Tap a mon. Numbers shown at level 1 with average rolls.</div>'}
  </main>`;
}

// ---------------------------------------------------------------- modals
function modal(html, ownButtons) { $modal.innerHTML = `<div class="m-box">${html}${ownButtons ? '' : '<div class="btns"><button class="primary" data-act="closemodal">OK</button></div>'}</div>`; $modal.classList.remove('hidden'); }
function closeModal() { $modal.classList.add('hidden'); $modal.innerHTML = ''; }

function helpHtml() {
  return `<h2>How to play</h2>
  <p>Each <b>day</b>: pick 1 of 3 <b>event</b> choices, shop for mons, then fight <b>one 30 second battle</b> against another trainer's snapshot from the same day. Win 10 battles to become Champion; lose 5 lives and the run ends.</p>
  <p><b>Battles</b> are automatic. Every mon casts its move each time its cooldown fills, in slot order (slot 1 first). All mons hit the enemy team's <b>shared HP bar</b>. After 30s, <b>sudden death</b> drains both teams faster every second. Ties go to you.</p>
  <p><b>Shop</b>: up to 6 mons on your team, extras wait on the bench. Each shop copy has its own ATK and POW roll. Buy <b>3 copies</b> of a mon to merge it into <b>level 2</b>, and two level 2s into <b>level 3</b>. Merging keeps the best ATK and POW of the copies. Tier never changes. Lock offers you want to keep for tomorrow; unspent gold carries over.</p>
  <p><b>Each run uses 5 random types</b> in the shop, so copies show up often enough to merge.</p>
  <p><b>Tap</b> any card to see its details (tap another to switch, ✕ or empty space to close). Taps never move or buy anything.</p>
  <p><b>Drag</b> to act: drag a shop card onto an empty team or bench slot to buy it there (or onto a slot holding 2 copies to merge). Drag your mons onto other slots to swap them, or onto the bottom bar to sell. Releasing anywhere else cancels. The details panel also has Buy and Sell buttons.</p>
  <p><b>Trinkets</b>: one is always for sale in the shop. Some mons make junk trinkets (no effect, but they count for "when you gain a trinket" triggers) or find real ones.</p>
  <p><b>Team grid</b>: slots 1-3 are the front row and cast first; 4-6 are the back row. "Behind" means the slot directly behind; "adjacent" means left, right, front or behind (no diagonals).</p>
  <p><b>🔔 Triggers</b>: some mons react to things (being bought or sold, levelling up, trinkets, rerolls, wins, allies casting, low HP, sudden death...). A mon is never triggered by a copy of itself, and fires at most once per chain. <b>✨ Auras</b> constantly buff nearby (or far) allies.</p>
  <p><b>⚡ Power</b> is just the sum of your mons' numbers, for fun. It isn't how strong your team really is: Ranked uses a hidden rating.</p>
  <p><b>Buffs</b>: numbers on cards and in the details are what the mon will have when the battle starts (auras, charms, slot trinkets and growth included). The more a number is buffed, the brighter it glows.</p>
  <p><b>In battle</b>: tap any mon to see its live stats, ⏸ pauses, 2× speeds up. After the fight, "Hide" lets you inspect the board.</p>
  <p><b>Merge rewards</b>: every merge lets you pick 1 of 3 <b>trinkets</b> of the merged mon's tier. Reaching level 3 gives a single pick one tier higher, up to legendary tier 6. Trinkets last the whole run.</p>
  <p><b>Prices</b>: a mon costs about 10 × its tier, ±5 depending on how strong it is. Selling refunds half per copy.</p>
  <p><b>Ranked</b>: opponents are picked to match your team's hidden strength (a bit above it at higher ranks). Your rank moves when the run ends: <b>6+ wins → rank up</b>, <b>5 wins → rank holds</b>, <b>under 5 → rank down</b>. Ranks: ${D.RANKS.map(r => r.icon + ' ' + r.name).join(' → ')}.</p>
  <h3>Types</h3>${D.TYPE_KEYS.map(k => `<p><b>${TYPES[k].icon} ${TYPES[k].name} (${TYPES[k].mech})</b>: ${TYPES[k].blurb}</p>`).join('')}
  <p class="dim">Healing above max HP turns into shield at half value. Shield caps at 50% of max HP.</p>`;
}
function newsHtml() {
  return `<h2>What's new</h2>${D.CHANGELOG.map(c => `<h3>v${c.v} · ${c.date}</h3><ul>${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`).join('')}`;
}
function menuHtml() {
  return `<h2>Menu</h2><div class="menu">
    <button data-act="help">How to play</button><button data-act="dex">Mondex</button>
    <button data-act="title">Back to title (run is saved)</button>
    <button class="danger" data-act="abandon">Abandon run</button></div>
    <h3>Trinkets</h3>${run.trinkets.length ? [...new Set(run.trinkets)].map(t => { const n = run.trinkets.filter(x => x === t).length; return `<p>${D.TRINKET[t].icon} <b>${D.TRINKET[t].name}</b>${n > 1 ? ` ×${n}` : ''} <span class="ttier t${D.TRINKET[t].tier}">T${D.TRINKET[t].tier}</span>: ${D.TRINKET[t].desc}</p>`; }).join('') : '<p class="dim">None yet.</p>'}
    ${run.avatar ? `<h3>Trainer</h3><p>${D.AVATAR[run.avatar].face} <b>${D.AVATAR[run.avatar].name}</b>: ${D.AVATAR[run.avatar].perk}</p>` : ''}`;
}

// ---------------------------------------------------------------- actions
function startRun(mode) {
  run = R.newRun(mode);
  ui = { ...ui, screen: 'run', sel: null, pending: null };
  saveRun(); closeModal(); render();
}

function tapSlot(zone, i) {
  if (zone === 'dex') { ui.dexSel = ui.dexSel === i ? null : i; return render(); }
  if (zone === 'final') return;
  // event targeting
  if (run.phase === 'event' && ui.pending !== null) {
    const m = (zone === 'team' ? run.team : run.bench)[i];
    if (!m) return;
    if (!R.validTarget(run, run.event.choices[ui.pending], m)) return toast('That mon can\'t be picked for this');
    const res = R.chooseEvent(run, ui.pending, { zone, i });
    if (!res.ok) return toast(res.msg);
    ui.pending = null; saveRun(); toast(res.msg); return render();
  }
  // taps only ever select (or deselect); moving, swapping and buying into a slot is drag-only
  if (zone === 'tshop') { ui.sel = ui.sel && ui.sel.zone === 'tshop' ? null : { zone: 'tshop', i: 0 }; return render(); }
  const slotM = zone === 'shop' ? (run.shop[i] && run.shop[i].mon) : (zone === 'team' ? run.team : run.bench)[i];
  if (ui.sel && ui.sel.zone === zone && ui.sel.i === i) ui.sel = null;
  else ui.sel = slotM ? { zone, i } : null;
  render();
}

const actions = {
  continue() { ui.screen = 'run'; render(); },
  splash() { splashI++; render(); },
  deselect() { ui.sel = null; render(); },
  buytrinket() { const res = R.buyTrinket(run); toast(res.msg); if (res.ok) { ui.sel = null; saveRun(); } render(); },
  locktrinket() { R.toggleTrinketLock(run); saveRun(); render(); },
  picktrinket(el) { const res = R.chooseTrinket(run, el.dataset.id); toast(res.msg); saveRun(); render(); },
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
  dex() { closeModal(); ui.screen = 'dex'; render(); },
  dextype(el) { ui.dexType = el.dataset.t; ui.dexSel = null; render(); },
  help() { modal(helpHtml()); },
  news() { prof.seen = D.VERSION; saveProf(); modal(newsHtml()); },
  menu() { modal(menuHtml()); },
  closemodal() { closeModal(); if (ui.screen === 'title') render(); },
  trinket(el) { const t = D.TRINKET[el.dataset.id]; toast(`${t.icon} ${t.name} (T${t.tier}): ${t.desc}`); },
  abandon() { modal(`<h2>Abandon run?</h2><p>This ends the run now.${run.mode === 'ranked' ? ` Ranked: your ${run.wins} wins count for your rank.` : ''}</p><button class="danger" data-act="confirmabandon">Abandon</button>`); },
  confirmabandon() { run.phase = 'over'; run.result = 'out'; finishRunStats(); saveRun(); closeModal(); render(); },
  choose(el) {
    const i = Number(el.dataset.i), c = run.event.choices[i];
    if (c.needsTarget) { ui.pending = ui.pending === i ? null : i; return render(); }
    const res = R.chooseEvent(run, i);
    if (!res.ok) return toast(res.msg);
    ui.pending = null; saveRun(); toast(res.msg); render();
  },
  cancelpick() { ui.pending = null; render(); },
  buy() { const res = R.buy(run, ui.sel.i); toast(res.msg); if (res.ok) { ui.sel = res.at || null; saveRun(); } render(); },
  lock() { R.toggleLock(run, ui.sel.i); saveRun(); render(); },
  sell() { const res = R.sell(run, ui.sel.zone, ui.sel.i); toast(res.msg); ui.sel = null; saveRun(); render(); },
  tobench() { const j = run.bench.indexOf(null); if (j < 0) return toast('Bench is full'); R.move(run, ui.sel, { zone: 'bench', i: j }); ui.sel = null; saveRun(); render(); },
  toteam() { const j = run.team.indexOf(null); if (j < 0) return toast('Team is full: tap a team mon to swap'); R.move(run, ui.sel, { zone: 'team', i: j }); ui.sel = null; saveRun(); render(); },
  reroll() { const res = R.reroll(run); if (!res.ok) return toast(res.msg); if (ui.sel && ui.sel.zone === 'shop') ui.sel = null; saveRun(); render(); },
  battle() {
    if (!run.team.some(Boolean)) return toast('Put at least one mon on your team!');
    if (R.currentTrinketChoice(run)) return toast('Pick your merge trinket first!');
    const empty = run.team.filter(x => !x).length, benched = run.bench.filter(Boolean).length;
    const warn = [];
    if (empty && benched) warn.push(`${empty} empty team slot${empty > 1 ? 's' : ''} while ${benched} mon${benched > 1 ? 's sit' : ' sits'} on the bench`);
    else if (empty) warn.push(`${empty} empty team slot${empty > 1 ? 's' : ''}`);
    if (run.gold >= 10) warn.push(`💰${run.gold} unspent (it carries over)`);
    modal(`<h2>⚔️ Ready to battle?</h2><p>Day ${run.day} · ⚡ Power ${R.runPower(run)}</p>
      ${warn.length ? `<ul>${warn.map(w => `<li>${w}</li>`).join('')}</ul>` : '<p class="dim">Team looks complete.</p>'}
      <div class="btns"><button data-act="closemodal">Not yet</button><button class="primary" data-act="gobattle">Fight!</button></div>`, true);
  },
  gobattle() { closeModal(); startBattle(); },
  speed2() { prof.speed = prof.speed === 2 ? 1 : 2; saveProf(); if (ui.battle) { ui.battle.speed = prof.speed; markSpeed(); } },
  pause() { const b = ui.battle; if (!b || b.done) return; b.paused = !b.paused; const el = $('pausebtn'); if (el) { el.textContent = b.paused ? '▶' : '⏸'; el.classList.toggle('on', b.paused); } },
  hideresult() { $('bresult').classList.add('hidden'); $('bshow').classList.remove('hidden'); },
  showresult() { if (ui.battle) { ui.battle.insp = null; renderInsp(); } $('bshow').classList.add('hidden'); $('bresult').classList.remove('hidden'); },
  bclose() { if (ui.battle) { ui.battle.insp = null; renderInsp(); } },
  skip() { if (ui.battle) skipBattle(); },
  afterbattle() { ui.battle = null; ui.sel = null; render(); },
};

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
  if (w >= D.RANK_RULE.up) return '<span class="good">rank up locked in ⬆</span>';
  if (w === D.RANK_RULE.stay) return 'rank holds · 1 more win to rank up';
  return `${D.RANK_RULE.stay - w} more win${D.RANK_RULE.stay - w > 1 ? 's' : ''} to hold rank`;
}
function rankChangeLine() {
  const c = run.rankChange; if (!c) return '';
  const a = D.RANKS[c.after];
  const word = c.after > c.before ? '<b class="good">RANK UP!</b>' : c.after < c.before ? '<b class="bad">Rank down</b>' : (c.before === D.RANKS.length - 1 && run.wins >= D.RANK_RULE.up ? 'Still at the top!' : 'Rank holds');
  return `<div class="center big">${word} ${a.icon} ${a.name} <span class="dim">(${run.wins} wins)</span></div>`;
}

document.addEventListener('click', (e) => {
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
    if (bar) bar.innerHTML = `<div class="sellzone" id="sellzone">🗑️ Drop here to sell · +💰${R.sellValue(run, slotsOf(p.src.zone)[p.src.i])}</div>`;
  }
  if (navigator.vibrate) navigator.vibrate(15);
  moveGhost(p.x, p.y);
  DRAG.pend = null;
  requestAnimationFrame(autoScroll);
}
function moveGhost(x, y) {
  DRAG.x = x; DRAG.y = y;
  if (DRAG.ghost) DRAG.ghost.style.transform = `translate(${x - DRAG.w / 2}px, ${y - DRAG.h * 0.6}px) scale(1.08) rotate(-3deg)`;
  document.querySelectorAll('.droptarget.hover, .sellzone.hover').forEach(c => c.classList.remove('hover'));
  const t = hitTarget(x, y); if (t) t.classList.add('hover');
}
function autoScroll() {
  if (!DRAG.on) return;
  const main = document.querySelector('#app main.scroll'); // (shop/event screens don't scroll any more)
  if (main) { if (DRAG.y < 140) main.scrollTop -= 10; else if (DRAG.y > window.innerHeight - 150) main.scrollTop += 10; }
  requestAnimationFrame(autoScroll);
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
  if (t && t.id === 'sellzone') res = R.sell(run, src.zone, src.i);
  else if (t) {
    const z = t.dataset.z, i = Number(t.dataset.i);
    if (src.zone === 'shop') res = R.buy(run, src.i, { zone: z, i });
    else if (src.zone === 'tshop') res = R.buyTrinket(run);
    else { R.move(run, src, { zone: z, i }); res = { ok: true }; }
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
  if (DRAG.pend) { clearTimeout(DRAG.pend.timer); DRAG.pend = null; }
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

// ---------------------------------------------------------------- battle inspect (the battle keeps running)
function renderInsp(liveOnly) {
  const b = ui.battle, el = $('binsp'); if (!b || !el) return;
  document.querySelectorAll('.bmon.insp').forEach(x => x.classList.remove('insp'));
  if (!b.insp) { el.innerHTML = ''; return; }
  const { s, p } = b.insp;
  const snap = s === 0 ? b.me : b.opp, m = snap.team[p], f = b.frame, st = f.s[s];
  const bm = $(`bm${s}${p}`); if (bm) bm.classList.add('insp');
  const pv = b.prev[s][p];
  const live = `<div class="live"><span>⏱ ${Math.round(st.ch[p] * 100)}%</span>${st.rp && st.rp[p] ? `<span class="b2">💪 Ramp +${Math.round(st.rp[p])}%</span>` : ''}${st.growth > 0.5 ? `<span class="b1">🌿 Team +${Math.round(st.growth)}%</span>` : ''}${st.pl && st.pl[p] ? `<span class="b1">+${fmt(st.pl[p])} hit dmg</span>` : ''}</div>`;
  if (liveOnly && el.querySelector('.live')) { el.querySelector('.live').outerHTML = live; return; }
  el.innerHTML = detail(m, { zone: 'battle', sheet: true, eff: { atk: pv.atk, pow: pv.pow, spd: pv.spd, src: pv.src, plus: m.plus || 0 }, side: s })
    .replace('<button class="sheetx" data-act="deselect">✕</button>', `<button class="sheetx" data-act="bclose">✕</button><div class="whose ${s ? 'bad' : 'good'}">${s ? 'Opponent' : 'Your mon'}</div>`)
    .replace('<div class="flavor">', live + '<div class="flavor">');
}
document.addEventListener('click', (e) => {
  const bm = e.target.closest && e.target.closest('.bmon[data-bs]');
  if (!bm || !ui.battle) return;
  const s = Number(bm.dataset.bs), p = Number(bm.dataset.bp), b = ui.battle;
  b.insp = b.insp && b.insp.s === s && b.insp.p === p ? null : { s, p };
  renderInsp();
});

// ---------------------------------------------------------------- battle
function startBattle() {
  const opp = R.pickOpponent(run, LIBRARY, prof.rank);
  const me = R.snapshot(run, 'You');
  const res = simulate(R.battleTeamFromSnap(me), R.battleTeamFromSnap(opp), { log: true });
  const won = res.winner === 0;
  const daysBefore = run.day;
  const sum = R.finishBattle(run, won, opp, res.gains[0]);
  if (run.phase === 'over') finishRunStats();
  saveRun(); saveProf();
  if (prof.speed !== 1 && prof.speed !== 2) prof.speed = 2;
  ui.battle = { opp, me, res, sum, day: daysBefore, pt: 0, fi: 0, speed: prof.speed, done: false, last: 0, live: 0, insp: null, paused: false,
    prev: [previewTeam(R.battleTeamFromSnap(me)), previewTeam(R.battleTeamFromSnap(opp))], frame: res.log[0] };
  buildBattle();
  requestAnimationFrame(stepBattle);
}

function bSide(snap, side, title) {
  const isOpp = side === 1;
  const av = snap.avatar ? D.AVATAR[snap.avatar] : null;
  const head = `<div class="b-head"><div class="portrait">${av ? av.face : '🙂'}</div><div class="b-who"><b>${esc(title)}</b>
    <span class="dim">${isOpp ? `${snap.wins}W-${snap.losses}L · ` : ''}⚡${snap.power} ${snap.trinkets.map(t => D.TRINKET[t].icon).join('')}</span></div></div>`;
  const hp = `<div class="hpwrap" id="hp${side}"><div class="hplabel">HP</div><div class="hpbar"><div class="hpfill"></div><div class="shfill"></div></div><div class="hptxt"></div></div>`;
  const chips = `<div class="schips" id="sc${side}"></div>`;
  const mons = `<div class="brow">${snap.team.map((m, i) => m ? `<div class="bmon t-${MON[m.id].type}" id="bm${side}${i}" data-bs="${side}" data-bp="${i}" style="--tc:${TYPES[MON[m.id].type].color}">
      <span class="lvtag">LV.${m.lvl}</span><div class="art">${monSvg(m.id)}</div><div class="cd"><div></div></div></div>` : `<div class="bmon none"></div>`).join('')}</div>`;
  return `<div class="bside ${isOpp ? 'opp' : 'me'}">${isOpp ? head + hp + chips + mons : mons + chips + hp + head}</div>`;
}

function buildBattle() {
  const b = ui.battle;
  $app.innerHTML = `<div class="battle" id="battle">
    <div class="b-top"><span>Day ${b.day} ${run.mode === 'ranked' ? '· Ranked' : ''}</span><span class="dim">vs a day-${b.day} snapshot</span></div>
    ${bSide(b.opp, 1, b.opp.name)}
    <div class="b-mid"><div class="timer" id="timer">30.0</div><div class="banner" id="banner"></div></div>
    ${bSide(b.me, 0, 'You')}
    <div class="b-ctl"><button id="pausebtn" class="pausebtn" data-act="pause">⏸</button><button class="spd" id="spd2" data-act="speed2">2×</button><button data-act="skip">Skip ⏭</button></div>
    <div id="fxlayer"></div><div id="binsp"></div><div id="bresult" class="hidden"></div>
    <button id="bshow" class="primary bshow hidden" data-act="showresult">Show result</button>
    <div class="countdown" id="countdown"><div class="cd-vs">Day ${b.day} · vs</div>
      <div class="cd-opp">${b.opp.avatar ? D.AVATAR[b.opp.avatar].face + ' ' : ''}${esc(b.opp.name)}</div>
      <div class="cd-vs">${b.opp.avatar ? esc(D.AVATAR[b.opp.avatar].name) + ' · ' : ''}⚡ ${b.opp.power}</div>
      <div class="cd-n" id="cdn">3</div></div></div>`;
  b.cd = 3; b.cdShown = 3;
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
  // 3-second countdown (real time, any speed), then FIGHT!
  if (b.cd > -0.6) {
    b.cd -= dtReal;
    const n = b.cd > 0 ? Math.ceil(b.cd) : 0;
    if (n !== b.cdShown) { b.cdShown = n; const el = $('cdn'); if (el) { el.textContent = n || 'FIGHT!'; el.classList.toggle('fight', !n); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; } }
    if (b.cd <= -0.6) { const c = $('countdown'); if (c) c.remove(); }
    if (b.cd > 0) { requestAnimationFrame(stepBattle); return; }
  }
  if (b.paused) { requestAnimationFrame(stepBattle); return; }
  b.pt += dtReal * b.speed;
  const log = b.res.log;
  let lastF = null;
  while (b.fi < log.length && log[b.fi].t <= b.pt) { lastF = log[b.fi]; handleEvents(lastF.ev); b.fi++; }
  if (lastF) applyState(lastF);
  if (b.fi >= log.length) { b.done = true; setTimeout(showResult, 700); return; }
  requestAnimationFrame(stepBattle);
}

function skipBattle() {
  const b = ui.battle; if (b.done) return;
  if (b.cd > 0) { b.cd = 0; const c = $('countdown'); if (c) c.remove(); b.cd = -1; return; } // first Skip skips the countdown
  b.done = true;
  const log = b.res.log;
  applyState(log[log.length - 1]);
  for (const f of log) for (const e of f.ev) if (e.k === 'sudden') { banner('SUDDEN DEATH'); break; }
  showResult();
}

const $ = (id) => document.getElementById(id);
function applyState(f) {
  const b = ui.battle;
  b.frame = f;
  if (b.insp && (!b.inspT || performance.now() - b.inspT > 250)) { b.inspT = performance.now(); renderInsp(true); }
  const left = Math.max(0, RULES.battleSeconds - f.t);
  $('timer').textContent = f.t > RULES.battleSeconds ? `+${(f.t - RULES.battleSeconds).toFixed(1)}` : left.toFixed(1);
  $('timer').classList.toggle('sd', f.t > RULES.battleSeconds);
  for (let s = 0; s < 2; s++) {
    const st = f.s[s], max = b.res.maxHp[s];
    const w = $('hp' + s);
    w.querySelector('.hpfill').style.width = Math.max(0, st.hp / max * 100) + '%';
    w.querySelector('.shfill').style.width = Math.min(100, st.sh / max * 100) + '%';
    w.querySelector('.hptxt').textContent = `${Math.max(0, Math.ceil(st.hp))} / ${max}${st.sh > 0.5 ? `  🛡️${Math.round(st.sh)}` : ''}`;
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
    $('sc' + s).innerHTML = chips.map(c => `<span class="schip">${c}</span>`).join('');
    st.ch.forEach((c, i) => { const el = $(`bm${s}${i}`); if (el) el.querySelector('.cd div').style.width = (c * 100) + '%'; });
  }
}

function center(el) {
  const L = $('battle').getBoundingClientRect(), r = el.getBoundingClientRect();
  return [r.left - L.left + r.width / 2, r.top - L.top + r.height / 2];
}
function floatText(side, text, cls) {
  const b = ui.battle; if (b.live > 14) return;
  const el = document.createElement('div');
  el.className = 'float ' + cls; el.textContent = text;
  const [x, y] = center($('hp' + side));
  el.style.left = (x + (Math.random() - 0.5) * 160) + 'px'; el.style.top = (y + (side === 1 ? 26 : -26)) + 'px';
  $('fxlayer').appendChild(el); b.live++;
  setTimeout(() => { el.remove(); b.live--; }, 900);
}
function projectile(fromEl, toEl, icon) {
  const b = ui.battle; if (b.live > 14 || !fromEl || !toEl) return;
  const el = document.createElement('div');
  el.className = 'proj'; el.textContent = icon;
  const [x1, y1] = center(fromEl), [x2, y2] = center(toEl);
  el.style.left = x1 + 'px'; el.style.top = y1 + 'px';
  $('fxlayer').appendChild(el); b.live++;
  const dur = 380 / Math.sqrt(b.speed);
  el.animate([{ transform: 'translate(-50%,-50%) scale(0.6)' }, { transform: `translate(calc(${x2 - x1}px - 50%), calc(${y2 - y1}px - 50%)) scale(1.2)` }], { duration: dur, easing: 'ease-in' });
  setTimeout(() => { el.remove(); b.live--; }, dur - 10);
}
function pop(el, icon) {
  if (!el) return; const b = ui.battle; if (b.live > 14) return;
  const p = document.createElement('div'); p.className = 'pop'; p.textContent = icon;
  const [x, y] = center(el); p.style.left = x + 'px'; p.style.top = y + 'px';
  $('fxlayer').appendChild(p); b.live++;
  setTimeout(() => { p.remove(); b.live--; }, 700);
}
function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function banner(t) { const el = $('banner'); el.textContent = t; el.classList.add('show'); }

function handleEvents(evs) {
  if (!evs || !evs.length) return;
  const b = ui.battle;
  const dmg = [{}, {}];
  for (const e of evs) {
    if (e.k === 'cast') {
      const el = $(`bm${e.s}${e.pos}`);
      shake(el);
      const def = MON[(e.s === 0 ? b.me : b.opp).team[e.pos].id];
      if (e.start) { pop(el, '✨'); continue; }
      if (e.echo) pop(el, '🎵');
      projectile(el, $('hp' + (1 - e.s)), TYPES[def.type].icon);
    } else if (e.k === 'trig') { pop($(`bm${e.s}${e.pos}`), '🔔'); shake($(`bm${e.s}${e.pos}`)); }
    else if (e.k === 'dmg') { dmg[e.s][e.kind] = (dmg[e.s][e.kind] || 0) + e.v; }
    else if (e.k === 'heal' && e.v >= 0.5) floatText(e.s, `+${fmt(e.v)}`, 'heal');
    else if (e.k === 'shield' && e.v >= 0.5) floatText(e.s, `🛡️+${fmt(e.v)}`, 'shield');
    else if (e.k === 'fx' && e.fx === 'freeze') { if (e.pos !== undefined) pop($(`bm${e.s}${e.pos}`), '🧊'); else for (let i = 0; i < 6; i++) pop($(`bm${e.s}${i}`), '🧊'); }
    else if (e.k === 'fx' && e.fx === 'charge' && e.pos !== undefined) pop($(`bm${e.s}${e.pos}`), '🔋');
    else if (e.k === 'boom') { pop($('hp' + e.s), '💀'); $('hp' + e.s).classList.add('boom'); setTimeout(() => $('hp' + e.s) && $('hp' + e.s).classList.remove('boom'), 400); }
    else if (e.k === 'rebirth') { pop($('hp' + e.s), '🪶'); floatText(e.s, 'REBIRTH!', 'heal'); }
    else if (e.k === 'sudden') banner('SUDDEN DEATH');
  }
  const icons = { hit: '', burn: '🔥', poison: '☠️', doom: '💀', sudden: '⏳' };
  for (let s = 0; s < 2; s++) for (const [k, v] of Object.entries(dmg[s])) if (v >= 0.5) floatText(s, `${icons[k] || ''}-${fmt(v)}`, 'dmg ' + k);
}

function showResult() {
  const b = ui.battle;
  b.insp = null; renderInsp(); // close any open details so the result buttons are reachable
  const won = b.res.winner === 0, s = b.sum;
  const tie = b.res.hp[0] <= 0 && b.res.hp[1] <= 0;
  const over = run.phase === 'over';
  const rkLine = run.mode === 'ranked' ? (over ? rankChangeLine() : `<div class="rp">${D.RANKS[prof.rank].icon} Ranked · ${rankForecast()}</div>`) : '';
  const el = $('bresult');
  el.innerHTML = `<div class="r-box ${won ? 'win' : 'lose'}"><div class="r-t">${won ? (tie ? 'Tie — you win!' : 'Victory!') : 'Defeat'}</div>
    <div class="sub">${b.res.t.toFixed(1)}s · your HP ${Math.ceil(b.res.hp[0])}/${b.res.maxHp[0]} · theirs ${Math.ceil(b.res.hp[1])}/${b.res.maxHp[1]}</div>
    ${rkLine}
    ${b.res.gains[0].some(g => g > 0) ? `<div class="gains">${b.res.gains[0].map((g, i) => g > 0 ? `<span>${MON[b.me.team[i].id].name} +${Math.round(g * 100) / 100} dmg</span>` : '').join('')}</div>` : ''}
    ${s.grew ? `<div class="sub">${esc(s.grew)}</div>` : ''}
    ${s.salvage ? `<div>🪙 Salvage +${s.salvage} gold</div>` : ''}${s.egg ? `<div>🥚 Trinkets +${s.egg} gold for the win</div>` : ''}
    <div class="sub">🏆 ${run.wins}/${RULES.winsToChampion} · ❤️ ${run.lives}</div>
    <button class="hidebtn" data-act="hideresult">👁 Hide to inspect the battle</button>
    <button class="primary big" data-act="afterbattle">${over ? (run.result === 'champion' ? 'Claim the title 🏆' : 'See run summary') : `Day ${run.day} →`}</button></div>`;
  el.classList.remove('hidden');
}

// first visit: show help once
render();
if (!prof.runs && !load('pocketomon.helpseen')) { store('pocketomon.helpseen', 1); modal(helpHtml()); }
