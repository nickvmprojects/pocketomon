// Pocketomon run logic: days, events, shop, merging, snapshots. Pure state functions
// (the UI and the bot simulator both use them). Randomness comes from run.rs (saved).
import {
  RULES, MON, MONS, TYPE_KEYS, AVATARS, AVATAR, TRINKETS, TRINKET, isBattleTrinket, trinketBonus, TRIGGERS,
  teamHp, income, price, sellPerCopy, tierWeights, maxTier, TIER_POWER, LV_POWER, fxValue,
} from './data.js?v=0.3';
import { makeRng, hash } from './rng.js?v=0.3';
import { rateTeam } from './battle.js?v=0.3';

export function rngOf(run) { const r = makeRng(run.rs); return r; }
function save(run, r) { run.rs = r.state(); }

export const bonusOf = (run) => trinketBonus(run.trinkets);
export const benchSize = (run) => RULES.benchSlots + (bonusOf(run).bench || 0);
export const shopSize = (run) => RULES.shopSlots + (run.avatar === 'scholar' ? 1 : 0) + (bonusOf(run).offers || 0);
export const offerPrice = (run, def) => Math.max(1, price(def) - (run.sale ? 5 : 0));

export function newRun(mode, seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) {
  const r = makeRng(seed);
  const run = {
    v: 2, mode, seed, rs: 0, day: 1, gold: 0, lives: RULES.startLives, wins: 0, losses: 0,
    avatar: null, trinkets: [], types: r.shuffle(TYPE_KEYS).slice(0, RULES.typesPerRun),
    team: Array(RULES.teamSlots).fill(null), bench: Array(RULES.benchSlots).fill(null), shop: [],
    freeRerolls: 0, rerollBank: 0, hpBonus: 0, sale: false, uid: 1, trinketQueue: [],
    phase: 'event', event: null, history: [], log: [],
  };
  run.rs = r.state();
  startDay(run);
  return run;
}

export function rollInst(run, id, r) {
  return { uid: run.uid++, id, lvl: 1, atk: 0.85 + 0.05 * r.int(7), pow: 0.85 + 0.05 * r.int(7), copies: 1 };
}

export function owned(run) {
  const out = [];
  run.team.forEach((m, i) => m && out.push({ zone: 'team', i, m }));
  run.bench.forEach((m, i) => m && out.push({ zone: 'bench', i, m }));
  return out;
}

// ---------------- day flow ----------------
export function startDay(run) {
  const r = rngOf(run);
  run.sale = false;
  let g = income(run.day);
  const b = bonusOf(run);
  if (run.avatar === 'merchant') g += 8;
  g += b.goldDay || 0;
  run.gold += g;
  run.freeRerolls = (run.avatar === 'gambler' ? 1 : 0) + (b.rerolls || 0);
  while (run.bench.length < benchSize(run)) run.bench.push(null);
  rollShop(run, r, true);
  run.event = makeEvent(run, r);
  run.phase = 'event';
  save(run, r);
}

export function rollShop(run, r, keepLocked) {
  const n = shopSize(run);
  const old = run.shop || [];
  const next = [];
  for (let i = 0; i < n; i++) {
    if (keepLocked && old[i] && old[i].locked && old[i].mon) { next.push(old[i]); continue; }
    next.push({ mon: rollInst(run, drawMonId(run, r), r), locked: false });
  }
  run.shop = next;
}

function drawMonId(run, r) {
  const mt = maxTier(run.day);
  const bias = RULES.copyBias + (bonusOf(run).copy || 0) / 100;
  if (r() < bias) {
    const mine = owned(run).filter(o => o.m.lvl < 3 && MON[o.m.id].tier <= mt);
    if (mine.length) return r.pick(mine).m.id;
  }
  const tier = 1 + r.weighted(tierWeights(run.day));
  const pool = MONS.filter(x => x.tier === tier && run.types.includes(x.type));
  return r.pick(pool).id;
}

// ---------------- events ----------------
const EVENT_KINDS = [
  { kind: 'gold', w: 3 }, { kind: 'wild', w: 3 }, { kind: 'egg', w: 1.5 }, { kind: 'train', w: 2 },
  { kind: 'meditate', w: 2 }, { kind: 'trinket', w: 2.2 }, { kind: 'hp', w: 1.2 }, { kind: 'rerolls', w: 1.5 },
  { kind: 'sale', w: 1.5 }, { kind: 'clone', w: 1.2 }, { kind: 'gamble', w: 1 }, { kind: 'revive', w: 1 },
];

