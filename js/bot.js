// Bot players: used to build the snapshot library and for balance simulations.
// Deliberately imperfect: they like favourite types, reroll a set amount and arrange simply.
import { MON, TYPES, TIER_POWER, LV_POWER, ECHO_KEYS, RULES, TRINKET, isBattleTrinket, price, TRIGGERS, AURAS, trinketPrice } from './data.js?v=0.7.7';
import * as R from './run.js?v=0.7.7';
import { simulate } from './battle.js?v=0.7.7';

const isSupport = (id) => MON[id].role === 'support' || MON[id].role === 'enabler';

// know: optional { monId: multiplier } learned from a previous simulation (informed bots)
// tryhard (v0.7.7): plays like a committed player — commits to 1-2 dimensions, rerolls hard for copies and merges,
// buys the day's trinket whenever it fits, picks rewards for synergy, always takes the best event
export function makeProfile(r, run, know = null, tryhard = false) {
  let favs = r.shuffle(run.types).slice(0, 1 + r.int(2));
  if (tryhard && know) { // pick dimensions that are known to be strong (with some variety)
    const score = (t) => { const v = Object.entries(know).filter(([id]) => MON[id].type === t).map(([, k]) => k).sort((a, b) => b - a).slice(0, 5); return v.reduce((a, b) => a + b, 0) + r() * 1.2; };
    favs = run.types.slice().sort((a, b) => score(b) - score(a)).slice(0, 1 + r.int(2));
  }
  if (tryhard) return { favs, favBias: 1.0 + r() * 0.8, rerolls: 10 + r.int(8), order: r() < 0.5 ? 'support' : 'power', eventSmart: 1, know, tryhard: true };
  return { favs, favBias: 0.2 + r() * 0.9, rerolls: r.int(5), order: r() < 0.6 ? 'support' : 'power', eventSmart: r(), know };
}

export const instValue = (m) => TIER_POWER[MON[m.id].tier] * LV_POWER[m.lvl] * (m.atk + m.pow) / 2;

function offerValue(run, prof, mon) {
  const def = MON[mon.id];
  let v = TIER_POWER[def.tier] * (mon.atk + mon.pow) / 2;
  v *= Math.pow((10 * def.tier) / price(def), 0.7); // cheap-for-its-tier is attractive
  if (prof.know && prof.know[mon.id]) v *= prof.know[mon.id];
  const copies = R.owned(run).filter(o => o.m.id === mon.id && o.m.lvl === 1).length;
  const l2 = R.owned(run).some(o => o.m.id === mon.id && o.m.lvl === 2);
  const l3 = R.owned(run).some(o => o.m.id === mon.id && o.m.lvl >= 3);
  v *= prof.tryhard ? 1 + copies * 0.9 + (l2 ? 0.6 : 0) + (l3 ? 0.25 : 0) : 1 + copies * 0.55 + (l2 ? 0.3 : 0);
  if (prof.favs.includes(def.type)) v *= 1 + prof.favBias;
  return v;
}

function weakest(run) {
  let w = null;
  for (const o of R.owned(run)) if (!w || instValue(o.m) < instValue(w.m)) w = o;
  return w;
}

export function botEvent(run, r, prof) {
  const ev = run.event;
  if (!ev) return;
  const choices = ev.choices.map((c, i) => ({ c, i })).filter(x => !R.choiceBlocked(run, x.c));
  if (!choices.length) { run.event = null; run.phase = 'shop'; return; }
  let pick;
  if (ev.avatar || r() > prof.eventSmart) pick = r.pick(choices);
  else {
    const pref = { egg: 9, trinket: 8, clone: 7, wild: 7, hp: 5, train: 5, meditate: 4, gold: 6, rerolls: 4, sale: 3, revive: 6, gamble: 2 };
    choices.sort((a, b) => (pref[b.c.kind] || 0) - (pref[a.c.kind] || 0));
    pick = choices[0];
  }
  let target;
  if (pick.c.needsTarget) {
    let mine = R.owned(run).filter(o => !pick.c.targetLvl1 || o.m.lvl === 1);
    if (pick.c.kind === 'clone') {
      const dup = mine.filter(o => R.owned(run).filter(x => x.m.id === o.m.id && x.m.lvl === 1).length >= 2);
      if (dup.length) mine = dup;
    }
    mine.sort((a, b) => instValue(b.m) - instValue(a.m));
    target = mine[0] && { zone: mine[0].zone, i: mine[0].i };
  }
  const res = R.chooseEvent(run, pick.i, target);
  if (!res.ok) { run.event = null; run.phase = 'shop'; }
}

