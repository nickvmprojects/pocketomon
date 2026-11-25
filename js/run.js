// Pocketomon run logic: days, events, shop, merging, snapshots. Pure state functions
// (the UI and the bot simulator both use them). Randomness comes from run.rs (saved).
import {
  RULES, MON, MONS, TYPE_KEYS, AVATARS, AVATAR, TRINKETS, TRINKET, BATTLE_TRINKETS,
  teamHp, income, price, sellPerCopy, tierWeights, maxTier, TIER_POWER, LV_POWER,
} from './data.js';
import { makeRng, hash } from './rng.js';

export function rngOf(run) { const r = makeRng(run.rs); return r; }
function save(run, r) { run.rs = r.state(); }

export const benchSize = (run) => RULES.benchSlots + (run.trinkets.includes('backpack') ? 2 : 0);
export const shopSize = (run) => RULES.shopSlots + (run.avatar === 'scholar' ? 1 : 0);
export const offerPrice = (run, def) => Math.max(1, price(def.tier) - (run.sale ? 1 : 0));

export function newRun(mode, seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) {
  const r = makeRng(seed);
  const run = {
    v: 1, mode, seed, rs: 0, day: 1, gold: 0, lives: RULES.startLives, wins: 0, losses: 0,
    avatar: null, trinkets: [], types: r.shuffle(TYPE_KEYS).slice(0, RULES.typesPerRun),
    team: Array(RULES.teamSlots).fill(null), bench: Array(RULES.benchSlots).fill(null), shop: [],
    freeRerolls: 0, rerollBank: 0, hpBonus: 0, sale: false, uid: 1,
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
  if (run.avatar === 'merchant') g += 2;
  if (run.trinkets.includes('fatwallet')) g += 2;
  run.gold += g;
  run.freeRerolls = (run.avatar === 'gambler' ? 1 : 0) + (run.trinkets.includes('dice') ? 1 : 0);
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
  const bias = RULES.copyBias + (run.trinkets.includes('luckycollar') ? 0.15 : 0);
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
    case 'trinket': return run.trinkets.length < TRINKETS.length;
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
    case 'gold': { const g = 3 + Math.floor(run.day / 2); return { kind, icon: '💰', title: `Found ${g} gold`, desc: `A pouch of coins on the trail. +${g} gold now.`, g }; }
    case 'wild': { const tier = Math.max(1, mt - r.int(2)); const id = pickMon(tier); return { kind, icon: '🌾', title: `Wild ${MON[id].name}`, desc: `A tier ${tier} ${MON[id].name} wants to join (free).`, id, needsRoom: true }; }
    case 'egg': { const id = pickMon(mt + 1); return { kind, icon: '🥚', title: 'Mystery egg', desc: `Hatches right away into a random tier ${mt + 1} mon (above the shop!).`, id, needsRoom: true }; }
    case 'train': return { kind, icon: '🏋️', title: 'Training camp', desc: 'Pick a mon: +20% ATK, permanently.', needsTarget: true };
    case 'meditate': return { kind, icon: '🧘', title: 'Meditation retreat', desc: 'Pick a mon: +20% POW (effect power), permanently.', needsTarget: true };
    case 'trinket': { const t = r.pick(TRINKETS.filter(x => !run.trinkets.includes(x.id))); return { kind, icon: t.icon, title: t.name, desc: `Trinket for this run: ${t.desc}`, id: t.id }; }
    case 'hp': return { kind, icon: '❤️‍🩹', title: 'Hot springs', desc: 'Team HP +10% for the rest of the run.' };
    case 'rerolls': return { kind, icon: '🎲', title: 'Bag of dice', desc: '+4 free rerolls (kept until used).' };
    case 'sale': return { kind, icon: '🏷️', title: 'Shop sale', desc: 'Every mon costs 1 gold less today.' };
    case 'clone': return { kind, icon: '🧪', title: 'Cloning vat', desc: 'Pick a level 1 mon: get an identical copy (merges count!).', needsTarget: true, targetLvl1: true };
    case 'gamble': return { kind, icon: '🪙', title: 'Coin flip', desc: 'Heads: +9 gold. Tails: lose 3 gold.' };
    case 'revive': return { kind, icon: '💖', title: 'Lucky charm', desc: 'Regain 1 life.' };
  }
  return { kind: 'gold', icon: '💰', title: '2 gold', desc: '+2 gold', g: 2 };
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
      if (c.id === 'mystic') { const t = r.pick(TRINKETS); run.trinkets.push(t.id); msg = `Oona found a ${t.name}!`; while (run.bench.length < benchSize(run)) run.bench.push(null); }
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
    case 'trinket': run.trinkets.push(c.id); while (run.bench.length < benchSize(run)) run.bench.push(null); msg = `Got ${TRINKET[c.id].name}`; break;
    case 'hp': run.hpBonus = +(run.hpBonus + 0.1).toFixed(2); msg = 'Team HP +10%'; break;
    case 'rerolls': run.rerollBank += 4; msg = '+4 free rerolls'; break;
    case 'sale': run.sale = true; msg = 'Sale today!'; break;
    case 'gamble': if (r() < 0.5) { run.gold += 9; msg = 'Heads! +9 gold'; } else { run.gold = Math.max(0, run.gold - 3); msg = 'Tails... -3 gold'; } break;
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
  slotsOf(run, into.zone)[into.i] = mergeInsts(run, [m, other.m]);
  return into;
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
  return { ok: true, merged: res.merged, at: res.at, msg: res.merged ? `${def.name} reached level ${res.merged}!` : `Bought ${def.name}` };
}

