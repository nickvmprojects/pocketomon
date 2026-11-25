// Pocketomon UI: title, events, shop, battle replay, run end. Mobile first, tap to select.
import * as D from './data.js';
import * as R from './run.js';
import { simulate } from './battle.js';
import { monSvg } from './art.js';
import { LIBRARY } from './snapdata.js';

const { MON, TYPES, FX, RULES } = D;
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');
const KEY_RUN = 'pocketomon.run.v1', KEY_PROF = 'pocketomon.profile.v1';

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
let run = load(KEY_RUN);
if (run && run.v !== 1) run = null;
let prof = Object.assign({ rp: 0, peakRp: 0, runs: 0, champs: 0, bestWins: 0, speed: 2, seen: '' }, load(KEY_PROF) || {});
let ui = { screen: run && run.phase !== 'over' ? 'run' : 'title', sel: null, pending: null, battle: null, dexType: 'fire' };

const saveRun = () => store(KEY_RUN, run);
const saveProf = () => store(KEY_PROF, prof);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const rankOf = (rp) => Math.min(D.RANKS.length - 1, Math.floor(rp / D.RANK_STEP));

let toastT = 0;
function toast(msg) {
  if (!msg) return;
  $toast.textContent = msg; $toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => $toast.classList.remove('show'), 1800);
}

// ---------------------------------------------------------------- shared bits
function moveChips(def, lvl = 1, atk = 1, pow = 1) {
  const out = [`<span class="chip" title="Hit">💥 ${fmt(D.fxValue('dmg', def.dmg, def.tier, lvl, atk))}</span>`];
  for (const [k, v] of Object.entries(def.fx)) {
    const meta = FX[k]; if (!meta) continue;
    let x = D.fxValue(k, v, def.tier, lvl, pow);
    if (D.ECHO_KEYS.includes(k)) x = Math.min(125, x);
    out.push(`<span class="chip" title="${meta.label}">${meta.icon} ${meta.label} ${fmt(x)}${meta.unit || ''}</span>`);
  }
  const p = def.pas;
  if (p.start) for (const [k, v] of Object.entries(p.start)) out.push(`<span class="chip pas">Start: ${FX[k].icon} ${FX[k].label} ${fmt(D.fxValue(k, v, def.tier, lvl, pow))}${FX[k].unit || ''}</span>`);
  if (p.regen) out.push(`<span class="chip pas">✨ Regen ${fmt(D.fxValue('regen', p.regen, def.tier, lvl, pow))}/s</span>`);
  if (p.salvage) out.push(`<span class="chip pas">🪙 +${p.salvage * lvl} gold after battle</span>`);
  if (p.rebirth) out.push(`<span class="chip pas">🪶 Once: heal ${fmt(D.fxValue('rebirth', p.rebirth, def.tier, lvl, pow))}% at &lt;30% HP</span>`);
  return out.join('');
}

const stars = (lvl) => '★'.repeat(lvl) + '<span class="dim">' + '★'.repeat(3 - lvl) + '</span>';
const rollCls = (x) => x >= 1.1 ? 'good' : x <= 0.9 ? 'bad' : '';

function card(m, o = {}) {
  if (!m) return `<div class="card empty ${o.sel ? 'sel' : ''} ${o.target ? 'target' : ''}" data-z="${o.zone}" data-i="${o.i}">${o.label ? `<span class="slotno">${o.label}</span>` : ''}</div>`;
  const def = MON[m.id], T = TYPES[def.type];
  let extra = '';
  if (o.price !== undefined) extra += `<div class="price ${run && run.gold < o.price ? 'no' : ''}">💰${o.price}</div>`;
  if (o.locked) extra += `<div class="lock">🔒</div>`; // below the price badge
  if (o.own) extra += `<div class="own">${o.own}</div>`;
  return `<div class="card t-${def.type} ${o.sel ? 'sel' : ''} ${o.target ? 'target' : ''}" data-z="${o.zone}" data-i="${o.i}" style="--tc:${T.color};--td:${T.dark}">
    <div class="tier">T${def.tier}</div><div class="lv">${m.lvl && o.price === undefined ? stars(m.lvl) : ''}</div>
    <div class="art">${monSvg(m.id)}</div>
    <div class="nm">${def.name}</div>${extra}</div>`;
}

