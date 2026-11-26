// Pocketomon battle engine. Pure and deterministic (no randomness), runs in browser and Node.
// Clock ticks every 0.1s. Each tick: charge timers, mons that reach their cooldown cast in
// slot order (slot 1 player, slot 1 opponent, slot 2 player, ...), then the battle ends if a
// team is at 0 HP. Statuses tick once per second. Ties go to side A (the player).
import { MON, RULES, LV, FX, ECHO_KEYS, fxValue, trinketBonus, TRIGGERS, AURAS, inZone } from './data.js?v=0.6';

const DT = 0.1;
const TPS = 10; // ticks per second
const CAPS = { growth: 150, haste: 60, chill: 50, expose: 60, weaken: 40, scrap: 40, selfgrow: 200 };
const DECAY = { chill: 3, haste: 3, expose: 1.2, weaken: 1.2 }; // points lost per second

function makeUnit(inst, side, pos, team) {
  if (!inst) return null;
  const def = MON[inst.id];
  let atk = inst.atk, pow = inst.pow;
  const b = team.bonus;
  // buff sources are tracked so the UI can explain effective stats
  const src = [];
  const addSrc = (label, pct) => { if (pct) src.push({ label, atk: pct, pow: pct }); return pct; };
  let k = 1;
  k += addSrc(`${def.type[0].toUpperCase() + def.type.slice(1)} Charm`, b.type[def.type] || 0) / 100;
  if (pos === 0) k += addSrc('Leader Badge (slot 1)', b.slot1 || 0) / 100;
  if (pos === 5) k += addSrc('Rear Guard (slot 6)', b.slot6 || 0) / 100;
  if (pos === 0 && team.avatar === 'coach') k += addSrc('Coach Kip (slot 1)', 30) / 100;
  k += addSrc('World Seed', b.all || 0) / 100;
  atk *= k; pow *= k;
  return { side, pos, def, lvl: inst.lvl, atk, pow, cd: def.cd, charge: 0, ramp: 0, casts: 0, spd: 1, trig: TRIGGERS[def.id], plus: inst.plus || 0, gain: 0, src };
}

function makeSide(team, side) {
  const s = {
    side, maxHp: team.maxHp, hp: team.maxHp, shield: 0,
    burn: 0, poison: 0, chill: 0, haste: 0, expose: 0, weaken: 0, growth: 0,
    doom: 0, doomT: 0, scrap: 0, rebirth: 0, rebirthUsed: false,
    trinkets: team.trinkets || [], avatar: team.avatar, bonus: trinketBonus(team.trinkets), par: team.par || null,
    dmgDealt: 0, healed: 0,
  };
  s.units = [];
  for (let i = 0; i < 6; i++) s.units.push(makeUnit(team.mons[i], side, i, s));
  // ongoing positional auras (computed from base stats so auras don't feed each other)
  const mods = s.units.map(() => ({ atk: 0, pow: 0, spd: 0 }));
  for (const u of s.units) {
    const a = u && AURAS[u.def.id]; if (!a) continue;
    const k = LV.pct[u.lvl];
    for (const o of s.units) if (o && inZone(a.who, u.pos, o.pos)) {
      mods[o.pos].atk += (a.atk || 0) * k; mods[o.pos].pow += (a.pow || 0) * k; mods[o.pos].spd += (a.speed || 0) * k;
      o.src.push({ label: `${u.def.name} aura`, atk: (a.atk || 0) * k, pow: (a.pow || 0) * k, spd: (a.speed || 0) * k, from: u.pos });
    }
  }
  for (const o of s.units) if (o) { const m = mods[o.pos]; o.atk *= 1 + m.atk / 100; o.pow *= 1 + m.pow / 100; o.spd = 1 + m.spd / 100; o.aura = m; }
  s.prism = 1 + (s.bonus.fxp || 0) / 100;
  s.whet = 1 + (s.bonus.dmg || 0) / 100;
  s.wind = s.bonus.wind || 0; s.windUsed = false;
  return s;
}

// value of an effect for a unit (level + POW + prism), echo scale applied by caller
function val(u, key, base, side) {
  return fxValue(key, base, u.def, u.lvl, u.pow) * side.prism;
}

