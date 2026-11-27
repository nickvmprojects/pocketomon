// Pocketomon battle engine. Pure and deterministic (no randomness), runs in browser and Node.
// Clock ticks every 0.1s. Each tick: charge timers, beings that reach their cooldown cast in
// slot order (slot 1 player, slot 1 opponent, slot 2 player, ...), then the battle ends if a
// team is at 0 HP. Statuses tick once per second. Ties go to side A (the player).
// v0.7: dimension mechanics (Ki, Alignment, tags, Assimilate, Scrap, Pressure, Sleep, Tempo) and
// per-being damage/support tracking for the battle report.
import { MON, TYPES, RULES, LV, ECHO_KEYS, fxValue, trinketBonus, TRIGGERS, AURAS, inZone } from './data.js?v=0.7.6';

const DT = 0.1;
const TPS = 10; // ticks per second
const CAPS = { growth: 150, haste: 60, chill: 50, expose: 60, weaken: 40, selfgrow: 200, pressure: 30 };
const DECAY = { chill: 3, haste: 3, expose: 1.2, weaken: 1.2 }; // points lost per second
const LINGER = ['chill', 'expose', 'weaken']; // debuffs Lunara makes fade slower
const KI_MAX = 5, TRANS_T = 6, SLEEP_T = 2, SCRAP_HIT = 0.5;
const hasTag = (u, tag) => !!(u && ((u.def.x.tags && u.def.x.tags.includes(tag)) || (u.chimera && (tag === 'hunter' || tag === 'giant' || tag === 'archer'))));
// grid: slots 0-2 front, 3-5 back; diagonal neighbours (for the Star Chart relic)
const diag = (a, b) => Math.abs((a % 3) - (b % 3)) === 1 && Math.floor(a / 3) !== Math.floor(b / 3);

function makeUnit(inst, side, pos, team) {
  if (!inst) return null;
  const def = MON[inst.id];
  let atk = inst.atk, pow = inst.pow;
  const b = team.bonus;
  // buff sources are tracked so the UI can explain effective stats
  const src = [];
  const addSrc = (label, pct) => { if (pct) src.push({ label, atk: pct, pow: pct }); return pct; };
  let k = 1;
  if (pos === 0) k += addSrc('Leader Badge (slot 1)', b.slot1 || 0) / 100;
  if (pos === 5) k += addSrc('Rear Guard (slot 6)', b.slot6 || 0) / 100;
  if (pos === 0 && team.avatar === 'coach') k += addSrc('Coach Kip (slot 1)', 30) / 100;
  atk *= k; pow *= k;
  return {
    side, pos, def, lvl: inst.lvl, atk, pow, cd: def.cd, charge: 0, ramp: 0, casts: 0, spd: 1, trig: TRIGGERS[def.id], plus: inst.plus || 0, gain: 0, src,
    ki: 0, trans: 0, trained: 0, oc: 0, seen: 0, dealt: 0, support: 0, chimera: pos === 0 && !!b.chimera,
  };
}