function detail(m, ctx) {
  const def = MON[m.id], T = TYPES[def.type];
  const lvl = m.lvl || 1;
  let btns = '', note = '';
  if (ctx.zone === 'shop') {
    const price = R.offerPrice(run, def);
    const copies = R.owned(run).filter(o => o.m.id === m.id && o.m.lvl === 1).length;
    if (copies >= 2) note = `<div class="note good">You own 2 copies: buying this merges them into level 2!</div>`;
    else if (copies === 1) note = `<div class="note">You own 1 copy. Get 3 to merge into level 2.</div>`;
    btns = `<button class="primary" data-act="buy" ${run.gold < price ? 'disabled' : ''}>Buy 💰${price}</button>
      <button data-act="lock">${ctx.locked ? '🔓 Unlock' : '🔒 Lock for next day'}</button>`;
  } else if (ctx.zone === 'team' || ctx.zone === 'bench') {
    btns = `<button data-act="sell">Sell +💰${R.sellValue(run, m)}</button>
      <button data-act="${ctx.zone === 'team' ? 'tobench' : 'toteam'}">${ctx.zone === 'team' ? 'To bench' : 'To team'}</button>`;
    if (lvl < 3) note = `<div class="note dim">${lvl === 1 ? 'Merge 3 copies → level 2.' : 'Merge with another level 2 → level 3.'}</div>`;
  }
  return `<div class="detail" style="--tc:${T.color}">
    <div class="d-head"><div class="d-art">${monSvg(m.id)}</div>
      <div><div class="d-name">${def.name} <span class="lvtxt">${ctx.zone === 'dex' ? '' : 'Lv' + lvl}</span></div>
      <div class="sub"><span class="typechip" style="background:${T.color}">${T.icon} ${T.name}</span> Tier ${def.tier} · ⏱ every ${def.cd}s
      ${ctx.zone !== 'dex' ? ` · <span class="${rollCls(m.atk)}">ATK ${Math.round(m.atk * 100)}%</span> · <span class="${rollCls(m.pow)}">POW ${Math.round(m.pow * 100)}%</span>` : ''}</div></div></div>
    <div class="chips">${moveChips(def, lvl, m.atk || 1, m.pow || 1)}</div>
    <div class="flavor">${esc(def.flavor)}</div>${note}
    ${btns ? `<div class="btns">${btns}</div>` : ''}</div>`;
}

function topbar() {
  const rk = D.RANKS[rankOf(prof.rp)];
  return `<header class="topbar">
    <div class="tb-l"><span class="day">Day ${run.day}</span>${run.mode === 'ranked' ? `<span class="mode" style="color:${rk.color}">${rk.icon} Ranked</span>` : '<span class="mode">Normal</span>'}</div>
    <div class="tb-r"><span title="Gold">💰${run.gold}</span><span title="Lives">❤️${run.lives}</span><span title="Wins">🏆${run.wins}/${RULES.winsToChampion}</span>
    <button class="icon" data-act="menu">☰</button></div></header>
    <div class="subbar"><span>${run.avatar ? D.AVATAR[run.avatar].face + ' ' + D.AVATAR[run.avatar].name : ''}</span>
    <span>⚡ Power ${R.runPower(run)}</span><span>❤️ HP ${R.maxHpFor(run.day, run.hpBonus, run.avatar, run.trinkets)}</span></div>
    <div class="typesbar">${run.types.map(t => `<span class="typechip sm" style="background:${TYPES[t].color}">${TYPES[t].icon} ${TYPES[t].name}</span>`).join('')}
    ${run.trinkets.map(t => `<span class="trk" data-act="trinket" data-id="${t}">${D.TRINKET[t].icon}</span>`).join('')}</div>`;
}

function teamRows(opts = {}) {
  const tgt = opts.target;
  const isSel = (z, i) => ui.sel && ui.sel.zone === z && ui.sel.i === i;
  const tOk = (m) => tgt && m && (!tgt.targetLvl1 || m.lvl === 1);
  return `<h3>Team <span class="dim">· acts in slot order, left first</span></h3>
    <div class="row6">${run.team.map((m, i) => card(m, { zone: 'team', i, sel: isSel('team', i), label: i + 1, target: tOk(m) })).join('')}</div>
    <h3>Bench <span class="dim">· doesn't fight</span></h3>
    <div class="row6 bench">${run.bench.map((m, i) => card(m, { zone: 'bench', i, sel: isSel('bench', i), target: tOk(m) })).join('')}</div>`;
}

// ---------------------------------------------------------------- screens
function render() {
  if (ui.battle) return; // battle owns the screen
  if (ui.screen === 'dex') return renderDex();
  if (ui.screen === 'title' || !run) return renderTitle();
  if (run.phase === 'over') return renderOver();
  if (run.phase === 'event') return renderEvent();
  return renderShop();
}