export function makeEvent(run, r) {
  if (!run.avatar) {
    const picks = r.shuffle(AVATARS).slice(0, 3);
    return { title: 'Choose your trainer', avatar: true, choices: picks.map(a => ({ kind: 'avatar', id: a.id, icon: a.face, title: a.name, desc: a.perk })) };
  }
  const kinds = EVENT_KINDS.filter(k => eventAllowed(run, k.kind));
  const chosen = [];
  while (chosen.length < 3 && kinds.length) {
    const i = r.weighted(kinds.map(k => k.w));
    chosen.push(kinds[i].kind); kinds.splice(i, 1);
  }
  const title = r.pick(['A fork in the trail', 'Something rustles in the grass', 'A traveling merchant waves', 'Morning at the camp', 'A strange signpost', 'Rumors at the poké-pub']);
  return { title, choices: chosen.map(k => buildChoice(run, k, r)) };
}

function eventAllowed(run, kind) {
  const mt = maxTier(run.day);
  switch (kind) {
    case 'egg': return mt < 5;
    case 'trinket': return trinketPool(run, maxTier(run.day)).length > 0;
    case 'clone': return run.day >= 3;
    case 'revive': return run.lives < RULES.startLives;
    case 'hp': return run.day >= 2;
    default: return true;
  }
}

function buildChoice(run, kind, r) {
  const mt = maxTier(run.day);
  const pickMon = (tier) => r.pick(MONS.filter(x => x.tier === tier && run.types.includes(x.type))).id;
  switch (kind) {
    case 'gold': { const g = 10 + 3 * run.day; return { kind, icon: '💰', title: `Found ${g} gold`, desc: `A pouch of coins on the trail. +${g} gold now.`, g }; }
    case 'wild': { const tier = Math.max(1, mt - r.int(2)); const id = pickMon(tier); return { kind, icon: '🌾', title: `Wild ${MON[id].name}`, desc: `A tier ${tier} ${MON[id].name} wants to join (free).`, id, needsRoom: true }; }
    case 'egg': { const id = pickMon(mt + 1); return { kind, icon: '🥚', title: 'Mystery egg', desc: `Hatches right away into a random tier ${mt + 1} mon (above the shop!).`, id, needsRoom: true }; }
    case 'train': return { kind, icon: '🏋️', title: 'Training camp', desc: 'Pick a mon: +20% ATK, permanently.', needsTarget: true };
    case 'meditate': return { kind, icon: '🧘', title: 'Meditation retreat', desc: 'Pick a mon: +20% POW (effect power), permanently.', needsTarget: true };
    case 'trinket': { const t = r.pick(trinketPool(run, mt)); return { kind, icon: t.icon, title: t.name, desc: `Tier ${t.tier} trinket: ${t.desc}`, id: t.id }; }
    case 'hp': return { kind, icon: '❤️‍🩹', title: 'Hot springs', desc: 'Team HP +10% for the rest of the run.' };
    case 'rerolls': return { kind, icon: '🎲', title: 'Bag of dice', desc: '+4 free rerolls (kept until used).' };
    case 'sale': return { kind, icon: '🏷️', title: 'Shop sale', desc: 'Every mon costs 5 gold less today.' };
    case 'clone': return { kind, icon: '🧪', title: 'Cloning vat', desc: 'Pick a level 1 mon: get an identical copy (merges count!).', needsTarget: true, targetLvl1: true };
    case 'gamble': return { kind, icon: '🪙', title: 'Coin flip', desc: 'Heads: +30 gold. Tails: lose 10 gold.' };
    case 'revive': return { kind, icon: '💖', title: 'Lucky charm', desc: 'Regain 1 life.' };
  }
  return { kind: 'gold', icon: '💰', title: '2 gold', desc: '+2 gold', g: 2 };
}

// Can this owned mon be the target of event choice c?
export function validTarget(run, c, m) {
  if (!m) return false;
  if (c.targetLvl1 && m.lvl !== 1) return false;
  if (c.kind === 'clone' && !run.team.includes(null) && !run.bench.includes(null))
    return owned(run).filter(x => x.m.id === m.id && x.m.lvl === 1).length >= 2;
  return true;
}