function makeSide(team, side) {
  const s = {
    side, maxHp: team.maxHp, hp: team.maxHp, shield: 0,
    burn: 0, poison: 0, chill: 0, haste: 0, expose: 0, weaken: 0, growth: 0,
    doom: 0, doomT: 0, scrap: 0, rebirth: 0, rebirthUsed: false, pressure: 0, sleepT: 0, confuse: 0,
    trinkets: team.trinkets || [], ntrink: team.ntrink ?? (team.trinkets || []).length, avatar: team.avatar, bonus: trinketBonus(team.trinkets), par: team.par || null,
    dmgDealt: 0, healed: 0, kiGained: 0, castCount: 0, lastCast: null, alignPairs: 0,
    burnBy: new Map(), poisonBy: new Map(), doomBy: new Map(), hpHist: [],
  };
  s.units = [];
  for (let i = 0; i < 6; i++) s.units.push(makeUnit(team.mons[i], side, i, s));
  const U = s.units.filter(Boolean);
  const has = (key) => U.filter(u => u.def.pas[key]);
  const B = s.bonus;
  // v0.7.6 trinkets that change the trinket count: Rainbow Badge (dimensions), Hall of Fame (level 4+ beings)
  if (B.rainbow) s.ntrink += B.rainbow * new Set(U.map(u => u.def.type)).size;
  if (B.fame) s.ntrink += B.fame * U.filter(u => u.lvl >= 4).length;
  s.kiMax = Math.max(3, KI_MAX - (B.r_martial || 0)); s.transPlus = 3 * (B.r_martial || 0);
  s.dreamK = 1 + 0.5 * (B.r_dream || 0);
  s.metro = B.r_clock ? Math.max(3, 6 - B.r_clock) : 0;
  s.giantK = 1 + (B.r_giants || 0);
  // Twin Fates: copies of the same being on the team echo each other; Paragon: highest level casts twice
  if (B.twin) for (const u of U) u.twins = U.filter(o => o !== u && o.def.id === u.def.id);
  if (B.paragon && U.length) { const top = U.reduce((a, o) => (o.lvl > a.lvl ? o : a)); top.paragon = true; }
  // team-wide passives
  s.shieldCapPct = Math.max(RULES.shieldCap * 100, ...has('shieldCap').map(u => u.def.pas.shieldCap));
  s.ohFull = has('overheal').length > 0;
  s.scrapCap = has('scrapCap2').length ? 80 : 40;
  s.kiLong = has('kiLong').length > 0;
  s.train = Math.max(0, ...has('train').map(u => u.def.pas.train));
  s.linger = Math.max(0, ...has('linger').map(u => u.def.pas.linger));
  s.late = Math.max(0, ...has('late').map(u => u.def.pas.late));
  s.reset15 = has('reset15').length > 0;
  s.rewind = has('rewind').length > 0; s.rewindUsed = false;
  const ral = has('rally')[0];
  s.rally = ral ? { heal: ral.def.pas.rally.heal * LV.pct[ral.lvl], haste: ral.def.pas.rally.haste * LV.pct[ral.lvl], by: ral } : null; s.rallyUsed = false;
  const x2 = has('auraX2').length ? 2 : 1;

  const mods = s.units.map(() => ({ atk: 0, pow: 0, spd: 0 }));
  const push = (o, label, atk, pow, spd, from) => {
    mods[o.pos].atk += atk; mods[o.pos].pow += pow; mods[o.pos].spd += spd;
    o.src.push({ label, atk, pow, spd, from });
  };
  // Zodiac alignment: adjacent beings of the same element (Virgo matches any)
  const elOf = (u) => u && (u.chimera ? 'all' : u.def.type === 'zodiac' && u.def.x.el);
  const near = (a, b) => inZone('adjacent', a, b) || (B.r_zodiac && diag(a, b));
  const alignK = 20 + 10 * (B.r_zodiac || 0);
  for (const u of U) {
    const e = elOf(u); if (!e) continue;
    for (const o of U) if (o.pos > u.pos && near(u.pos, o.pos)) {
      const f = elOf(o); if (f && (e === f || e === 'all' || f === 'all')) s.alignPairs++;
    }
    if (U.some(o => o !== u && near(u.pos, o.pos) && elOf(o) && (elOf(o) === e || elOf(o) === 'all' || e === 'all'))) push(u, 'Aligned', alignK, alignK, 0);
  }
  // ongoing positional auras (computed from base stats so auras don't feed each other)
  for (const u of U) {
    const a = AURAS[u.def.id]; if (!a) continue;
    const k = LV.pct[u.lvl];
    for (const o of U) if (inZone(a.who, u.pos, o.pos) && (!a.tag || hasTag(o, a.tag))) {
      const m = (v) => (v || 0) * k * (v > 0 ? x2 : Math.pow(0.5, B.r_necro || 0)); // Kill Switch halves Assimilate
      push(o, `${u.def.name} ${a.atk < 0 ? 'Assimilate' : 'aura'}`, m(a.atk), m(a.pow), m(a.speed), u.pos);
    }
  }
  for (const u of has('trinketPow')) for (const o of U) { const v = u.def.pas.trinketPow * s.ntrink * LV.pct[u.lvl]; if (v) push(o, `${u.def.name} (trinkets)`, v, v, 0, u.pos); }
  for (const u of has('mainframe')) for (const o of U) if (o !== u && mods[o.pos].atk < 0) push(o, `${u.def.name}`, 0, 0, u.def.pas.mainframe * LV.pct[u.lvl], u.pos);
  for (const u of has('absorb')) {
    const n = U.filter(o => o !== u).length, v = u.def.pas.absorb * n * LV.pct[u.lvl];
    if (v) push(u, `${u.def.name} absorbs ${n} allies`, v, v, 0);
  }
  for (const o of U) { const m = mods[o.pos]; o.atk *= Math.max(0, 1 + m.atk / 100); o.pow *= Math.max(0, 1 + m.pow / 100); o.spd = 1 + m.spd / 100; o.aura = m; }
  s.prism = 1;
  s.whet = 1;
  s.wind = s.bonus.wind || 0; s.windUsed = false;
  return s;
}

// value of an effect for a unit (level + POW + prism), echo scale applied by caller
function val(u, key, base, side) {
  return fxValue(key, base, u.def, u.lvl, u.pow) * side.prism;
}
const bonusDmg = (u, key) => fxValue(key, u.def.fx[key], u.def, u.lvl, u.atk);