export function simulate(teamA, teamB, opts = {}) {
  const log = opts.log ? [] : null;
  const S = [makeSide(teamA, 0), makeSide(teamB, 1)];
  let events = [];
  const ev = (e) => { if (log) events.push(e); };

  const damage = (side, amt, kind, pierce) => {
    if (amt <= 0) return 0;
    if (kind !== 'hit' && kind !== 'sudden') amt *= 1 + side.expose / 100; // expose boosts all type damage too
    let a = amt;
    if (!pierce && side.shield > 0) { const ab = Math.min(side.shield, a); side.shield -= ab; a -= ab; if (ab > 0) ev({ k: 'absorb', s: side.side, v: ab }); }
    side.hp -= a;
    ev({ k: 'dmg', s: side.side, v: amt, kind });
    if (side.hp <= 0 && side.bonus.totem && !side.totemUsed) { // Undying Totem
      side.totemUsed = true; side.hp = 1; heal(side, side.maxHp * side.bonus.totem / 100, true); ev({ k: 'rebirth', s: side.side, totem: true });
    }
    if (!side.low50 && side.hp > 0 && side.hp < side.maxHp * 0.5) { side.low50 = true; emit(side, 'lowHp', {}); emit(S[1 - side.side], 'foeLow', {}); }
    return amt;
  };
  // ---- triggers: each mon fires at most once per chain, never from a copy of itself
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
      fireTrigger(u, data);
    }
    if (top) chain = null;
  }
  function fireTrigger(u, data) {
    const own = S[u.side], foe = S[1 - u.side], d = u.trig.do;
    ev({ k: 'trig', s: u.side, pos: u.pos });
    if (d.cast) { u.charge = 0; cast(u, 1, null); return; }
    if (d.multicast) { u.charge = 0; for (let k = 0; k < d.multicast; k++) cast(u, 1, null); return; }
    if (d.plus) { const g = d.plus * u.lvl; u.plus += g; u.gain += g; return; } // permanent: written back to the run after battle
    if (d.fx) for (const [k, v] of Object.entries(d.fx)) applyFx(u, own, foe, k, v, 1, 0);
    if (d.pct) {
      const x = (data.v || 0) * d.v / 100 * u.pow * own.prism;
      if (d.pct === 'dmg') own.dmgDealt += damage(foe, x, 'hit', false);
      if (d.pct === 'heal') heal(own, x, true);
      if (d.pct === 'shield') addShield(own, x);
    }
  }
  // healing past max HP overflows into shield at half value
  const heal = (side, amt, noOverflow) => {
    if (amt <= 0) return 0;
    const h = Math.min(amt, side.maxHp - side.hp);
    side.hp += h; side.healed += h;
    ev({ k: 'heal', s: side.side, v: amt });
    if (!noOverflow && amt > h) { const g = Math.min(side.maxHp * RULES.shieldCap, side.shield + (amt - h) * 0.5) - side.shield; side.shield += g; if (g > 0) emit(side, 'shieldGain', { v: g }); }
    emit(side, 'healed', { v: amt });
    return h;
  };
  const addShield = (side, amt) => {
    const cap = side.maxHp * RULES.shieldCap;
    const g = Math.min(cap, side.shield + amt) - side.shield;
    side.shield += g;
    ev({ k: 'shield', s: side.side, v: amt });
    if (g > 0) emit(side, 'shieldGain', { v: g });
  };
  const add = (side, key, v) => { side[key] = Math.min(CAPS[key] ?? 1e9, side[key] + v); };

  // Effects (non-damage). scale = echo scale
  function applyFx(u, own, foe, key, base, scale, dealt) {
    const v = val(u, key, base, own) * scale;
    switch (key) {
      case 'burn': foe.burn += v; ev({ k: 'fx', fx: 'burn', s: foe.side, v }); break;
      case 'poison': foe.poison += v; ev({ k: 'fx', fx: 'poison', s: foe.side, v }); break;
      case 'stoke': { const x = foe.burn * v / 100; foe.burn += x; ev({ k: 'fx', fx: 'stoke', s: foe.side, v: x }); break; }
      case 'spread': { const x = foe.poison * v / 100; foe.poison += x; ev({ k: 'fx', fx: 'spread', s: foe.side, v: x }); break; }
      case 'heal': {
        let h = v;
        if (u.def.fx.lowheal && own.hp < own.maxHp * 0.5) h *= 1 + val(u, 'lowheal', u.def.fx.lowheal, own) / 100;
        heal(own, h); break;
      }
      case 'cleanse': {
        let c = v; const b = Math.min(own.burn, c); own.burn -= b; c -= b;
        own.poison = Math.max(0, own.poison - c);
        ev({ k: 'fx', fx: 'cleanse', s: own.side, v }); break;
      }
      case 'shield': addShield(own, v); break;
      case 'growth': add(own, 'growth', v); ev({ k: 'fx', fx: 'growth', s: own.side, v }); break;
      case 'selfgrow': u.ramp = Math.min(CAPS.selfgrow, u.ramp + v); ev({ k: 'fx', fx: 'selfgrow', s: own.side, pos: u.pos, v }); break;
      case 'haste': add(own, 'haste', v); ev({ k: 'fx', fx: 'haste', s: own.side, v }); break;
      case 'chill': add(foe, 'chill', v); ev({ k: 'fx', fx: 'chill', s: foe.side, v }); break;
      case 'expose': add(foe, 'expose', v); ev({ k: 'fx', fx: 'expose', s: foe.side, v }); break;
      case 'weaken': add(foe, 'weaken', v); ev({ k: 'fx', fx: 'weaken', s: foe.side, v }); break;
      case 'doom': foe.doom += v; if (foe.doomT <= 0) foe.doomT = 5; ev({ k: 'fx', fx: 'doom', s: foe.side, v }); break;
      case 'scrap': add(own, 'scrap', v); ev({ k: 'fx', fx: 'scrap', s: own.side, v }); break;
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
        if (t) { t.charge = Math.max(-2, t.charge - v); ev({ k: 'fx', fx: 'freeze', s: foe.side, pos: t.pos, v }); }
        break;
      }
      case 'freezeTop': {
        let t = null;
        for (const o of foe.units) if (o && (!t || o.charge / o.cd > t.charge / t.cd)) t = o;
        if (t) { t.charge = Math.max(-2, t.charge - v); ev({ k: 'fx', fx: 'freeze', s: foe.side, pos: t.pos, v }); }
        break;
      }
      case 'freezeAll':
        for (const o of foe.units) if (o) o.charge = Math.max(-2, o.charge - v);
        ev({ k: 'fx', fx: 'freeze', s: foe.side, v }); break;
      case 'lifesteal': if (dealt > 0) heal(own, dealt * v / 100, true); break;
      default: break; // bash, execute, scrapper, lowheal, echo*: handled elsewhere
    }
  }

  // echo target on the grid: the ally in front / behind that isn't an echo mon
  const isEcho = (o) => ECHO_KEYS.some(k => o.def.fx[k]);
  function findEchoTarget(own, from, who) {
    for (const o of own.units) if (o && !isEcho(o) && inZone(who, from, o.pos)) return o;
    return null;
  }


  function cast(u, scale, echoed, t) {
    const own = S[u.side], foe = S[1 - u.side];
    const d = u.def, fx = d.fx;
    ev({ k: 'cast', s: u.side, pos: u.pos, echo: !!echoed, by: echoed ? echoed.pos : undefined });
    // ---- direct hit
    let base = fxValue('dmg', d.dmg, d, u.lvl, u.atk) + u.plus;
    if (d.type === 'junk' && own.scrap > 0) base += own.scrap * 0.4 * LV.dmg[u.lvl] * (1 + (fx.scrapper ? val(u, 'scrapper', fx.scrapper, own) / 100 : 0));
    if (fx.bash) base += own.shield * val(u, 'bash', fx.bash, own) / 100;
    let mult = (1 + own.growth / 100 + u.ramp / 100) * (1 + foe.expose / 100) * (1 - own.weaken / 100) * own.whet;
    if (own.bonus.rage && own.hp < own.maxHp * 0.5) mult *= 1 + own.bonus.rage / 100;
    if (fx.execute && foe.hp < foe.maxHp * 0.3) mult *= 1 + val(u, 'execute', fx.execute, own) / 100;
    const dealt = damage(foe, base * mult * scale, 'hit', false);
    own.dmgDealt += dealt;
    // ---- effects in definition order
    for (const key of Object.keys(fx)) applyFx(u, own, foe, key, fx[key], scale, dealt);
    u.casts++;
    // ---- echoes (never chain)
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
      if (own.bonus.mirror) cast(u, scale * own.bonus.mirror / 100, u, t); // Mirror of Echoes (never chains)
    }
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
      for (const [key, base] of Object.entries(pas.start)) applyFx(u, side, foe, key, base, 1, 0);
      ev({ k: 'cast', s: side.side, pos: p, start: true });
    }
  }
  for (const side of S) if (side.bonus.shield) addShield(side, side.maxHp * side.bonus.shield / 100);
  for (const side of S) if (side.bonus.sunburn) S[1 - side.side].burn += S[1 - side.side].maxHp * side.bonus.sunburn / 100; // Second Sun
  if (log) { log.push(frame(0, S, events)); events = []; }

  const speed = (side, t) => {
    let h = 1 + side.haste / 100;
    h += (side.bonus.speed || 0) / 100;
    if (t < 4) h += (side.bonus.open || 0) / 100;
    return Math.max(0.3, h * (1 - side.chill / 100));
  };

  let tick = 0, winner = null, endT = 0, suddenOn = false;
  const maxTicks = RULES.hardCapSeconds * TPS;
  while (tick < maxTicks) {
    tick++;
    const t = tick / TPS;
    // 1) charge
    for (const side of S) { const sp = speed(side, t) * DT; for (const u of side.units) if (u) u.charge += sp * u.spd; }
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
        if (side.burn > 0.05) { damage(side, side.burn, 'burn', false); side.burn *= 0.7; if (side.burn < 0.5) side.burn = 0; }
        if (side.poison > 0) damage(side, side.poison * 0.33, 'poison', true);
        if (side.doom > 0) { side.doomT -= 1; if (side.doomT <= 0) { const boom = side.doom; damage(side, boom, 'doom', true); ev({ k: 'boom', s: side.side, v: boom }); emit(S[1 - side.side], 'doomBoom', { v: boom }); side.doom = 0; side.doomT = 0; } }
        for (const u of side.units) if (u && u.def.pas.regen) heal(side, val(u, 'regen', u.def.pas.regen, side), true);
        for (const k in DECAY) side[k] = Math.max(0, side[k] - DECAY[k]);
        if (t > RULES.battleSeconds && !side.par) {
          const n = t - RULES.battleSeconds;
          let drain = side.maxHp * RULES.suddenDeathRamp * n;
          drain *= Math.max(0, 1 - (side.bonus.sd || 0) / 100);
          damage(side, drain, 'sudden', true);
        }
      }
      if (t > RULES.battleSeconds && log) events.push({ k: 'sudden', n: t - RULES.battleSeconds });
    }
    // 4) rebirth (once) if low but alive
    for (const side of S) if (side.rebirth && !side.rebirthUsed && side.hp > 0 && side.hp < side.maxHp * 0.3) {
      side.rebirthUsed = true; heal(side, side.maxHp * side.rebirth / 100, true); ev({ k: 'rebirth', s: side.side });
    }
    for (const side of S) if (side.wind && !side.windUsed && side.hp > 0 && side.hp < side.maxHp * 0.3) {
      side.windUsed = true; heal(side, side.maxHp * side.wind / 100, true); ev({ k: 'rebirth', s: side.side, wind: true });
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
  };
}

function frame(t, S, events) {
  return {
    t, ev: events,
    s: S.map(x => ({
      hp: x.hp, sh: x.shield, burn: x.burn, poison: x.poison, chill: x.chill, haste: x.haste,
      expose: x.expose, weaken: x.weaken, growth: x.growth, doom: x.doom, doomT: x.doomT, scrap: x.scrap,
      ch: x.units.map(u => u ? Math.max(0, Math.min(1, u.charge / u.cd)) : 0),
      rp: x.units.map(u => (u ? u.ramp : 0)), pl: x.units.map(u => (u ? u.plus : 0)),
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