export function choiceBlocked(run, c) {
  if (c.needsTarget) {
    const mine = owned(run).filter(o => !c.targetLvl1 || o.m.lvl === 1);
    if (!mine.length) return c.targetLvl1 ? 'Needs a level 1 mon' : 'Needs a mon';
    if (c.kind === 'clone' && !hasRoomFor(run, null)) {
      // clone can still merge if 2 copies exist
      if (!mine.some(o => owned(run).filter(x => x.m.id === o.m.id && x.m.lvl === 1).length >= 2)) return 'No room';
    }
  }
  if (c.needsRoom && !hasRoomFor(run, c.id)) return 'No room';
  return null;
}

export function chooseEvent(run, idx, target) {
  const c = run.event.choices[idx];
  if (!c) return { ok: false, msg: 'No choice' };
  const blocked = choiceBlocked(run, c);
  if (blocked) return { ok: false, msg: blocked };
  const r = rngOf(run);
  let msg = '';
  switch (c.kind) {
    case 'avatar': {
      run.avatar = c.id;
      if (c.id === 'mystic') { const t = r.pick(trinketPool(run, 2)); run.trinkets.push(t.id); fireAll(run, 'trinket'); msg = `Oona found a ${t.name}!`; while (run.bench.length < benchSize(run)) run.bench.push(null); }
      if (c.id === 'junkyard' && !run.types.includes('junk')) run.types[r.int(run.types.length)] = 'junk';
      if (c.id === 'tamer') for (let k = 0; k < 2; k++) addMon(run, rollInst(run, r.pick(MONS.filter(x => x.tier === 1 && run.types.includes(x.type))).id, r));
      if (c.id === 'scholar' || c.id === 'junkyard') rollShop(run, r, true);
      break;
    }
    case 'gold': run.gold += c.g; msg = `+${c.g} gold`; break;
    case 'wild': case 'egg': { const inst = rollInst(run, c.id, r); const res = addMon(run, inst); msg = `${MON[c.id].name} joined!${res.merged ? ' It merged!' : ''}`; break; }
    case 'train': case 'meditate': case 'clone': {
      const o = target && (target.zone === 'team' ? run.team : run.bench)[target.i];
      if (!o) return { ok: false, msg: 'Pick a mon', needsTarget: true };
      if (c.kind === 'train') { o.atk = +(o.atk + 0.2).toFixed(2); msg = `${MON[o.id].name} ATK +20%`; }
      if (c.kind === 'meditate') { o.pow = +(o.pow + 0.2).toFixed(2); msg = `${MON[o.id].name} POW +20%`; }
      if (c.kind === 'clone') {
        if (o.lvl !== 1) return { ok: false, msg: 'Level 1 only' };
        const copy = { ...o, uid: run.uid++ };
        const res = addMon(run, copy);
        if (!res.ok) return { ok: false, msg: res.msg };
        msg = `Cloned ${MON[o.id].name}!${res.merged ? ' Merged!' : ''}`;
      }
      break;
    }
    case 'trinket': run.trinkets.push(c.id); fireAll(run, 'trinket'); while (run.bench.length < benchSize(run)) run.bench.push(null); msg = `Got ${TRINKET[c.id].name}`; break;
    case 'hp': run.hpBonus = +(run.hpBonus + 0.1).toFixed(2); msg = 'Team HP +10%'; break;
    case 'rerolls': run.rerollBank += 4; msg = '+4 free rerolls'; break;
    case 'sale': run.sale = true; msg = 'Sale today!'; break;
    case 'gamble': if (r() < 0.5) { run.gold += 30; msg = 'Heads! +30 gold'; } else { run.gold = Math.max(0, run.gold - 10); msg = 'Tails... -10 gold'; } break;
    case 'revive': run.lives = Math.min(RULES.startLives, run.lives + 1); msg = '+1 life'; break;
  }
  save(run, r);
  run.event = null;
  run.phase = 'shop';
  return { ok: true, msg };
}

// ---------------- team / merging ----------------
function slotsOf(run, zone) { return zone === 'team' ? run.team : run.bench; }

export function hasRoomFor(run, id) {
  if (run.team.includes(null) || run.bench.includes(null)) return true;
  if (!id) return false;
  return owned(run).filter(o => o.m.id === id && o.m.lvl === 1).length >= 2;
}

export function mergeInsts(run, list) {
  const lvl = list[0].lvl + 1;
  const m = {
    uid: run.uid++, id: list[0].id, lvl,
    atk: Math.max(...list.map(x => x.atk)), pow: Math.max(...list.map(x => x.pow)),
    copies: list.reduce((a, x) => a + (x.copies || 1), 0),
  };
  if (run.avatar === 'breeder') { m.atk = +(m.atk + 0.1).toFixed(2); m.pow = +(m.pow + 0.1).toFixed(2); }
  return m;
}