export function simulate(teamA, teamB, opts = {}) {
  const log = opts.log ? [] : null;
  const S = [makeSide(teamA, 0), makeSide(teamB, 1)];
  let events = [];
  const ev = (e) => { if (log) events.push(e); };
  let actor = null; // the being whose cast/trigger is running (for the battle report)
  let tNow = 0;

  const credit = (map, side, amt) => { // split DoT damage between the beings that applied it
    let tot = 0; for (const v of map.values()) tot += v;
    if (tot <= 0) return;
    for (const [u, v] of map) u.dealt += amt * v / tot;
  };
  const damage = (side, amt, kind, pierce) => {
    if (amt <= 0) return 0;
    if (kind !== 'hit' && kind !== 'sudden' && kind !== 'self') amt *= 1 + side.expose / 100; // expose boosts all damage
    let a = amt;
    if (!pierce && side.shield > 0) { const ab = Math.min(side.shield, a); side.shield -= ab; a -= ab; if (ab > 0) ev({ k: 'absorb', s: side.side, v: ab }); }
    side.hp -= a;
    ev({ k: 'dmg', s: side.side, v: amt, kind, by: kind === 'hit' && actor && actor.side !== side.side ? actor.pos : undefined });
    if (kind === 'hit' && actor && actor.side !== side.side) actor.dealt += amt;
    if (side.hp <= 0 && side.bonus.totem && !side.totemUsed) { // Undying Totem
      side.totemUsed = true; side.hp = 1; heal(side, side.maxHp * side.bonus.totem / 100, true); ev({ k: 'rebirth', s: side.side, totem: true });
    }
    if (!side.low50 && side.hp > 0 && side.hp < side.maxHp * 0.5) {
      side.low50 = true;
      if (side.bonus.turn) { for (const o of side.units) if (o) o.charge = Math.max(o.charge, o.cd); ev({ k: 'fx', fx: 'reset', s: side.side }); } // Time Turner
      emit(side, 'lowHp', {}); emit(S[1 - side.side], 'foeLow', {});
    }
    return amt;
  };
  // ---- triggers: each being fires at most once per chain, never from a copy of itself
  let chain = null;
  function emit(side, on, data) {
    const top = !chain; if (top) chain = new Set();
    for (const u of side.units) {
      if (!u || !u.trig || u.trig.on !== on || chain.has(u)) continue;
      const t = u.trig;
      if (on === 'selfCast' && data.unit !== u) continue;
      if (on === 'allyCast') {
        const src = data.unit;
        if (src === u || src.def.id === u.def.id) continue;
        if (t.type && src.def.type !== t.type) continue;
        if (t.from && !inZone(t.from, u.pos, src.pos)) continue; // e.g. from 'front': the source is in front of me
      }
      chain.add(u);
      const prev = actor; actor = u;
      const src = data.unit || prev; // v0.7.5: who set this trigger off (for the trigger-link visual only)
      fireTrigger(u, data, src && src.side === u.side && src !== u ? src.pos : undefined);
      actor = prev;
    }
    if (top) chain = null;
  }
  function fireTrigger(u, data, from) {
    const own = S[u.side], foe = S[1 - u.side], d = u.trig.do;
    ev({ k: 'trig', s: u.side, pos: u.pos, from });
    if (d.cast) { u.charge = 0; cast(u, 1, null, tNow); return; }
    if (d.multicast) { u.charge = 0; for (let k = 0; k < d.multicast; k++) cast(u, 1, null, tNow); return; }
    if (d.plus) { const g = d.plus * u.lvl; u.plus += g; u.gain += g; return; } // permanent: written back to the run after battle
    if (d.fx) for (const [k, v] of Object.entries(d.fx)) applyFx(u, own, foe, k, v, 1, 0);
    if (d.pct) {
      const x = (data.v || 0) * d.v / 100 * u.pow * own.prism;
      if (d.pct === 'dmg') own.dmgDealt += damage(foe, x, 'hit', false);
      if (d.pct === 'heal') heal(own, x, true);
      if (d.pct === 'shield') addShield(own, x);
    }
  }
  // healing past max HP overflows into shield at half value (full value with Moon Priestess Ysil)
  const heal = (side, amt, noOverflow) => {
    if (amt <= 0) return 0;
    const h = Math.min(amt, side.maxHp - side.hp);
    side.hp += h; side.healed += h;
    if (actor && actor.side === side.side) actor.support += h;
    ev({ k: 'heal', s: side.side, v: amt });
    if (!noOverflow && amt > h) { const g = Math.min(side.maxHp * side.shieldCapPct / 100, side.shield + (amt - h) * (side.ohFull ? 1 : 0.5)) - side.shield; if (g > 0) { side.shield += g; if (actor && actor.side === side.side) actor.support += g; emit(side, 'shieldGain', { v: g }); } }
    emit(side, 'healed', { v: amt });
    return h;
  };
  const addShield = (side, amt) => {
    if (amt <= 0) return;
    const cap = side.maxHp * side.shieldCapPct / 100;
    const g = Math.max(0, Math.min(cap, side.shield + amt) - side.shield);
    side.shield += g;
    if (actor && actor.side === side.side) actor.support += g;
    ev({ k: 'shield', s: side.side, v: amt });
    if (g > 0) emit(side, 'shieldGain', { v: g });
  };
  const add = (side, key, v) => { side[key] = Math.min(key === 'scrap' ? side.scrapCap : (CAPS[key] ?? 1e9), side[key] + v); };
  const selfCost = (side, x) => { x = Math.min(x, side.hp - 1); if (x > 0) damage(side, x, 'self', true); };
  const addKi = (side, o, n) => {
    if (!o || n <= 0) return;
    o.ki += n; side.kiGained += n;
    while (o.ki >= side.kiMax) {
      o.ki -= side.kiMax; o.trans = TRANS_T * (side.kiLong ? 2 : 1) + side.transPlus;
      if (side.train) o.trained += side.train / 100;
      ev({ k: 'fx', fx: 'transform', s: side.side, pos: o.pos });
    }
  };
  const sleep = (foe, o, v) => {
    if (!o || o.def.x.immune) return false;
    o.charge = Math.max(-2, o.charge - v); foe.sleepT = Math.max(foe.sleepT, SLEEP_T); return true;
  };

  // Effects (non-damage). scale = echo scale
  function applyFx(u, own, foe, key, base, scale, dealt) {
    const v = val(u, key, base, own) * scale;
    switch (key) {
      case 'burn': foe.burn += v; foe.burnBy.set(u, (foe.burnBy.get(u) || 0) + v); ev({ k: 'fx', fx: 'burn', s: foe.side, v }); break;
      case 'poison': foe.poison += v; foe.poisonBy.set(u, (foe.poisonBy.get(u) || 0) + v); ev({ k: 'fx', fx: 'poison', s: foe.side, v }); break;
      case 'heal': heal(own, v); break;
      case 'healPct': heal(own, own.maxHp * v / 100); break;
      case 'cleanse': {
        let c = v; const b = Math.min(own.burn, c); own.burn -= b; c -= b;
        own.poison = Math.max(0, own.poison - c);
        ev({ k: 'fx', fx: 'cleanse', s: own.side, v }); break;
      }
      case 'shield': addShield(own, v); break;
      case 'shieldPerHunter': addShield(own, v * own.units.filter(o => hasTag(o, 'hunter')).length); break;
      case 'shieldPerTrinket': addShield(own, v * own.ntrink); break;
      case 'shieldPerPressure': addShield(own, v * foe.pressure); break;
      case 'missingShield': addShield(own, (own.maxHp - own.hp) * v / 100); break;
      case 'healPerScrap': heal(own, v * own.scrap); break;
      case 'growth': add(own, 'growth', v); u.support += v * 0.5; ev({ k: 'fx', fx: 'growth', s: own.side, v }); break;
      case 'sapGrowth': own.growth = Math.max(0, own.growth - base); break;
      case 'selfgrow': u.ramp = Math.min(CAPS.selfgrow, u.ramp + v); ev({ k: 'fx', fx: 'selfgrow', s: own.side, pos: u.pos, v }); break;
      case 'haste': add(own, 'haste', v); u.support += v * 0.5; ev({ k: 'fx', fx: 'haste', s: own.side, v }); break;
      case 'chill': add(foe, 'chill', v); ev({ k: 'fx', fx: 'chill', s: foe.side, v }); break;
      case 'expose': add(foe, 'expose', v); ev({ k: 'fx', fx: 'expose', s: foe.side, v }); break;
      case 'weaken': add(foe, 'weaken', v); ev({ k: 'fx', fx: 'weaken', s: foe.side, v }); break;
      case 'doom': foe.doom += v; foe.doomBy.set(u, (foe.doomBy.get(u) || 0) + v); if (foe.doomT <= 0) foe.doomT = 5; ev({ k: 'fx', fx: 'doom', s: foe.side, v }); break;
      case 'scrap': add(own, 'scrap', v); ev({ k: 'fx', fx: 'scrap', s: own.side, v }); break;
      case 'pressure': add(foe, 'pressure', v); ev({ k: 'fx', fx: 'pressure', s: foe.side, v }); break;
      case 'ki': for (const o of own.units) addKi(own, o, v); break;
      case 'overclock': for (const o of own.units) if (o && o !== u) o.oc = 1; ev({ k: 'fx', fx: 'overclock', s: own.side }); break;
      case 'strip': {
        const x = foe.shield * Math.min(100, base) / 100; foe.shield -= x;
        if (base >= 100) { foe.growth = 0; foe.haste = 0; }
        ev({ k: 'fx', fx: 'strip', s: foe.side, v: x }); break;
      }
      case 'balance': {
        const gap = foe.hp / foe.maxHp - own.hp / own.maxHp;
        if (gap > 0) own.dmgDealt += damage(foe, gap * 100 * v, 'hit', false); else heal(own, -gap * 100 * v, true);
        break;
      }
      case 'drain': { const x = Math.min(own.maxHp * base / 100, own.hp - 1); if (x > 0) { damage(own, x, 'self', true); addShield(own, x * 2); } break; }
      case 'selfHurt': selfCost(own, own.maxHp * base / 100); break;
      case 'confuse': foe.confuse = Math.min(100, v); ev({ k: 'fx', fx: 'confuse', s: foe.side }); break;
      case 'charge':
        for (const o of own.units) if (o && o !== u) o.charge += v;
        ev({ k: 'fx', fx: 'charge', s: own.side, v }); break;
      case 'chargeNext': {
        const n = own.units.slice(u.pos + 1).find(Boolean);
        if (n) { n.charge += v; ev({ k: 'fx', fx: 'charge', s: own.side, pos: n.pos, v }); }
        break;
      }
      case 'freeze': {
        const t = foe.units[u.pos] || foe.units.find(Boolean);
        if (sleep(foe, t, v * own.dreamK)) ev({ k: 'fx', fx: 'freeze', s: foe.side, pos: t.pos, v });
        break;
      }
      case 'freezeTop': {
        let t = null;
        for (const o of foe.units) if (o && !o.def.x.immune && (!t || o.charge / o.cd > t.charge / t.cd)) t = o;
        if (sleep(foe, t, v * own.dreamK)) ev({ k: 'fx', fx: 'freeze', s: foe.side, pos: t.pos, v });
        break;
      }
      case 'freezeAll':
        for (const o of foe.units) sleep(foe, o, v * own.dreamK);
        ev({ k: 'fx', fx: 'freeze', s: foe.side, v }); break;
      case 'dreamHeal': if (dealt > 0 && foe.sleepT > 0) heal(own, dealt * v / 100, true); break;
      default: break; // damage modifiers and echo/copy/volley keys are handled in cast
    }
  }

  // echo target on the grid: the ally in front / behind that isn't an echo being
  const isEcho = (o) => ECHO_KEYS.some(k => o.def.fx[k]);
  function findEchoTarget(own, from, who) {
    for (const o of own.units) if (o && !isEcho(o) && inZone(who, from, o.pos)) return o;
    return null;
  }

  function cast(u, scale, echoed, t) {
    const own = S[u.side], foe = S[1 - u.side];
    const d = u.def, fx = d.fx, x = d.x;
    const prevActor = actor; actor = u;
    ev({ k: 'cast', s: u.side, pos: u.pos, echo: !!echoed, by: echoed ? echoed.pos : undefined });
    // Ki transformation and Hoshi training boost both hits and effects
    const form = (u.trans > 0 ? 1.5 : 1) * (1 + u.trained);
    let fxScale = scale * form;
    const hpR = Math.max(0, own.hp / own.maxHp - 0.2 * (own.bonus.r_fallen || 0)); // Dead Man's Switch
    if (x.lowX2 && hpR < 0.5) fxScale *= 2;
    if (x.vsChill && foe.chill > 0) fxScale *= 1 + x.vsChill / 100;
    // ---- direct hit
    let base = fxValue('dmg', d.dmg, d, u.lvl, u.atk) + u.plus;
    if (x.hits) base *= x.hits;
    if (x.transTwice && u.trans > 0) base *= 2;
    if (d.type === 'junk' && own.scrap > 0) base += own.scrap * SCRAP_HIT * LV.dmg[u.lvl];
    if (x.vsBurn && foe.burn > 0) base += x.vsBurn * LV.dmg[u.lvl] * u.atk;
    if (fx.kinova) base += bonusDmg(u, 'kinova') * own.kiGained;
    if (fx.perAlign) base += bonusDmg(u, 'perAlign') * own.alignPairs;
    if (fx.perGiant) base += bonusDmg(u, 'perGiant') * own.units.filter(o => hasTag(o, 'giant')).length * own.giantK;
    if (fx.perScrap) base += bonusDmg(u, 'perScrap') * own.scrap;
    if (fx.crush) { base += bonusDmg(u, 'crush') * foe.pressure; if (!echoed) foe.pressure = own.bonus.r_abyss ? foe.pressure / 2 : 0; }
    if (fx.perDebuff) base += bonusDmg(u, 'perDebuff') * ['burn', 'poison', 'chill', 'expose', 'weaken', 'doom', 'pressure', 'sleepT'].filter(k => foe[k] > 0.05).length;
    if (fx.perAllyCast) { base += bonusDmg(u, 'perAllyCast') * Math.max(0, own.castCount - u.seen); u.seen = own.castCount; }
    if (fx.burst) { base += own.shield * val(u, 'burst', fx.burst, own) / 100; if (!echoed) own.shield = 0; }
    let mult = (1 + own.growth / 100 + u.ramp / 100) * (1 + foe.expose / 100) * (1 - own.weaken / 100) * own.whet * form;
    if (own.late && t > 20) mult *= 1 + own.late / 100;
    if (fx.lastStand) mult *= 1 + val(u, 'lastStand', fx.lastStand, own) / 100 * Math.max(0, 1 - hpR);
    if (x.vsChill && foe.chill > 0) mult *= 1 + x.vsChill / 100;
    if (fx.frontRow && u.pos < 3) mult *= 1 + val(u, 'frontRow', fx.frontRow, own) / 100;
    if (fx.perPressure) mult *= 1 + val(u, 'perPressure', fx.perPressure, own) / 100 * foe.pressure;
    if (fx.vsSleep && foe.sleepT > 0) mult *= 1 + val(u, 'vsSleep', fx.vsSleep, own) / 100;
    if (fx.vsDebuff && (foe.expose > 0 || foe.weaken > 0)) mult *= 1 + val(u, 'vsDebuff', fx.vsDebuff, own) / 100;
    if (fx.volleyAdj) mult *= 1 + val(u, 'volleyAdj', fx.volleyAdj, own) / 100 * own.units.filter(o => o && hasTag(o, 'archer') && inZone('adjacent', u.pos, o.pos)).length;
    if (fx.spendScrap && own.scrap >= 1) { own.scrap -= 1; mult *= 1 + val(u, 'spendScrap', fx.spendScrap, own) / 100; }
    // Mixtape: a follow-up right after an ally from another dimension hits harder
    if (own.bonus.mix && !echoed && own.prevType && own.prevType !== d.type) mult *= 1 + own.bonus.mix / 100;
    // Confused: this hit lands on your own team instead
    let target = foe;
    if (own.confuse > 0 && !echoed) { mult *= own.confuse / 100; own.confuse = 0; target = own; ev({ k: 'fx', fx: 'confused', s: own.side, pos: u.pos }); }
    const amt = base * mult * scale;
    let dealt;
    if (target === own) { dealt = 0; selfCost(own, amt); }
    else dealt = damage(foe, amt, 'hit', false);
    own.dmgDealt += dealt;
    // ---- effects in definition order
    for (const key of Object.keys(fx)) applyFx(u, own, foe, key, fx[key], fxScale, dealt);
    u.casts++;
    if (own.bonus.r_elven && hasTag(u, 'archer')) heal(own, own.maxHp * 0.01 * own.bonus.r_elven, true); // Moonwell
    if (!echoed) {
      own.castCount++; own.prevType = d.type;
      if (d.type === 'martial') addKi(own, u, 1);
    }
    // ---- echoes, copies, volleys and repeats (never chain)
    if (!echoed) {
      const targets = [];
      if (fx.echo) targets.push([findEchoTarget(own, u.pos, 'front') || findEchoTarget(own, u.pos, 'adjacent'), 'echo']);
      if (fx.echoBack) targets.push([findEchoTarget(own, u.pos, 'behind') || findEchoTarget(own, u.pos, 'adjacent'), 'echoBack']);
      if (fx.echoBoth) {
        const f = findEchoTarget(own, u.pos, 'front'), bk = findEchoTarget(own, u.pos, 'behind');
        if (f) targets.push([f, 'echoBoth']); if (bk) targets.push([bk, 'echoBoth']);
        if (!f && !bk) targets.push([findEchoTarget(own, u.pos, 'adjacent'), 'echoBoth']);
      }
      for (const [tgt, key] of targets) {
        if (!tgt) continue;
        const pct = Math.min(125, val(u, key, fx[key], { prism: 1 }));
        cast(tgt, scale * pct / 100, u, t);
      }
      if (fx.copyLast && own.lastCast && own.lastCast !== u) cast(own.lastCast, scale * Math.min(125, val(u, 'copyLast', fx.copyLast, { prism: 1 })) / 100, u, t);
      if (fx.volley) for (const o of own.units) if (o && o !== u && hasTag(o, 'archer')) cast(o, scale, u, t);
      if (fx.every4 && u.casts % 4 === 0) cast(u, scale, u, t);
      if (u.oc > 0) { u.oc = 0; cast(u, scale, u, t); }
      if (own.bonus.mirror) cast(u, scale * own.bonus.mirror / 100, u, t); // Mirror of Echoes (never chains)
      // v0.7.6 trinkets: extra casts are echoes, so they never chain into more echoes
      if (own.bonus.glass && !u.glassUsed) { u.glassUsed = true; cast(u, scale, u, t); } // Glass Cannon
      if (u.twins) for (const o of u.twins) cast(o, scale * own.bonus.twin / 100, u, t); // Twin Fates
      if (u.paragon) cast(u, scale, u, t); // Paragon's Laurel
      if (own.metro && own.castCount % own.metro === 0) cast(u, scale, u, t); // Metronome
      if (own.bonus.gear) { // Clockwork Heart
        let lo = null; for (const o of own.units) if (o && o !== u && (!lo || o.charge / o.cd < lo.charge / lo.cd)) lo = o;
        if (lo) lo.charge += own.bonus.gear;
      }
      if (!fx.copyLast) own.lastCast = u;
    }
    actor = prevActor;
    emit(own, 'allyCast', { unit: u });
    emit(own, 'selfCast', { unit: u });
  }

  // ---- battle start: passives in slot order
  for (let p = 0; p < 6; p++) for (const side of S) {
    const u = side.units[p];
    if (!u) continue;
    const pas = u.def.pas;
    if (pas.rebirth) side.rebirth = Math.max(side.rebirth, val(u, 'rebirth', pas.rebirth, side));
    if (pas.start) {
      const foe = S[1 - side.side];
      actor = u;
      for (const [key, base] of Object.entries(pas.start)) applyFx(u, side, foe, key, base, 1, 0);
      actor = null;
      ev({ k: 'cast', s: side.side, pos: p, start: true });
    }
  }
  for (const side of S) {
    const foe = S[1 - side.side], B = side.bonus;
    if (B.watch) { let n = B.watch; for (const o of side.units) if (o && n > 0) { o.charge = o.cd; n--; } } // Pocket Watch
    if (B.sand) for (const o of foe.units) if (o) o.charge -= B.sand; // Bottle of Sand
    if (B.r_junk) add(side, 'scrap', side.ntrink * B.r_junk); // Scrap Magnet
    if (B.r_abyss) add(foe, 'pressure', 3 * B.r_abyss); // Anchor
  }
  if (log) { log.push(frame(0, S, events)); events = []; }

  const speed = (side, t, ignoreChill) => {
    let h = 1 + side.haste / 100;
    if (side.bonus.wolf && side.units.filter(Boolean).length <= 3) h += side.bonus.wolf / 100; // Lone Wolf
    return Math.max(0.3, h * (ignoreChill ? 1 : 1 - side.chill / 100));
  };

  let tick = 0, winner = null, endT = 0, suddenOn = false;
  const maxTicks = RULES.hardCapSeconds * TPS;
  while (tick < maxTicks) {
    tick++;
    const t = tick / TPS; tNow = t;
    // 1) charge (Kaelen ignores chill); Ki forms and sleep wear off
    for (const side of S) {
      const sp = speed(side, t) * DT, spi = speed(side, t, true) * DT;
      const fault = Math.max(0.3, 1 - (S[1 - side.side].bonus.fault || 0) / 100); // Fault Line slows the enemy back row
      for (const u of side.units) if (u) { u.charge += (u.def.x.immune ? spi : sp) * u.spd * (u.pos >= 3 ? fault : 1); if (u.trans > 0) u.trans = Math.max(0, u.trans - DT); }
      side.sleepT = Math.max(0, side.sleepT - DT);
      if (side.reset15 && tick === 15 * TPS) { for (const u of side.units) if (u) u.charge = Math.max(u.charge, u.cd); ev({ k: 'fx', fx: 'reset', s: side.side }); }
    }
    // 2) casts in slot order, player first on the same slot
    for (let p = 0; p < 6; p++) for (const side of S) {
      const u = side.units[p];
      if (u && u.charge >= u.cd) { u.charge -= u.cd; cast(u, 1, null, t); }
    }
    // 3) per-second statuses
    if (tick % TPS === 0) {
      // rating dummy: a "par attacker" deals fixed damage per second (hits feel chill/weaken/expose, the rest pierces)
      for (const side of S) if (side.par) {
        const foe = S[1 - side.side], slow = 1 - side.chill / 100;
        damage(foe, side.par.hit * slow * (1 - side.weaken / 100) * (1 + foe.expose / 100), 'hit', false);
        damage(foe, side.par.pierce * slow, 'poison', true);
      }
      if (t > RULES.battleSeconds && !suddenOn) { suddenOn = true; for (const side of S) emit(side, 'sudden', {}); }
      for (const side of S) {
        const foe = S[1 - side.side];
        if (side.burn > 0.05) {
          const d = damage(side, side.burn, 'burn', false); credit(side.burnBy, side, d);
          side.burn *= 0.7; if (side.burn < 0.5) { side.burn = 0; side.burnBy.clear(); }
        }
        if (side.poison > 0) { const d = damage(side, side.poison * 0.33, 'poison', true); credit(side.poisonBy, side, d); }
        if (side.doom > 0) { side.doomT -= 1; if (side.doomT <= 0) { const boom = side.doom; const d = damage(side, boom, 'doom', true); credit(side.doomBy, side, d); side.doomBy.clear(); ev({ k: 'boom', s: side.side, v: boom }); emit(foe, 'doomBoom', { v: boom }); side.doom = 0; side.doomT = 0; } }
        for (const u of side.units) if (u && u.def.pas.regen) { actor = u; heal(side, val(u, 'regen', u.def.pas.regen, side), true); actor = null; }
        for (const k in DECAY) side[k] = Math.max(0, side[k] - DECAY[k] * (LINGER.includes(k) ? 1 - foe.linger / 100 : 1));
        if (t > RULES.battleSeconds && !side.par) {
          const n = t - RULES.battleSeconds;
          let drain = side.maxHp * RULES.suddenDeathRamp * n;
          drain *= Math.max(0, 1 - (side.bonus.sd || 0) / 100);
          damage(side, drain, 'sudden', true);
        }
        side.hpHist.push(side.hp); if (side.hpHist.length > 6) side.hpHist.shift();
      }
      if (t > RULES.battleSeconds && log) events.push({ k: 'sudden', n: t - RULES.battleSeconds });
    }
    // 4) once-per-battle saves if low but alive
    for (const side of S) {
      if (side.hp <= 0 || side.hp >= side.maxHp * 0.3) continue;
      if (side.rebirth && !side.rebirthUsed) { side.rebirthUsed = true; heal(side, side.maxHp * side.rebirth / 100, true); ev({ k: 'rebirth', s: side.side }); }
      if (side.wind && !side.windUsed) { side.windUsed = true; heal(side, side.maxHp * side.wind / 100, true); ev({ k: 'rebirth', s: side.side, wind: true }); }
      if (side.rally && !side.rallyUsed) { side.rallyUsed = true; actor = side.rally.by; heal(side, side.maxHp * side.rally.heal / 100, true); add(side, 'haste', side.rally.haste); actor = null; ev({ k: 'rebirth', s: side.side, rally: true }); }
      if (side.rewind && !side.rewindUsed && side.hpHist.length) { side.rewindUsed = true; const back = side.hpHist[0]; if (back > side.hp) { const ch = side.units.find(u => u && u.def.pas.rewind); actor = ch; heal(side, back - side.hp, true); actor = null; } ev({ k: 'rebirth', s: side.side, rewind: true }); }
    }
    if (log) { log.push(frame(t, S, events)); events = []; }
    // 5) end check
    if (S[0].hp <= 0 || S[1].hp <= 0) { winner = S[1].hp <= 0 ? 0 : 1; endT = t; break; }
  }
  if (winner === null) { endT = RULES.hardCapSeconds; winner = (S[0].hp / S[0].maxHp >= S[1].hp / S[1].maxHp) ? 0 : 1; }
  return {
    winner, t: endT, log,
    hp: [Math.max(0, S[0].hp), Math.max(0, S[1].hp)], maxHp: [S[0].maxHp, S[1].maxHp],
    dealt: [S[0].dmgDealt, S[1].dmgDealt], healed: [S[0].healed, S[1].healed],
    gains: S.map(x => x.units.map(u => (u ? u.gain : 0))), // permanent flat damage earned in this battle, per slot
    report: S.map(x => x.units.map(u => (u ? { dmg: Math.round(u.dealt), sup: Math.round(u.support), casts: u.casts } : null))),
  };
}