function renderTitle() {
  const ri = rankOf(prof.rp), rk = D.RANKS[ri];
  const into = prof.rp - ri * D.RANK_STEP;
  const canContinue = run && run.phase !== 'over';
  const seenNew = prof.seen === D.VERSION;
  $app.innerHTML = `<div class="title">
    <div class="logo">POCKET<span>O</span>MON</div>
    <div class="tag">Buy mons. Merge mons. 30 second showdowns.</div>
    <div class="parade">${['emberpup', 'puddlefin', 'sproutle', 'zapling', 'boolet', 'trashling'].map(id => `<div>${monSvg(id)}</div>`).join('')}</div>
    <div class="rankbox" style="--rc:${rk.color}">
      <div class="rk-name">${rk.icon} ${rk.name}${ri === D.RANKS.length - 1 ? ` · ${prof.rp} RP` : ''}</div>
      ${ri < D.RANKS.length - 1 ? `<div class="bar"><div style="width:${into}%"></div></div><div class="sub">${into}/100 RP to ${D.RANKS[ri + 1].name}</div>` : '<div class="sub">Top rank!</div>'}
      <div class="sub">Runs ${prof.runs} · Champion ${prof.champs}× · Best ${prof.bestWins} wins</div>
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
  $app.innerHTML = `${topbar()}<main class="scroll">
    <div class="event"><h2>${ev.avatar ? '👋 ' : '🗺️ '}${esc(ev.title)}</h2>
    ${pend ? `<div class="note big">Tap a mon for <b>${esc(pend.title)}</b> <button class="small" data-act="cancelpick">Cancel</button></div>` : '<div class="sub">Pick one.</div>'}
    <div class="choices">${ev.choices.map((c, i) => {
      const blocked = R.choiceBlocked(run, c);
      return `<button class="choice ${ui.pending === i ? 'sel' : ''}" data-act="choose" data-i="${i}" ${blocked ? 'disabled' : ''}>
        <div class="c-ic">${c.icon}</div><div class="c-t">${esc(c.title)}</div><div class="c-d">${esc(c.desc)}</div>
        ${c.id && MON[c.id] && c.kind === 'wild' ? `<div class="c-mon">${monSvg(c.id)}</div>` : ''}
        ${blocked ? `<div class="c-x">${blocked}</div>` : ''}</button>`;
    }).join('')}</div></div>
    ${run.avatar ? teamRows({ target: pend && pend.needsTarget ? pend : null }) : `<div class="sub center">Your shop today: ${run.types.map(t => TYPES[t].icon).join(' ')} types. Trainer perks last the whole run.</div>`}
  </main>`;
}

function renderShop() {
  const sel = ui.sel;
  let selM = null, ctx = null;
  if (sel) {
    if (sel.zone === 'shop') { const o = run.shop[sel.i]; if (o && o.mon) { selM = o.mon; ctx = { zone: 'shop', locked: o.locked }; } }
    else { selM = (sel.zone === 'team' ? run.team : run.bench)[sel.i]; if (selM) ctx = { zone: sel.zone }; }
    if (!selM && sel.zone === 'shop') ui.sel = null;
  }
  const rc = R.rerollCostNow(run);
  const freeR = run.freeRerolls + run.rerollBank;
  $app.innerHTML = `${topbar()}<main class="scroll">
    ${teamRows()}
    <h3>Shop <span class="dim">· tiers up to ${D.maxTier(run.day)}${run.sale ? ' · <b class="good">SALE −1</b>' : ''}</span></h3>
    <div class="row6 shop">${run.shop.map((o, i) => o.mon ? card(o.mon, {
      zone: 'shop', i, price: R.offerPrice(run, MON[o.mon.id]), locked: o.locked, sel: sel && sel.zone === 'shop' && sel.i === i,
      own: (() => { const n = R.owned(run).filter(x => x.m.id === o.mon.id && x.m.lvl === 1).length; return n ? (n >= 2 ? '⤴ merge' : `own ${n}`) : ''; })(),
    }) : `<div class="card sold">sold</div>`).join('')}</div>
    <div class="hint">${selM ? '' : 'Tap a mon to see it. Tap a shop mon then a slot to buy there; tap two of yours to swap.'}</div>
    ${selM ? detail(selM, ctx) : ''}
  </main>
  <footer class="actionbar">
    <button data-act="reroll" ${run.gold < rc ? 'disabled' : ''}>🎲 Reroll ${rc ? '💰' + rc : `free (${freeR})`}</button>
    <button class="primary" data-act="battle">⚔️ Battle!</button>
  </footer>`;
}

function renderOver() {
  const champ = run.result === 'champion';
  $app.innerHTML = `<main class="scroll over">
    <div class="bigicon">${champ ? '🏆' : '🥀'}</div>
    <h2 class="center">${champ ? 'Champion!' : 'Run over'}</h2>
    <div class="center sub">${run.mode === 'ranked' ? 'Ranked' : 'Normal'} run · ${run.wins} wins · ${run.losses} losses · reached day ${run.day}</div>
    ${run.rpRun !== undefined ? `<div class="center big">${run.rpRun >= 0 ? '+' : ''}${run.rpRun} RP this run → ${D.RANKS[rankOf(prof.rp)].icon} ${D.RANKS[rankOf(prof.rp)].name} (${prof.rp} RP)</div>` : ''}
    <h3>Final team</h3><div class="row6">${run.team.map((m, i) => card(m, { zone: 'final', i })).join('')}</div>
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
function modal(html) { $modal.innerHTML = `<div class="m-box">${html}<div class="btns"><button class="primary" data-act="closemodal">OK</button></div></div>`; $modal.classList.remove('hidden'); }
function closeModal() { $modal.classList.add('hidden'); $modal.innerHTML = ''; }

function helpHtml() {
  return `<h2>How to play</h2>
  <p>Each <b>day</b>: pick 1 of 3 <b>event</b> choices, shop for mons, then fight <b>one 30 second battle</b> against another trainer's snapshot from the same day. Win 10 battles to become Champion; lose 5 lives and the run ends.</p>
  <p><b>Battles</b> are automatic. Every mon casts its move each time its cooldown fills, in slot order (slot 1 first). All mons hit the enemy team's <b>shared HP bar</b>. After 30s, <b>sudden death</b> drains both teams faster every second. Ties go to you.</p>
  <p><b>Shop</b>: up to 6 mons on your team, extras wait on the bench. Each shop copy has its own ATK and POW roll. Buy <b>3 copies</b> of a mon to merge it into <b>level 2</b>, and two level 2s into <b>level 3</b>. Merging keeps the best ATK and POW of the copies. Tier never changes. Lock offers you want to keep for tomorrow; unspent gold carries over.</p>
  <p><b>Each run uses 5 random types</b> in the shop, so copies show up often enough to merge.</p>
  <p><b>Ranked</b>: opponents are picked close to your team's ⚡ power (a bit above it at higher ranks). Wins +${D.RP.win} RP, losses ${D.RP.loss} RP, champion +${D.RP.champion}. Ranks: ${D.RANKS.map(r => r.icon + ' ' + r.name).join(' → ')}.</p>
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
    <h3>Trinkets</h3>${run.trinkets.length ? run.trinkets.map(t => `<p>${D.TRINKET[t].icon} <b>${D.TRINKET[t].name}</b>: ${D.TRINKET[t].desc}</p>`).join('') : '<p class="dim">None yet.</p>'}
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
  if (run.phase === 'event') {
    if (ui.pending === null) return;
    const m = (zone === 'team' ? run.team : run.bench)[i];
    if (!m) return;
    const res = R.chooseEvent(run, ui.pending, { zone, i });
    if (!res.ok) return toast(res.msg);
    ui.pending = null; saveRun(); toast(res.msg); return render();
  }
  const sel = ui.sel;
  const slotM = zone === 'shop' ? (run.shop[i] && run.shop[i].mon) : (zone === 'team' ? run.team : run.bench)[i];
  if (!sel) { if (slotM) ui.sel = { zone, i }; return render(); }
  if (sel.zone === zone && sel.i === i) { ui.sel = null; return render(); }
  if (sel.zone === 'shop' && zone !== 'shop') {
    const res = R.buy(run, sel.i, { zone, i });
    toast(res.msg); if (res.ok) { ui.sel = res.at || null; saveRun(); }
    return render();
  }
  if (sel.zone !== 'shop' && zone !== 'shop') { R.move(run, sel, { zone, i }); ui.sel = null; saveRun(); return render(); }
  ui.sel = slotM ? { zone, i } : null; render();
}

const actions = {
  continue() { ui.screen = 'run'; render(); },
  new(el) {
    const mode = el.dataset.mode;
    if (run && run.phase !== 'over') {
      modal(`<h2>Start over?</h2><p>Your current ${run.mode} run (day ${run.day}, ${run.wins} wins) will be lost.</p><button class="danger" data-act="confirmnew" data-mode="${mode}">Yes, start a new ${mode} run</button>`);
      return;
    }
    startRun(mode);
  },
  confirmnew(el) { if (run && run.mode === 'ranked' && run.phase !== 'over') { /* abandoning ranked counts as finished */ } startRun(el.dataset.mode); },
  title() { closeModal(); ui.screen = 'title'; ui.sel = null; render(); },
  dex() { closeModal(); ui.screen = 'dex'; render(); },
  dextype(el) { ui.dexType = el.dataset.t; ui.dexSel = null; render(); },
  help() { modal(helpHtml()); },
  news() { prof.seen = D.VERSION; saveProf(); modal(newsHtml()); },
  menu() { modal(menuHtml()); },
  closemodal() { closeModal(); if (ui.screen === 'title') render(); },
  trinket(el) { const t = D.TRINKET[el.dataset.id]; toast(`${t.icon} ${t.name}: ${t.desc}`); },
  abandon() { modal(`<h2>Abandon run?</h2><p>This ends the run now.</p><button class="danger" data-act="confirmabandon">Abandon</button>`); },
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
    startBattle();
  },
  speed(el) { prof.speed = Number(el.dataset.s); saveProf(); if (ui.battle) { ui.battle.speed = prof.speed; markSpeed(); } },
  skip() { if (ui.battle) skipBattle(); },
  afterbattle() { ui.battle = null; ui.sel = null; render(); },
};

function finishRunStats() {
  prof.runs++; if (run.result === 'champion') prof.champs++;
  prof.bestWins = Math.max(prof.bestWins, run.wins);
  saveProf();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) { e.preventDefault(); const fn = actions[a.dataset.act]; if (fn) fn(a); return; }
  const c = e.target.closest('.card[data-z]');
  if (c && c.closest('#app')) { const z = c.dataset.z; tapSlot(z, z === 'dex' ? c.dataset.i : Number(c.dataset.i)); return; }
  if (e.target === $modal) closeModal();
});

// ---------------------------------------------------------------- battle
function startBattle() {
  const opp = R.pickOpponent(run, LIBRARY, rankOf(prof.rp));
  const me = R.snapshot(run, 'You');
  const res = simulate(R.battleTeamFromSnap(me), R.battleTeamFromSnap(opp), { log: true });
  const won = res.winner === 0;
  const daysBefore = run.day;
  const sum = R.finishBattle(run, won, opp);
  sum.rp = 0;
  if (run.mode === 'ranked') {
    sum.rp = won ? D.RP.win : D.RP.loss;
    if (run.phase === 'over' && run.result === 'champion') sum.rp += D.RP.champion;
    const before = prof.rp;
    prof.rp = Math.max(0, prof.rp + sum.rp);
    sum.rp = prof.rp - before; sum.rankBefore = rankOf(before); sum.rankAfter = rankOf(prof.rp);
    prof.peakRp = Math.max(prof.peakRp, prof.rp);
    run.rpRun = (run.rpRun || 0) + sum.rp;
  }
  if (run.phase === 'over') finishRunStats();
  saveRun(); saveProf();
  ui.battle = { opp, me, res, sum, day: daysBefore, pt: 0, fi: 0, speed: prof.speed, done: false, last: 0, live: 0 };
  buildBattle();
  requestAnimationFrame(stepBattle);
}

function bSide(snap, side, title) {
  const isOpp = side === 1;
  const av = snap.avatar ? D.AVATAR[snap.avatar] : null;
  const head = `<div class="b-head">${av ? av.face : '🙂'} <b>${esc(title)}</b> <span class="dim">${isOpp ? `${snap.wins}W-${snap.losses}L · ` : ''}⚡${snap.power}</span>
    ${snap.trinkets.map(t => D.TRINKET[t].icon).join('')}</div>`;
  const hp = `<div class="hpwrap" id="hp${side}"><div class="hpbar"><div class="hpfill"></div><div class="shfill"></div></div><div class="hptxt"></div></div>`;
  const chips = `<div class="schips" id="sc${side}"></div>`;
  const mons = `<div class="brow">${snap.team.map((m, i) => m ? `<div class="bmon t-${MON[m.id].type}" id="bm${side}${i}" style="--tc:${TYPES[MON[m.id].type].color}">
      <span class="slot">${i + 1}</span><div class="art">${monSvg(m.id)}</div><div class="blv">${stars(m.lvl)}</div><div class="cd"><div></div></div></div>` : `<div class="bmon none"></div>`).join('')}</div>`;
  return `<div class="bside ${isOpp ? 'opp' : 'me'}">${isOpp ? head + hp + chips + mons : mons + chips + hp + head}</div>`;
}

function buildBattle() {
  const b = ui.battle;
  $app.innerHTML = `<div class="battle" id="battle">
    <div class="b-top"><span>Day ${b.day} ${run.mode === 'ranked' ? '· Ranked' : ''}</span><span class="dim">vs a day-${b.day} snapshot</span></div>
    ${bSide(b.opp, 1, b.opp.name)}
    <div class="b-mid"><div class="timer" id="timer">30.0</div><div class="banner" id="banner"></div></div>
    ${bSide(b.me, 0, 'You')}
    <div class="b-ctl">${[1, 2, 4].map(s => `<button class="spd" data-act="speed" data-s="${s}">${s}×</button>`).join('')}<button data-act="skip">Skip ⏭</button></div>
    <div id="fxlayer"></div><div id="bresult" class="hidden"></div></div>`;
  markSpeed();
  applyState(b.res.log[0]);
  handleEvents(b.res.log[0].ev);
}
function markSpeed() { document.querySelectorAll('.spd').forEach(x => x.classList.toggle('sel', Number(x.dataset.s) === ui.battle.speed)); }

function stepBattle(ts) {
  const b = ui.battle;
  if (!b || b.done) return;
  if (!b.last) b.last = ts;
  b.pt += Math.min(0.1, (ts - b.last) / 1000) * b.speed;
  b.last = ts;
  const log = b.res.log;
  let lastF = null;
  while (b.fi < log.length && log[b.fi].t <= b.pt) { lastF = log[b.fi]; handleEvents(lastF.ev); b.fi++; }
  if (lastF) applyState(lastF);
  if (b.fi >= log.length) { b.done = true; setTimeout(showResult, 700); return; }
  requestAnimationFrame(stepBattle);
}

function skipBattle() {
  const b = ui.battle; if (b.done) return;
  b.done = true;
  const log = b.res.log;
  applyState(log[log.length - 1]);
  for (const f of log) for (const e of f.ev) if (e.k === 'sudden') { banner('SUDDEN DEATH'); break; }
  showResult();
}

const $ = (id) => document.getElementById(id);
function applyState(f) {
  const b = ui.battle;
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
    } else if (e.k === 'dmg') { dmg[e.s][e.kind] = (dmg[e.s][e.kind] || 0) + e.v; }
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
  const won = b.res.winner === 0, s = b.sum;
  const tie = b.res.hp[0] <= 0 && b.res.hp[1] <= 0;
  const over = run.phase === 'over';
  const rkLine = run.mode === 'ranked' ? `<div class="rp ${s.rp >= 0 ? 'good' : 'bad'}">${s.rp >= 0 ? '+' : ''}${s.rp} RP · ${D.RANKS[s.rankAfter].icon} ${D.RANKS[s.rankAfter].name} ${s.rankAfter > s.rankBefore ? '<b>RANK UP!</b>' : s.rankAfter < s.rankBefore ? '(rank down)' : ''}</div>` : '';
  const el = $('bresult');
  el.innerHTML = `<div class="r-box ${won ? 'win' : 'lose'}"><div class="r-t">${won ? (tie ? 'Tie — you win!' : 'Victory!') : 'Defeat'}</div>
    <div class="sub">${b.res.t.toFixed(1)}s · your HP ${Math.ceil(b.res.hp[0])}/${b.res.maxHp[0]} · theirs ${Math.ceil(b.res.hp[1])}/${b.res.maxHp[1]}</div>
    ${rkLine}
    ${s.salvage ? `<div>🪙 Salvage +${s.salvage} gold</div>` : ''}${s.egg ? `<div>🥚 Golden Egg +${s.egg} gold</div>` : ''}
    <div class="sub">🏆 ${run.wins}/${RULES.winsToChampion} · ❤️ ${run.lives}</div>
    <button class="primary big" data-act="afterbattle">${over ? (run.result === 'champion' ? 'Claim the title 🏆' : 'See run summary') : `Day ${run.day} →`}</button></div>`;
  el.classList.remove('hidden');
}

// first visit: show help once
render();
if (!prof.runs && !load('pocketomon.helpseen')) { store('pocketomon.helpseen', 1); modal(helpHtml()); }