// Adds a mon (from shop or event). Auto-merges 3x L1 -> L2, 2x L2 -> L3.
export function addMon(run, inst, dest) {
  const same = owned(run).filter(o => o.m.id === inst.id && o.m.lvl === 1);
  if (inst.lvl === 1 && same.length >= 2) {
    const parts = same.slice(0, 2);
    const into = parts.find(p => p.zone === 'team') || parts[0];
    for (const p of parts) slotsOf(run, p.zone)[p.i] = null;
    let merged = mergeInsts(run, [parts[0].m, parts[1].m, inst]);
    slotsOf(run, into.zone)[into.i] = merged;
    queueTrinket(run, MON[inst.id].tier);
    fireShopTrigger(run, merged, 'levelUp', into);
    const lvl3 = checkL3(run, merged, into);
    return { ok: true, merged: lvl3 ? 3 : 2, at: lvl3 || into };
  }
  let spot = null;
  if (dest && (dest.zone === 'team' || dest.zone === 'bench') && !slotsOf(run, dest.zone)[dest.i]) spot = dest;
  if (!spot) { const i = run.team.indexOf(null); if (i >= 0) spot = { zone: 'team', i }; }
  if (!spot) { const i = run.bench.indexOf(null); if (i >= 0) spot = { zone: 'bench', i }; }
  if (!spot) return { ok: false, msg: 'No room on team or bench' };
  slotsOf(run, spot.zone)[spot.i] = inst;
  if (inst.lvl === 2) { const l3 = checkL3(run, inst, spot); if (l3) return { ok: true, merged: 3, at: l3 }; }
  return { ok: true, merged: 0, at: spot };
}

function checkL3(run, m, at) {
  const other = owned(run).find(o => o.m.id === m.id && o.m.lvl === 2 && o.m.uid !== m.uid);
  if (!other) return null;
  const here = owned(run).find(o => o.m.uid === m.uid);
  const into = here.zone === 'team' ? here : (other.zone === 'team' ? other : here);
  slotsOf(run, here.zone)[here.i] = null;
  slotsOf(run, other.zone)[other.i] = null;
  const l3 = mergeInsts(run, [m, other.m]);
  slotsOf(run, into.zone)[into.i] = l3;
  queueTrinket(run, MON[m.id].tier);
  fireShopTrigger(run, l3, 'levelUp', into);
  return into;
}

// ---------------- shop triggers (buy, sell, levelUp, trinket, allySold, reroll, win, loss)
const rnd3 = (x) => Math.round(x * 1000) / 1000;
function growMon(m, o, lvl) {
  if (!m) return;
  if (o.atk) m.atk = rnd3(m.atk + o.atk * lvl);
  if (o.pow) m.pow = rnd3(m.pow + o.pow * lvl);
}
// fire the trigger of mon m (at location loc, may be null if sold) for event on; returns a short message
export function fireShopTrigger(run, m, on, loc) {
  const t = TRIGGERS[m.id];
  if (!t || t.on !== on) return '';
  const d = t.do, lvl = m.lvl, name = MON[m.id].name;
  if (d.grow) { growMon(m, d.grow, lvl); return `${name} grew!`; }
  if (d.gold) { run.gold += d.gold * lvl; return `${name}: +${d.gold * lvl} gold`; }
  if (d.growAll) { for (const o of owned(run)) if (MON[o.m.id].type === d.growAll.type) growMon(o.m, d.growAll, lvl); return `${name} boosted your ${d.growAll.type} mons!`; }
  if (d.growRand) {
    const pool = owned(run).filter(o => MON[o.m.id].type === d.growRand.type && o.m !== m);
    if (!pool.length) return '';
    const r = rngOf(run); const o = r.pick(pool); save(run, r);
    growMon(o.m, d.growRand, lvl); return `${name} boosted ${MON[o.m.id].name}!`;
  }
  if (d.growFront) {
    let target = null;
    if (loc && loc.zone === 'team' && loc.i > 0) target = run.team.slice(0, loc.i).reverse().find(Boolean);
    if (!target) target = run.team.slice().reverse().find(x => x && x !== m);
    if (!target) return '';
    growMon(target, d.growFront, lvl); return `${name} boosted ${MON[target.id].name}!`;
  }
  return '';
}
export function fireAll(run, on, list) {
  const msgs = [];
  for (const o of (list || owned(run))) { const x = fireShopTrigger(run, o.m, on, o); if (x) msgs.push(x); }
  return msgs.join(' ');
}
const locOf = (run, m) => owned(run).find(o => o.m === m) || null;