function frame(t, S, events) {
  return {
    t, ev: events,
    s: S.map(x => ({
      hp: x.hp, sh: x.shield, burn: x.burn, poison: x.poison, chill: x.chill, haste: x.haste,
      expose: x.expose, weaken: x.weaken, growth: x.growth, doom: x.doom, doomT: x.doomT, scrap: x.scrap,
      pressure: x.pressure, sleep: x.sleepT,
      ch: x.units.map(u => u ? Math.max(0, Math.min(1, u.charge / u.cd)) : 0),
      rp: x.units.map(u => (u ? u.ramp : 0)), pl: x.units.map(u => (u ? u.plus : 0)),
      ki: x.units.map(u => (u ? Math.round(u.ki * 10) / 10 : 0)), tr: x.units.map(u => (u ? u.trans > 0 : false)),
      dm: x.units.map(u => (u ? Math.round(u.dealt) : 0)),
    })),
  };
}

// ------------------------------------------------------------------ hidden team rating (ranked matchmaking)
// kill: seconds to empty a passive dummy with the team's own HP; survive: seconds lasted against a par attacker
// dealing hp/24 per second (75% hits, 25% piercing). rating = survive / kill. Only the ordering matters.
export function rateTeam(team) {
  const hp = team.maxHp;
  const dummy = { mons: [null, null, null, null, null, null], maxHp: hp, trinkets: [], avatar: null };
  const kill = simulate(team, dummy).t;
  const par = { mons: [null, null, null, null, null, null], maxHp: 1e9, trinkets: [], avatar: null, par: { hit: hp / 24 * 0.75, pierce: hp / 24 * 0.25 } };
  const survive = simulate(team, par).t;
  return { kill, survive, rating: Math.round(survive / kill * 1000) / 1000 };
}

// Battle-start stats for a team (used by the shop to show effective stats + where buffs come from)
export function previewTeam(team) {
  const side = makeSide(team, 0);
  return side.units.map(u => u && { atk: u.atk, pow: u.pow, spd: u.spd, src: u.src });
}