export function botShop(run, r, prof) {
  let rerolls = 0;
  for (let guard = 0; guard < 40; guard++) {
    const offers = run.shop.map((o, i) => ({ o, i })).filter(x => x.o.mon && R.offerPrice(run, MON[x.o.mon.id]) <= run.gold);
    offers.sort((a, b) => offerValue(run, prof, b.o.mon) - offerValue(run, prof, a.o.mon));
    let did = false;
    // tryhard: try the top offers in a copy of the run and buy the one that helps most against the reference teams
    if (prof.tryhard && prof.refs && prof.refs.length && offers.length) {
      const base = evalTeam(run, prof.refs);
      let pick = null, bestSc = base;
      for (const { o, i } of offers.slice(0, 3)) {
        const c = structuredClone(run);
        if (!R.hasRoomFor(c, o.mon.id)) { const w = weakest(c); if (!w) continue; R.sell(c, w.zone, w.i); }
        if (!R.buy(c, i).ok) continue;
        arrange(c, prof);
        const sc = evalTeam(c, prof.refs);
        if (sc > bestSc + 0.05 || (c.team.filter(Boolean).length > run.team.filter(Boolean).length && sc >= bestSc - 0.05)) { bestSc = sc; pick = { o, i }; }
      }
      if (pick) {
        if (!R.hasRoomFor(run, pick.o.mon.id)) { const w = weakest(run); if (w) R.sell(run, w.zone, w.i); }
        if (R.buy(run, pick.i).ok) { arrange(run, prof); continue; }
      }
      const cheapest = Math.min(...run.shop.filter(x => x.mon).map(x => R.offerPrice(run, MON[x.mon.id])), 99);
      if (rerolls < prof.rerolls && run.gold >= R.rerollCostNow(run) + cheapest) { R.reroll(run); rerolls++; continue; }
      // nothing improves the team and no gold to dig: fall back to normal buying (copies, filling slots)
    }
    for (const { o, i } of offers) {
      const v = offerValue(run, prof, o.mon);
      if (R.hasRoomFor(run, o.mon.id)) {
        // fill the team freely; once only the bench is free, be pickier
        const teamFree = run.team.includes(null);
        const w = weakest(run);
        if (teamFree || R.owned(run).filter(x => x.m.id === o.mon.id).length || !w || v > instValue(w.m) * 0.9) {
          if (R.buy(run, i).ok) { did = true; break; }
        }
      } else {
        const w = weakest(run);
        if (w && v > instValue(w.m) * 1.3) {
          const sv = R.sellValue(run, w.m);
          if (run.gold + sv >= R.offerPrice(run, MON[o.mon.id])) { R.sell(run, w.zone, w.i); if (R.buy(run, i).ok) { did = true; break; } }
        }
      }
    }
    if (did) continue;
    const cheapest = Math.min(...run.shop.filter(x => x.mon).map(x => R.offerPrice(run, MON[x.mon.id])), 99);
    const keep = prof.tryhard ? Math.min(cheapest, 10 * Math.min(5, 1 + Math.floor(run.day / 3))) : Math.min(cheapest, 10);
    if (rerolls < prof.rerolls && run.gold >= R.rerollCostNow(run) + keep) { R.reroll(run); rerolls++; continue; }
    break;
  }
  // shop trinket slot: tryhards buy it whenever it fits the build (one a day, Satchel two)
  while (prof.tryhard && run.tshop && run.tshop.id && R.trinketBuysLeft(run) > 0) {
    const t = TRINKET[run.tshop.id];
    if (run.gold < trinketPrice(t) || trinketScore(run, run.tshop.id, prof, () => 0.5) < 2) break;
    if (!R.buyTrinket(run).ok) break;
    botTrinkets(run, r, prof);
  }
  // shop trinket slot: buy it when there's spare gold (more eager with trinket-loving mons)
  if (!prof.tryhard && run.tshop && run.tshop.id) {
    const t = TRINKET[run.tshop.id], cost = trinketPrice(t);
    const lovers = R.owned(run).filter(o => TRIGGERS[o.m.id] && TRIGGERS[o.m.id].on === 'trinket').length;
    if (run.gold >= cost && (t.tier >= 2 || lovers) && r() < 0.55 + lovers * 0.15) R.buyTrinket(run);
  }
  botTrinkets(run, r, prof);
  arrange(run, prof);
  run.celebrate = [];
}