// ---------------- merge rewards: pick 1 of 3 trinkets of the merged mon's tier ----------------
export function trinketPool(run, tier) {
  return TRINKETS.filter(t => t.tier === tier && !run.trinkets.includes(t.id) && (!t.id.startsWith('charm_') || run.types.includes(t.id.slice(6))));
}
function queueTrinket(run, tier) { (run.trinketQueue = run.trinketQueue || []).push({ tier, options: null }); }

// Fills in the options of the first queued reward (lazily, so it uses the run's saved RNG once).
export function currentTrinketChoice(run) {
  const q = run.trinketQueue && run.trinketQueue[0];
  if (!q) return null;
  if (!q.options) {
    const r = rngOf(run);
    let pool = r.shuffle(trinketPool(run, q.tier));
    for (const d of [-1, 1, -2, 2, -3, 3, -4, 4]) {
      if (pool.length >= 3) break;
      const t = q.tier + d;
      if (t >= 1 && t <= 5) pool = pool.concat(r.shuffle(trinketPool(run, t)).filter(x => !pool.includes(x)));
    }
    q.options = pool.slice(0, 3).map(t => t.id);
    save(run, r);
    if (!q.options.length) { run.trinketQueue.shift(); return currentTrinketChoice(run); }
  }
  return q;
}
export function chooseTrinket(run, id) {
  const q = currentTrinketChoice(run);
  if (!q || !q.options.includes(id)) return { ok: false, msg: 'Not an option' };
  run.trinkets.push(id);
  run.trinketQueue.shift();
  fireAll(run, 'trinket');
  while (run.bench.length < benchSize(run)) run.bench.push(null);
  return { ok: true, msg: `Got ${TRINKET[id].name}!` };
}

// ---------------- shop actions ----------------
export function buy(run, shopIdx, dest) {
  const offer = run.shop[shopIdx];
  if (!offer || !offer.mon) return { ok: false, msg: 'Nothing there' };
  const def = MON[offer.mon.id];
  const cost = offerPrice(run, def);
  if (run.gold < cost) return { ok: false, msg: `Need ${cost} gold` };
  const res = addMon(run, offer.mon, dest);
  if (!res.ok) return res;
  run.gold -= cost;
  run.shop[shopIdx] = { mon: null, locked: false };
  const at = res.at && slotsOf(run, res.at.zone)[res.at.i];
  const tmsg = at ? fireShopTrigger(run, at, 'buy', res.at) : '';
  return { ok: true, merged: res.merged, at: res.at, msg: (res.merged ? `${def.name} reached level ${res.merged}!` : `Bought ${def.name}`) + (tmsg ? ' ' + tmsg : '') };
}

export function sellValue(run, m) { return (sellPerCopy(MON[m.id]) + (run.avatar === 'junkyard' ? 3 : 0)) * (m.copies || 1); }

export function sell(run, zone, i) {
  const slots = slotsOf(run, zone);
  const m = slots[i];
  if (!m) return { ok: false, msg: 'Empty' };
  const v = sellValue(run, m);
  run.gold += v; slots[i] = null;
  const t1 = fireShopTrigger(run, m, 'sell', null);
  const t2 = fireAll(run, 'allySold');
  return { ok: true, msg: `Sold ${MON[m.id].name} for ${v}` + [t1, t2].filter(Boolean).map(x => ' ' + x).join('') };
}

export function move(run, from, to) {
  const a = slotsOf(run, from.zone), b = slotsOf(run, to.zone);
  const tmp = a[from.i]; a[from.i] = b[to.i]; b[to.i] = tmp;
  return { ok: true };
}

export function rerollCostNow(run) { return (run.freeRerolls > 0 || run.rerollBank > 0) ? 0 : RULES.rerollCost; }
export function reroll(run) {
  const c = rerollCostNow(run);
  if (run.gold < c) return { ok: false, msg: `Need ${c} gold` };
  if (run.freeRerolls > 0) run.freeRerolls--; else if (run.rerollBank > 0) run.rerollBank--; else run.gold -= c;
  const r = rngOf(run); rollShop(run, r, true); save(run, r);
  fireAll(run, 'reroll');
  return { ok: true };
}
export function toggleLock(run, i) { if (run.shop[i] && run.shop[i].mon) run.shop[i].locked = !run.shop[i].locked; }