export function sellValue(run, m) { return sellPerCopy(MON[m.id].tier) * (m.copies || 1) + (run.avatar === 'junkyard' ? (m.copies || 1) : 0); }

export function sell(run, zone, i) {
  const slots = slotsOf(run, zone);
  const m = slots[i];
  if (!m) return { ok: false, msg: 'Empty' };
  const v = sellValue(run, m);
  run.gold += v; slots[i] = null;
  return { ok: true, msg: `Sold ${MON[m.id].name} for ${v}` };
}

export function move(run, from, to) {
  const a = slotsOf(run, from.zone), b = slotsOf(run, to.zone);
  const tmp = a[from.i]; a[from.i] = b[to.i]; b[to.i] = tmp;
  return { ok: true };
}

export function rerollCostNow(run) { return (run.freeRerolls > 0 || run.rerollBank > 0) ? 0 : RULES.rerollCost; }
export function reroll(run) {
  const c = rerollCostNow(run);
  if (run.gold < c) return { ok: false, msg: 'Need 1 gold' };
  if (run.freeRerolls > 0) run.freeRerolls--; else if (run.rerollBank > 0) run.rerollBank--; else run.gold -= c;
  const r = rngOf(run); rollShop(run, r, true); save(run, r);
  return { ok: true };
}
export function toggleLock(run, i) { if (run.shop[i] && run.shop[i].mon) run.shop[i].locked = !run.shop[i].locked; }

// ---------------- battle prep ----------------
export function hpMult(hpBonus, avatar, trinkets) {
  return 1 + (hpBonus || 0) + (avatar === 'captain' ? 0.15 : 0) + (trinkets.includes('thickhide') ? 0.15 : 0);
}
export const maxHpFor = (day, hpBonus, avatar, trinkets) => Math.round(teamHp(day) * hpMult(hpBonus, avatar, trinkets));

export function teamPower(team, hpBonus, avatar, trinkets) {
  let p = 0;
  for (const m of team) if (m) p += TIER_POWER[MON[m.id].tier] * LV_POWER[m.lvl] * (m.atk + m.pow) / 2;
  const bt = trinkets.filter(t => BATTLE_TRINKETS.includes(t) && t !== 'thickhide').length;
  return Math.round(p * hpMult(hpBonus, avatar, trinkets) * (1 + 0.04 * bt) * (avatar === 'coach' && team[0] ? 1.05 : 1));
}
export const runPower = (run) => teamPower(run.team, run.hpBonus, run.avatar, run.trinkets);

export function snapshot(run, name) {
  return {
    name, day: run.day, wins: run.wins, losses: run.losses, avatar: run.avatar,
    trinkets: run.trinkets.filter(t => BATTLE_TRINKETS.includes(t)), hpBonus: run.hpBonus,
    team: run.team.map(m => m ? { id: m.id, lvl: m.lvl, atk: m.atk, pow: m.pow } : null),
    power: runPower(run),
  };
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
  sum.salvage = salvageGold(run);
  sum.egg = won && run.trinkets.includes('goldenegg') ? 2 : 0;
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
    const target = runPower(run) * (1 + 0.03 * rankIndex);
    const sorted = pool.slice().sort((a, b) => Math.abs(a.power - target) - Math.abs(b.power - target));
    pick = r.pick(sorted.slice(0, 5));
  } else pick = r.pick(pool);
  save(run, r);
  return { ...pick, day: run.day };
}

export const seedFor = (s) => hash(String(s));