export function arrange(run, prof) {
  const all = R.owned(run).map(o => o.m);
  all.sort((a, b) => instValue(b) - instValue(a));
  const team = all.slice(0, RULES.teamSlots);
  const rest = all.slice(RULES.teamSlots);
  let ordered;
  if (prof.order === 'support') {
    const sup = team.filter(m => isSupport(m.id));
    const other = team.filter(m => !isSupport(m.id));
    ordered = [...sup, ...other];
  } else ordered = team.slice();
  // grid: slots 0-2 front row, 3-5 back row. Echo mons and "when the ally in front casts" mons go
  // directly behind the strongest front-row mon; "boost the ally behind" aura mons go in the front row.
  const backers = ordered.filter(m => ECHO_KEYS.some(k => MON[m.id].fx[k]) || (TRIGGERS[m.id] && TRIGGERS[m.id].from === 'front'));
  const fronters = ordered.filter(m => !backers.includes(m) && AURAS[m.id] && AURAS[m.id].who === 'behind');
  const others = ordered.filter(m => !backers.includes(m) && !fronters.includes(m));
  const slots = Array(6).fill(null);
  const front = [...fronters, ...others].slice(0, 3);
  front.forEach((m, i) => slots[i] = m);
  const left = [...fronters, ...others].slice(3);
  const strongest = front.map((m, i) => [m, i]).sort((x, y) => instValue(y[0]) - instValue(x[0])).map(x => x[1]);
  for (const bk of backers) { const i = strongest.find(j => !slots[j + 3]); if (i !== undefined) slots[i + 3] = bk; else left.unshift(bk); }
  for (const m of left) { const j = slots.indexOf(null); if (j >= 0) slots[j] = m; }
  run.team = Array(RULES.teamSlots).fill(null);
  slots.forEach((m, i) => run.team[i] = m);
  run.bench = Array(R.benchSize(run)).fill(null);
  rest.slice(0, run.bench.length).forEach((m, i) => run.bench[i] = m);
}

function trinketScore(run, id, prof, r) {
  const counts = {};
  for (const o of R.owned(run)) counts[MON[o.m.id].type] = (counts[MON[o.m.id].type] || 0) + 1;
  const t = TRINKET[id];
  if (!prof.tryhard) {
    let v = t.tier + r() * 1.5;
    if (id.startsWith('relic_')) v += (counts[id.slice(6)] || 0) * 0.6 - 1;
    if (!isBattleTrinket(id)) v -= run.day > 6 ? 1.5 : 0.3;
    return v;
  }
  // tryhard: synergy first, economy early, tempo trinkets valued
  let v = t.tier * 0.8 + r() * 0.5;
  if (id.startsWith('relic_')) v += (counts[id.slice(6)] || 0) * 1.1 - 1.5;
  if (!isBattleTrinket(id)) v += run.day <= 5 ? 1.2 : run.day <= 9 ? 0 : -2;
  if (['pocketwatch', 'sandbottle', 'mixtape', 'leaderbadge', 'rearguard', 'faultline', 'timeturner', 'chimera'].includes(id)) v += 1;
  if (id === 'lonewolf' && R.owned(run).length > 4) v -= 3;
  return v;
}
export function botTrinkets(run, r, prof) {
  let q;
  while ((q = R.currentTrinketChoice(run))) {
    const best = q.options.slice().sort((a, b) => trinketScore(run, b, prof, r) - trinketScore(run, a, prof, r))[0];
    R.chooseTrinket(run, best);
  }
}

// tryhard: test swaps (within the team, and bench <-> team) against reference opponents, keep what wins more
function evalTeam(run, refs) {
  const me = R.battleTeamFromSnap(R.snapshot(run, 'x'));
  let sc = 0;
  for (const o of refs) {
    const res = simulate(me, R.battleTeamFromSnap(o));
    sc += res.winner === 0 ? 1 + Math.max(0, 40 - res.t) / 40 : 0.9 * (1 - Math.max(0, res.hp[1]) / res.maxHp[1]);
  }
  return sc;
}
function searchArrange(run, r, prof) {
  if (!prof.refs || !prof.refs.length) return;
  let best = evalTeam(run, prof.refs);
  for (let pass = 0; pass < 14; pass++) {
    const zs = [['team', Math.floor(r() * 6)], [r() < 0.7 ? 'team' : 'bench', 0]];
    zs[1][1] = Math.floor(r() * (zs[1][0] === 'team' ? 6 : run.bench.length));
    const [a, b] = zs; if (a[0] === b[0] && a[1] === b[1]) continue;
    const A = a[0] === 'team' ? run.team : run.bench, Bz = b[0] === 'team' ? run.team : run.bench;
    if (!A[a[1]] && !Bz[b[1]]) continue;
    [A[a[1]], Bz[b[1]]] = [Bz[b[1]], A[a[1]]];
    const sc = evalTeam(run, prof.refs);
    if (sc > best) best = sc; else [A[a[1]], Bz[b[1]]] = [Bz[b[1]], A[a[1]]];
  }
}
export function botDay(run, r, prof) {
  if (run.phase === 'event') botEvent(run, r, prof);
  botTrinkets(run, r, prof);
  botShop(run, r, prof);
  botTrinkets(run, r, prof);
  arrange(run, prof);
  if (prof.tryhard) searchArrange(run, r, prof);
  run.celebrate = [];
}