// ---------------- battle prep ----------------
export function hpMult(hpBonus, avatar, trinkets) {
  return 1 + (hpBonus || 0) + (avatar === 'captain' ? 0.15 : 0) + (trinketBonus(trinkets).hp || 0) / 100;
}
export const maxHpFor = (day, hpBonus, avatar, trinkets) => Math.round(teamHp(day) * hpMult(hpBonus, avatar, trinkets));

// Shown "Power": the plain sum of a team's stat numbers (hit + every effect number, with level, rolls and buffs;
// cooldowns ignored). Fun to watch grow, deliberately NOT the real strength (that is the hidden rating).
export function monPower(m) {
  const def = MON[m.id];
  let p = fxValue('dmg', def.dmg, def, m.lvl, m.atk);
  for (const [k, v] of Object.entries(def.fx)) p += fxValue(k, v, def, m.lvl, m.pow);
  if (def.pas.start) for (const [k, v] of Object.entries(def.pas.start)) p += fxValue(k, v, def, m.lvl, m.pow);
  if (def.pas.regen) p += fxValue('regen', def.pas.regen, def, m.lvl, m.pow);
  return p;
}
export function teamPower(team) {
  let p = 0;
  for (const m of team) if (m) p += monPower(m);
  return Math.round(p);
}
export const runPower = (run) => teamPower(run.team);
export const runRating = (run) => rateTeam(battleTeamFromSnap({ day: run.day, hpBonus: run.hpBonus, avatar: run.avatar, trinkets: run.trinkets.filter(t => isBattleTrinket(t)), team: run.team })).rating;

export function snapshot(run, name) {
  const s = {
    name, day: run.day, wins: run.wins, losses: run.losses, avatar: run.avatar,
    trinkets: run.trinkets.filter(t => isBattleTrinket(t)), hpBonus: run.hpBonus,
    team: run.team.map(m => m ? { id: m.id, lvl: m.lvl, atk: m.atk, pow: m.pow } : null),
    power: runPower(run),
  };
  s.rating = rateTeam(battleTeamFromSnap(s)).rating; // hidden, used by ranked matchmaking
  return s;
}
export function battleTeamFromSnap(s) {
  return { mons: s.team, maxHp: maxHpFor(s.day, s.hpBonus, s.avatar, s.trinkets), trinkets: s.trinkets, avatar: s.avatar };
}

export function salvageGold(run) {
  let g = 0;
  for (const m of run.team) if (m && MON[m.id].pas.salvage) g += MON[m.id].pas.salvage * m.lvl;
  return g;
}

// Apply a battle result. Returns summary for the UI.
export function finishBattle(run, won, opp) {
  const sum = { won, day: run.day, gold: 0 };
  if (won) run.wins++; else { run.losses++; run.lives--; }
  sum.grew = fireAll(run, won ? 'win' : 'loss', run.team.map((m, i) => m && { zone: 'team', i, m }).filter(Boolean));
  sum.salvage = salvageGold(run);
  sum.egg = won ? (bonusOf(run).winGold || 0) : 0;
  run.gold += sum.salvage + sum.egg;
  run.history.push({ day: run.day, won, opp: opp ? opp.name : '?', oppPower: opp ? opp.power : 0, power: runPower(run) });
  if (run.wins >= RULES.winsToChampion) { run.phase = 'over'; run.result = 'champion'; }
  else if (run.lives <= 0) { run.phase = 'over'; run.result = 'out'; }
  else { run.day++; startDay(run); }
  return sum;
}

// ---------------- opponents ----------------
export function pickOpponent(run, library, rankIndex = 0) {
  const r = rngOf(run);
  const days = Object.keys(library).map(Number).sort((a, b) => a - b);
  let d = run.day;
  while (d > 1 && !(library[d] && library[d].length)) d--;
  const pool = library[d] || library[days[0]];
  let pick;
  if (run.mode === 'ranked') {
    // hidden rating (seconds survived / seconds to kill vs that day's dummies), a bit tougher per rank
    const target = runRating(run) * (1 + 0.03 * rankIndex);
    const sorted = pool.slice().sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
    pick = r.pick(sorted.slice(0, 5));
  } else pick = r.pick(pool);
  save(run, r);
  return { ...pick, day: run.day };
}

export const seedFor = (s) => hash(String(s));
