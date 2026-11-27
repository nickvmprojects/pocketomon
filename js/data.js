// Pocketomon — game data. All numbers are first-pass and tuned by tools/gen.mjs.
export const VERSION = '0.7.6';

export const RULES = {
  battleSeconds: 30,       // regular time
  hardCapSeconds: 60,      // safety cap (sudden death almost always ends it sooner)
  suddenDeathRamp: 0.015,  // drain = maxHp * ramp * secondsIntoSuddenDeath, every second
  teamSlots: 6,
  benchSlots: 4,
  shopSlots: 5,
  startLives: 5,
  winsToChampion: 10,
  rerollCost: 3,
  typesPerRun: 10,        // v0.7: every dimension is in every run
  copyBias: 0.2,
  highLvlOdds: 0.25,       // v0.7.6: shop weight of beings you own at level 3+           // chance a shop slot shows a copy of a mon you own
  shieldCap: 0.5,          // shield can't exceed 50% of max HP
};

export const teamHp = (day) => 150 + 50 * day + 12 * day * day; // curve B: 212, 298, 408, ... 1850 on day 10
export const income = (day) => Math.min(30 + 10 * day, 90);   // 40, 50, ... capped at 90 from day 6
// Shop price = 10 x tier, then -5 / 0 / +5 by how strong the mon is (COST_ADJ), so prices end in 0 or 5
export const price = (def) => 10 * def.tier + (COST_ADJ[def.id] || 0);
export const sellPerCopy = (def) => Math.floor(price(def) / 2);

// chance of each tier (1..5) showing in the shop, by day
export const TIER_WEIGHTS = [
  null,
  [1],
  [0.75, 0.25],
  [0.6, 0.4],
  [0.45, 0.4, 0.15],
  [0.35, 0.4, 0.25],
  [0.25, 0.35, 0.3, 0.1],
  [0.2, 0.3, 0.3, 0.2],
  [0.15, 0.25, 0.3, 0.2, 0.1],
  [0.1, 0.2, 0.3, 0.25, 0.15],
  [0.08, 0.15, 0.27, 0.3, 0.2],
];
export const tierWeights = (day) => TIER_WEIGHTS[Math.min(day, TIER_WEIGHTS.length - 1)];
export const maxTier = (day) => tierWeights(day).length;

// level multipliers: [_, L1, L2, L3]
export const LV = {
  dmg: [0, 1, 1.6, 2.4],
  fx: [0, 1, 1.5, 2.1],
  sec: [0, 1, 1.3, 1.6],
  pct: [0, 1, 1.5, 2.0],
};
// v0.7.6: levels past 3 (each extra copy after level 3 adds a level, no cap). Growth per level keeps going, a bit slower.
export const MAX_LVL = 99;
const LV_STEP = { dmg: 0.6, fx: 0.45, sec: 0.2, pct: 0.35 };
for (const k of Object.keys(LV)) for (let n = 4; n <= MAX_LVL; n++) LV[k][n] = Math.round((LV[k][3] + LV_STEP[k] * (n - 3)) * 100) / 100;
// flat amounts (hits, burn, heal, shield, poison, doom, regen) are compressed by tier so
// late-game fights don't end in 5 seconds while day 1 fights still finish in time
export const TIER_SCALE = [0, 1, 1, 1, 1, 1]; // v0.7: tier numbers are written directly in the roster
// damage tuning by tier (hits, burn, poison, doom): keeps fights short without touching heals and shields
export const DMG_SCALE = [0, 1.8, 1.75, 1.9, 2.05, 2.2];
const DMG_KEYS = ['burn', 'poison', 'doom'];
// def = the mon definition (tier + id for TUNE)
export function fxValue(key, base, def, lvl, pow = 1) {
  const sc = FX[key] ? FX[key].scale : 'fx';
  if (sc === 'lvl') return base * lvl;
  if (sc === 'flat') return base;
  const lv = sc === 'dmg' ? LV.dmg : sc === 'sec' ? LV.sec : sc === 'pct' ? LV.pct : LV.fx;
  const flat = sc === 'dmg' || sc === 'fx';
  const dk = sc === 'dmg' || DMG_KEYS.includes(key) ? DMG_SCALE[def.tier] : 1;
  return base * lv[lvl] * pow * (flat ? TIER_SCALE[def.tier] : 1) * dk * (TUNE[def.id] || 1);
}
export const TIER_POWER = [0, 10, 14, 19, 25, 32];
export const LV_POWER = [0, 1, 1.8, 2.8];
for (let n = 4; n <= 99; n++) LV_POWER[n] = Math.round((2.8 + 0.7 * (n - 3)) * 100) / 100;

// ---- v0.7 multiverse: 10 dimensions replace types. The `type` field on a being holds its dimension key.
export const TYPES = {
  fallen:  { name: 'Fallen Earth',   icon: '🛸', color: '#9be04a', dark: '#3d5a14', mech: 'Last Stand', blurb: 'Humans and stolen alien tech after the invasion. Stronger the closer your team is to falling.' },
  martial: { name: 'Martial Realm',  icon: '🥋', color: '#ff5a4a', dark: '#8a1e14', mech: 'Ki',         blurb: 'Fighters gain Ki with every cast. At 5 Ki they Transform: +50% ATK and POW for 6s.' },
  zodiac:  { name: 'Zodiac',         icon: '✨', color: '#ffc94a', dark: '#6e4a0a', mech: 'Alignment',  blurb: 'Living stars of the four elements. Next to a being of the same element they are Aligned: +20% ATK and POW.' },
  giants:  { name: 'Age of Giants',  icon: '🦖', color: '#d9a066', dark: '#6b3f16', mech: 'Hunt',       blurb: 'Hunters of the 1500s and the giant beasts they chase. Hunters get stronger with Giants on the team.' },
  elven:   { name: 'Elvenwood',      icon: '🏹', color: '#a98cff', dark: '#3e2a8a', mech: 'Harmony',    blurb: 'Moonlit night elves and forest spirits: archer volleys, healing and growth.' },
  necro:   { name: 'Necro Machines', icon: '🤖', color: '#ff2a4a', dark: '#6a0a1a', mech: 'Assimilate', blurb: 'Machines of terrible power that drain the strength of their own allies.' },
  junk:    { name: 'Junkverse',      icon: '🗑️', color: '#c9a878', dark: '#5a4426', mech: 'Scrap',      blurb: 'Scrap piles up during battle and makes every Junkverse being hit harder.' },
  abyss:   { name: 'The Abyss',      icon: '🦑', color: '#3ff2ff', dark: '#0a4a5a', mech: 'Pressure',   blurb: 'Deep sea horrors. Pressure stacks on the enemy and never fades; some beings cash it in.' },
  dream:   { name: 'Dreamscape',     icon: '🌙', color: '#ff9cd8', dark: '#7a2a6a', mech: 'Sleep',      blurb: 'Sleep, confusion and curses. Sleeping enemies lose time and take extra damage.' },
  clock:   { name: 'Clockwork City', icon: '⚙️', color: '#6fb0ff', dark: '#1a4a8a', mech: 'Tempo',      blurb: 'Gears and springs: haste, charge, echoes and repeat casts.' },
};
export const TYPE_KEYS = Object.keys(TYPES);
export const TAGS = { hunter: '🎯 Hunter', giant: '🦣 Giant', archer: '🏹 Archer' };
export const ELEMENTS = { fire: '🔥 Fire', earth: '🪨 Earth', air: '🌪️ Air', water: '💧 Water', all: '🌈 Every element' };
export const ROLES = { dmg: 'Damage', carry: 'Late carry', support: 'Support', enabler: 'Enabler' };

// m(id, name, dimension, tier, cooldown, hit, effects, passives, role, text, flavor, extra)
// text: in-game description. {key} = that number at the being's level and rolls, **Word** = keyword with a popup.
// extra: tags [hunter|giant|archer], el (zodiac element), hits (split hit), lowX2, vsChill, vsBurn, immune, transTwice
const m = (id, name, type, tier, cd, dmg, fx = {}, pas = {}, role = 'dmg', text = '', flavor = '', x = {}) => ({ id, name, type, tier, cd, dmg, fx, pas, role, text, flavor, x });

export const MONS = [
  // ---------------- FALLEN EARTH ----------------
  m('skulldrone', 'Scout Skull-Drone', 'fallen', 1, 3, 18, {}, {}, 'dmg', 'Zaps for {dmg}.', 'Scans, targets, zaps. Repeat.'),
  m('tinfoil', 'Tinfoil Tom', 'fallen', 1, 4, 4, { shield: 12 }, {}, 'support', 'Hits for {dmg} and gives a **Shield** of {shield}. Doubled while your team is under 50% HP.', 'Knew they were coming. Nobody listened.', { lowX2: 1 }),
  m('meowma', 'Meowma, Cat Lady', 'fallen', 2, 4, 24, { expose: 12 }, {}, 'dmg', 'Stolen ray gun: {dmg} and **Expose** {expose}%.', 'Eleven cats and one alien blaster.'),
  m('rosa', 'Bunker Medic Rosa', 'fallen', 2, 5, 6, { heal: 40 }, {}, 'support', 'Hits for {dmg}. **Heals** {heal}.', 'Patches people up with duct tape and hope.'),
  m('pyra', 'Pyra, Fire Fairy', 'fallen', 3, 4, 12, { burn: 12 }, {}, 'dmg', 'Hits for {dmg} and **Burn** {burn}. +50% against **Chilled** enemies.', 'Half of an alien experiment. The hot half.', { vsChill: 50 }),
  m('frost', 'Frost, Ice Fairy', 'fallen', 3, 5, 10, { chill: 16 }, {}, 'support', 'Hits for {dmg} and **Chill** {chill}%. Hits 25 harder against **Burning** enemies.', 'The other half. Never far from her sister.', { vsBurn: 25 }),
  m('grimhorn', 'Grimhorn, Goat Wizard', 'fallen', 4, 6, 12, { haste: 12 }, {}, 'enabler', 'Hits for {dmg} and **Haste** {haste}%. Doubled while your team is under 50% HP.', 'Learned magic from an alien textbook. Ate the textbook.', { lowX2: 1 }),
  m('skarr', 'Skarr, Lizard Man', 'fallen', 4, 5, 40, { lastStand: 100 }, {}, 'carry', 'Claw for {dmg}. **Last Stand**: up to +{lastStand}% damage as your team loses HP.', 'Mutated, furious, and on your side. Mostly.'),
  m('brick', 'Brick, Last Champion & Sarge', 'fallen', 5, 8, 36, {}, { rally: { heal: 25, haste: 40 } }, 'enabler', 'Punch for {dmg}. Once, when your team drops under 30%: heals 25% HP and **Haste** 40%.', 'The strongest human alive. Sarge the cat is in charge.'),
  m('mothership', 'Hijacked Mothership', 'fallen', 5, 8, 20, { overclock: 1 }, {}, 'enabler', 'Beam for {dmg}. **Overclock**: every ally\'s next cast happens twice.', 'Under new management.'),

  // ---------------- MARTIAL REALM (every Martial being gains 1 Ki per cast) ----------------
  m('pip', 'Tiny Fist Pip', 'martial', 1, 3, 16, {}, {}, 'dmg', 'Punch for {dmg}. Gains 1 **Ki** per cast.', 'Still in diapers. Already a black belt.'),
  m('bao', 'Iron Bao, Dojo Dummy', 'martial', 1, 4, 4, { shield: 12, ki: 0.5 }, {}, 'support', 'Hits for {dmg}, **Shield** {shield}, and all allies gain {ki} **Ki**.', 'Has taken a million punches. Still smiling.'),
  m('kite', 'Captain Kite', 'martial', 2, 3.5, 24, {}, {}, 'dmg', 'Caped dash for {dmg}. While **Transformed**, hits twice.', 'The cape does nothing. He insists it does.', { transTwice: 1 }),
  m('sora', 'Monk Sora', 'martial', 2, 5, 4, { heal: 20, ki: 1 }, {}, 'support', 'Hits for {dmg}, **Heals** {heal}, and all allies gain {ki} **Ki**.', 'Meditates mid-battle. Somehow it helps.'),
  m('rhea', 'Thunder-Step Rhea', 'martial', 3, 4, 15, { ki: 1 }, {}, 'enabler', 'Palm strike hits twice for {dmg}. All allies gain {ki} **Ki**.', 'Arrives before the thunder does.', { hits: 2 }),
  m('gorran', 'Stone Sage Gorran', 'martial', 3, 6, 8, { weaken: 20 }, {}, 'support', 'Hits for {dmg} and **Weaken** {weaken}%.', 'Has not moved in forty years. Then he did.'),
  m('ashi', 'Mirror Stance Ashi', 'martial', 4, 6, 10, { copyLast: 60 }, {}, 'enabler', 'Hits for {dmg}, then copies the last ally cast at {copyLast}% power.', 'Fights in your style. Better than you.'),
  m('hoshi', 'Old Master Hoshi', 'martial', 4, 7, 14, { ki: 1 }, { train: 5 }, 'enabler', 'Hits for {dmg} and all allies gain {ki} **Ki**. Each time an ally **Transforms**, it keeps +5% ATK and POW for the battle.', 'Training never ends. Not even mid-fight.'),
  m('willow', 'Grandmaster Willow', 'martial', 5, 8, 24, { ki: 1 }, { start: { ki: 3 }, kiLong: 1 }, 'enabler', 'Hits for {dmg} and all allies gain {ki} **Ki**. All allies start with 3 Ki, and **Transformations** last twice as long.', 'Bends like a willow. Hits like a falling tree.'),
  m('ryo', 'Ascended Ryo', 'martial', 5, 6, 30, { kinova: 4 }, {}, 'carry', '**Ki** Nova: {dmg}, +{kinova} for every Ki your team gained this battle.', 'Went past the limit and kept going.'),

  // ---------------- ZODIAC (Aligned: +20% ATK and POW next to a same-element being) ----------------
  m('aries', 'Aries Ember', 'zodiac', 1, 3, 15, { frontRow: 30 }, {}, 'dmg', 'Flare for {dmg}, +{frontRow}% in the front row.', 'A newborn star with a very short fuse.', { el: 'fire' }),
  m('pisces', 'Pisces Tidelight', 'zodiac', 1, 4, 4, { heal: 14, cleanse: 8 }, {}, 'support', 'Hits for {dmg}, **Heals** {heal} and **Cleanses** {cleanse}.', 'Two glowing fish orbiting a puddle of starlight.', { el: 'water' }),
  m('gemini', 'Gemini Twin Comets', 'zodiac', 2, 4, 14, {}, {}, 'dmg', 'Two comets hit for {dmg} each.', 'They finish each other\'s orbits.', { el: 'air', hits: 2 }),
  m('taurus', 'Taurus Planetoid', 'zodiac', 2, 5, 6, { shield: 30 }, {}, 'support', 'Hits for {dmg} and gives a **Shield** of {shield}.', 'A small planet with horns. Very stubborn gravity.', { el: 'earth' }),
  m('scorpio', 'Scorpio Pulsar', 'zodiac', 3, 4, 8, { poison: 12 }, {}, 'dmg', 'Hits for {dmg} and **Poison** {poison}.', 'Blinks once a second. Stings on every blink.', { el: 'water' }),
  m('libra', 'Libra Binary Star', 'zodiac', 3, 6, 8, { balance: 3 }, {}, 'support', 'Hits for {dmg}. If the enemy has more HP% than you, deals {balance} per % of the gap; otherwise heals that much.', 'Two stars keeping each other honest.', { el: 'air' }),
  m('sagittarius', 'Sagittarius Meteorbow', 'zodiac', 4, 6, 20, { perAlign: 20 }, {}, 'carry', 'Meteor for {dmg}, +{perAlign} for each **Aligned** pair on your team.', 'Its arrows arrive a few million years late. Worth it.', { el: 'fire' }),
  m('virgo', 'Virgo Starseed', 'zodiac', 4, 6, 8, { growth: 6 }, {}, 'enabler', 'Hits for {dmg} and **Growth** {growth}%. Counts as every element for **Alignment**.', 'Plants stars the way others plant seeds.', { el: 'all' }),
  m('leo', 'Leo Paragon', 'zodiac', 5, 8, 24, { shield: 20 }, { shieldCap: 75 }, 'enabler', 'Hits for {dmg} and gives a **Shield** of {shield}. Your **Shield** can reach 75% of team HP instead of 50%.', 'A sun that decided to wear a mane.', { el: 'fire' }),
  m('ophiuchus', 'Ophiuchus, 13th Sign', 'zodiac', 5, 7, 20, { burst: 60 }, {}, 'carry', '**Cosmic Burst**: {dmg} plus {burst}% of your **Shield**, then the shield is used up.', 'The sign nobody talks about. It remembers.'),

  // ---------------- AGE OF GIANTS ----------------
  m('brann', 'Brann the Hunter', 'giants', 1, 3, 13, { perGiant: 5 }, {}, 'dmg', 'Shot for {dmg}, +{perGiant} for each **Giant** on your team.', 'Has hunted bigger. Has never hunted smaller.', { tags: ['hunter'] }),
  m('ilse', 'Rope-Setter Ilse', 'giants', 1, 4, 6, { chill: 12 }, {}, 'support', 'Snare for {dmg} and **Chill** {chill}%.', 'Ties knots that hold mammoths.', { tags: ['hunter'] }),
  m('bertha', 'Big Bertha, Giant Hen', 'giants', 2, 5, 8, { heal: 30 }, {}, 'support', 'Pecks for {dmg}, then lays an egg: **Heals** {heal}.', 'One egg feeds a village for a week.', { tags: ['giant'] }),
  m('harpoon', 'Harpoon Crew', 'giants', 2, 4, 30, {}, {}, 'dmg', 'Harpoon for {dmg}.', 'Three hunters, one very large spear.', { tags: ['hunter'] }),
  m('oldtusk', 'Old Tusk, Giant Mammoth', 'giants', 3, 6, 20, { shield: 35 }, {}, 'support', 'Stomp for {dmg} and a **Shield** of {shield}.', 'Every hunter knows him. None have caught him.', { tags: ['giant'] }),
  m('mara', 'Beast Tamer Mara', 'giants', 3, 5, 12, {}, {}, 'enabler', 'Whip for {dmg}.', 'Speaks fluent mammoth.', { tags: ['hunter'] }),
  m('dunemaw', 'Dune Maw, Sand Worm', 'giants', 4, 7, 40, { strip: 100 }, {}, 'enabler', 'Swallow: {dmg}, removes {strip}% of the enemy **Shield** and their **Growth** and **Haste**.', 'The desert is just its stomach lining.', { tags: ['giant'] }),
  m('hale', 'Fort Captain Hale', 'giants', 4, 6, 8, { shield: 25, shieldPerHunter: 10 }, {}, 'support', 'Hits for {dmg} and a **Shield** of {shield}, +{shieldPerHunter} for each **Hunter** on your team.', 'Built the wall. Holds the wall.', { tags: ['hunter'] }),
  m('rexalon', 'Rexalon, Dragon-Tyrant', 'giants', 5, 8, 70, { burn: 20 }, {}, 'carry', 'Firestorm for {dmg} and **Burn** {burn}.', 'Here be dragons. Specifically, this one.', { tags: ['giant'] }),
  m('isolde', 'Hunt Queen Isolde', 'giants', 5, 8, 20, { expose: 35 }, {}, 'enabler', 'Marks the prey: {dmg} and **Expose** {expose}%.', 'Has a trophy wall the size of a cathedral.', { tags: ['hunter'] }),

  // ---------------- ELVENWOOD ----------------
  m('lirien', 'Lirien, Elf Archer', 'elven', 1, 3, 15, { volleyAdj: 100 }, {}, 'dmg', 'Arrow for {dmg}, +{volleyAdj}% for each adjacent **Archer**.', 'Never misses. Never lets you forget it.', { tags: ['archer'] }),
  m('mosswhisper', 'Mosswhisper Sprite', 'elven', 1, 4, 4, { heal: 10, growth: 3 }, {}, 'support', 'Hits for {dmg}, **Heals** {heal} and **Growth** {growth}%.', 'Whispers to moss. The moss whispers back.'),
  m('kaelen', 'Kaelen & Shade', 'elven', 2, 3.5, 25, {}, {}, 'dmg', 'Pounce for {dmg}. Immune to **Chill** and **Sleep**.', 'A night elf and a panther who never sleeps.', { immune: 1 }),
  m('grovesinger', 'Grove Singer', 'elven', 2, 5, 4, { heal: 10 }, { regen: 4 }, 'support', 'Hits for {dmg} and **Heals** {heal}. Your team heals {regen} every second.', 'Sings the old songs. The trees hum along.'),
  m('thornhoof', 'Thornhoof, Minotaur Druid', 'elven', 3, 6, 10, { chill: 12, heal: 30 }, {}, 'support', 'Roots for {dmg}: **Chill** {chill}% and **Heals** {heal}.', 'Gentle, unless you step on the flowers.'),
  m('windrunner', 'Windrunner Captain', 'elven', 3, 4, 10, {}, {}, 'dmg', 'Volley: 3 arrows of {dmg}.', 'Commands the archers. Outshoots them too.', { tags: ['archer'], hits: 3 }),
  m('elderbark', 'Elderbark Golem', 'elven', 4, 7, 14, { growth: 10 }, {}, 'enabler', 'Hits for {dmg} and **Growth** {growth}%.', 'Half rock, half tree, all patience.'),
  m('ysil', 'Moon Priestess Ysil', 'elven', 4, 6, 6, { heal: 30 }, { overheal: 1 }, 'enabler', 'Hits for {dmg} and **Heals** {heal}. Your overhealing becomes **Shield** at full value instead of half.', 'Prays to the moon. The moon answers.'),
  m('aelyth', 'Princess Aelyth & Snowpaw', 'elven', 5, 8, 24, { volley: 1, healPct: 6 }, {}, 'enabler', 'Royal Hunt: {dmg}, every ally **Archer** casts right away, and **Heals** {healPct}% of team HP.', 'Rides a white tiger. The tiger chose her.'),
  m('worldtree', 'World Tree Seedling', 'elven', 5, 8, 10, { growth: 12 }, { auraX2: 1 }, 'enabler', 'Hits for {dmg} and **Growth** {growth}%. All ally **Auras** are twice as strong.', 'Small now. Give it ten thousand years.'),

  // ---------------- NECRO MACHINES ----------------
  m('nx1', 'Unit NX-1', 'necro', 1, 3, 30, {}, {}, 'dmg', 'Laser for {dmg}. **Assimilate**: your other beings get -10% ATK and POW.', 'Step one of the plan. There are many steps.'),
  m('leech', 'Scrap Leech', 'necro', 1, 4, 6, { drain: 5 }, {}, 'support', 'Hits for {dmg}, drains {drain}% of your own team HP and gives twice that as **Shield**.', 'Feeds on its friends. Gives some back.'),
  m('reaper', 'Reaper Drone', 'necro', 2, 4, 50, { selfHurt: 3 }, {}, 'dmg', 'Scythe for {dmg}. Costs {selfHurt}% of your team HP.', 'Efficient. Ruthless. Slightly suicidal.'),
  m('siphon', 'Siphon Pylon', 'necro', 2, 5, 22, { strip: 20 }, {}, 'enabler', 'Hits for {dmg} and removes {strip}% of the enemy **Shield**. **Assimilate**: your other beings get -10% ATK and POW.', 'Drinks shields like soda.'),
  m('harvester', 'Harvester Mk3', 'necro', 3, 4.5, 75, {}, {}, 'dmg', 'Grinder for {dmg}. **Assimilate**: adjacent allies get -50% ATK and POW.', 'Do not stand next to it. Seriously.'),
  m('graft', 'Graft Surgeon', 'necro', 3, 6, 8, { heal: 40, sapGrowth: 10 }, {}, 'support', 'Hits for {dmg} and **Heals** {heal}, but removes {sapGrowth}% of your **Growth**.', 'Fixes you with parts of your friends.'),
  m('dreadnought', 'Dreadnought KV-9', 'necro', 4, 6, 150, {}, {}, 'carry', 'Cannon for {dmg}. **Assimilate**: your other beings get -50% ATK and POW.', 'A battleship that learned to walk.'),
  m('nullcore', 'Null Core', 'necro', 4, 7, 10, { doom: 70, selfHurt: 5 }, {}, 'enabler', 'Hits for {dmg} and **Doom** {doom}. Costs {selfHurt}% of your team HP.', 'A hole where a heart should be.'),
  m('omega', 'Omega Necroframe', 'necro', 5, 8, 120, {}, { absorb: 40 }, 'carry', 'Annihilate for {dmg}. **Assimilate**: your other beings get -60% ATK and POW, and Omega gets +40% for each of them.', 'The final step of the plan.'),
  m('mainframe', 'The Mainframe', 'necro', 5, 8, 16, { haste: 10 }, { mainframe: 30 }, 'enabler', 'Hits for {dmg} and **Haste** {haste}%. Allies weakened by **Assimilate** act 30% faster.', 'Runs everything. Asks nothing. Takes everything.'),

  // ---------------- JUNKVERSE (every Junkverse being hits harder per Scrap) ----------------
  m('binkle', 'Binkle', 'junk', 1, 3, 15, { scrap: 1 }, {}, 'dmg', 'Throws junk for {dmg} and adds {scrap} **Scrap**.', 'Has a collection. Do not call it trash.'),
  m('magpie', 'Magpie Mo', 'junk', 1, 4, 4, { shield: 10 }, {}, 'support', 'Hits for {dmg} and gives a **Shield** of {shield}.', 'Steals shiny things. Sometimes useful ones.'),
  m('dora', 'Duct-Tape Dora', 'junk', 2, 5, 4, { heal: 15, healPerScrap: 4 }, {}, 'support', 'Hits for {dmg} and **Heals** {heal}, +{healPerScrap} for each **Scrap**.', 'If it moves and it shouldn\'t: duct tape.'),
  m('clanker', 'Clanker Cannon', 'junk', 2, 4, 30, { spendScrap: 60 }, {}, 'dmg', 'Shot for {dmg}. Spends 1 **Scrap** for +{spendScrap}%.', 'Loads anything. Has loaded a fridge.'),
  m('rhino', 'Rustbucket Rhino', 'junk', 3, 5, 20, { shieldPerTrinket: 5 }, {}, 'support', 'Bash for {dmg} and a **Shield** of {shieldPerTrinket} per trinket you own.', 'Mostly rust. Entirely rhino.'),
  m('crane', 'Salvage Crane', 'junk', 3, 6, 8, { scrap: 3 }, {}, 'enabler', 'Hits for {dmg} and adds {scrap} **Scrap**.', 'Picks up anything. Puts down nothing.'),
  m('ogre', 'Recycler Ogre', 'junk', 4, 7, 14, { missingShield: 20 }, {}, 'enabler', 'Hits for {dmg} and turns {missingShield}% of your missing HP into **Shield**.', 'Nothing is wasted. Not even your pain.'),
  m('baron', 'Bottlecap Baron', 'junk', 4, 6, 10, { shield: 15 }, { trinketPow: 3 }, 'enabler', 'Hits for {dmg} and a **Shield** of {shield}. All allies get +3% ATK and POW per trinket you own.', 'Richest man in the dump. Pays in bottle caps.'),
  m('landfill', 'The Landfill King', 'junk', 5, 8, 40, { scrap: 4 }, { scrapCap2: 1 }, 'enabler', 'Crush for {dmg} and adds {scrap} **Scrap**. Your **Scrap** limit is doubled.', 'Long live the king. Long live the pile.'),
  m('colossus', 'Gearheap Colossus', 'junk', 5, 7, 30, { perScrap: 12 }, {}, 'carry', 'Crush for {dmg}, +{perScrap} for each **Scrap**.', 'A mountain of junk that learned to walk.'),

  // ---------------- THE ABYSS (Pressure stacks on the enemy and never fades) ----------------
  m('glimmerfin', 'Glimmerfin', 'abyss', 1, 3, 15, { pressure: 1 }, {}, 'dmg', 'Bite for {dmg} and {pressure} **Pressure**.', 'Its light is the last thing you see. Then the teeth.'),
  m('eel', 'Lantern Eel', 'abyss', 1, 4, 5, { expose: 15 }, {}, 'support', 'Zap for {dmg} and **Expose** {expose}%.', 'Lights the way. To the bottom.'),
  m('brine', 'Brine Witch', 'abyss', 2, 4, 6, { poison: 10 }, {}, 'dmg', 'Hex for {dmg} and **Poison** {poison}.', 'Brews salt into curses.'),
  m('coral', 'Coral Warden', 'abyss', 2, 5, 5, { shield: 20, shieldPerPressure: 3 }, {}, 'support', 'Hits for {dmg} and a **Shield** of {shield}, +{shieldPerPressure} per enemy **Pressure**.', 'Guards the reef. The reef guards back.'),
  m('angler', 'Anglerfang', 'abyss', 3, 4, 35, { perPressure: 10 }, {}, 'dmg', 'Lure for {dmg}, +{perPressure}% per enemy **Pressure**.', 'Patient. Hungry. Mostly hungry.'),
  m('tidecaller', 'Tide Caller', 'abyss', 3, 6, 8, { chill: 20 }, {}, 'enabler', 'Hits for {dmg} and **Chill** {chill}%.', 'Pulls the cold up from the deep.'),
  m('leviathan', 'Leviathan Calf', 'abyss', 4, 6, 20, { crush: 15 }, {}, 'carry', 'Crush for {dmg}, +{crush} per enemy **Pressure**, then the Pressure is used up.', 'Just a baby. Already the size of a ship.'),
  m('bell', 'Drowned Bell', 'abyss', 4, 7, 10, { pressure: 3 }, {}, 'enabler', 'Tolls for {dmg} and {pressure} **Pressure**.', 'Rings at the bottom of the sea. Nobody rings it.'),
  m('kraken', 'Mother Kraken', 'abyss', 5, 8, 20, { doom: 70 }, {}, 'enabler', 'Hits for {dmg} and **Doom** {doom}.', 'Every tentacle a different nightmare.'),
  m('trench', 'The Trench', 'abyss', 5, 8, 30, { pressure: 2 }, { late: 30 }, 'enabler', 'Hits for {dmg} and {pressure} **Pressure**. After 20 seconds, all your damage is +30%.', 'The deepest place there is. It is listening.'),

  // ---------------- DREAMSCAPE ----------------
  m('snoozle', 'Snoozle', 'dream', 1, 4, 5, { freezeTop: 1.5 }, {}, 'support', 'Hits for {dmg} and puts the readiest enemy to **Sleep** for {freezeTop}s.', 'Yawns. Everyone nearby yawns too. Then naps.'),
  m('pillow', 'Pillow Imp', 'dream', 1, 3, 14, { vsSleep: 100 }, {}, 'dmg', 'Smack for {dmg}, +{vsSleep}% if an enemy is **Asleep**.', 'Pillow fights to the death.'),
  m('moth', 'Nightmare Moth', 'dream', 2, 4, 12, { weaken: 15 }, {}, 'support', 'Dust for {dmg} and **Weaken** {weaken}%.', 'Drawn to the light of bedside lamps.'),
  m('sandman', 'Sandman Jr.', 'dream', 2, 5, 6, { freeze: 2 }, {}, 'support', 'Hits for {dmg} and puts an enemy to **Sleep** for {freeze}s.', 'Still learning. Sometimes uses too much sand.'),
  m('jester', 'Mirror Jester', 'dream', 3, 5, 10, { confuse: 50 }, {}, 'enabler', 'Hits for {dmg} and **Confuses**: the enemy\'s next cast hits their own team at {confuse}%.', 'Is it you? Is it them? Ha!'),
  m('baku', 'Dream Eater Baku', 'dream', 3, 5, 25, { dreamHeal: 100 }, {}, 'support', 'Hits for {dmg}. If an enemy is **Asleep**, heals {dreamHeal}% of the damage.', 'Eats bad dreams. Good ones too, if hungry.'),
  m('lucid', 'Lucid Knight', 'dream', 4, 6, 50, { vsDebuff: 100 }, {}, 'carry', 'Blade for {dmg}, +{vsDebuff}% against **Exposed** or **Weakened** enemies.', 'Knows this is a dream. Fights anyway.'),
  m('drowse', 'Clock of Drowse', 'dream', 4, 7, 6, { freezeAll: 1 }, {}, 'enabler', 'Hits for {dmg} and puts every enemy to **Sleep** for {freezeAll}s.', 'Always reads 3am.'),
  m('lunara', 'Lunara, Dreamweaver', 'dream', 5, 8, 14, { expose: 20 }, { linger: 50 }, 'enabler', 'Hits for {dmg} and **Expose** {expose}%. Your **Chill**, **Expose** and **Weaken** fade 50% slower.', 'Weaves dreams from moonlight and regret.'),
  m('dread', 'The Waking Dread', 'dream', 5, 8, 20, { perDebuff: 20 }, {}, 'carry', 'Hits for {dmg}, +{perDebuff} for each different debuff on the enemy.', 'The moment right before you wake up screaming.'),

  // ---------------- CLOCKWORK CITY ----------------
  m('tick', 'Tick', 'clock', 1, 3, 15, { every4: 1 }, {}, 'dmg', 'Cog for {dmg}. Every 4th cast repeats right away.', 'Tick. Tick. Tick. TICK.'),
  m('tock', 'Tock', 'clock', 1, 4, 5, { haste: 5 }, {}, 'support', 'Hits for {dmg} and **Haste** {haste}%.', 'Tick\'s twin. Slightly slower.'),
  m('spring', 'Spring Gunner', 'clock', 2, 3.5, 18, { selfgrow: 15 }, {}, 'dmg', 'Bolt for {dmg}. Gains +{selfgrow}% damage after each cast.', 'Winds tighter with every shot.'),
  m('mainspring', 'Mainspring Mechanic', 'clock', 2, 5, 5, { shield: 25, haste: 6 }, {}, 'support', 'Hits for {dmg}, a **Shield** of {shield} and **Haste** {haste}%.', 'Oils the gears. Talks to them, too.'),
  m('pendulum', 'Pendulum Blade', 'clock', 3, 4, 40, {}, {}, 'dmg', 'Swing for {dmg}.', 'Back and forth. Back and forth. Ow.'),
  m('winder', 'Gear Winder', 'clock', 3, 6, 8, { charge: 0.6 }, {}, 'enabler', 'Hits for {dmg} and **Charges** every ally {charge}s.', 'Winds everyone up. Literally.'),
  m('escapement', 'Escapement Engine', 'clock', 4, 6, 8, { echo: 60 }, {}, 'enabler', 'Hits for {dmg} and **Echoes** the ally in front at {echo}%.', 'The part of the clock that makes it tick.'),
  m('cuckoo', 'Cuckoo Sentinel', 'clock', 4, 6, 10, { perAllyCast: 8 }, {}, 'carry', 'Strike for {dmg}, +{perAllyCast} for each ally cast since its last strike.', 'Waits for the hour. Then strikes.'),
  m('orrery', 'The Grand Orrery', 'clock', 5, 8, 20, { haste: 10 }, { reset15: 1 }, 'enabler', 'Hits for {dmg} and **Haste** {haste}%. At 15 seconds, every ally casts right away.', 'Models the whole universe. Runs it a little faster.'),
  m('chronarch', 'Chronarch Vale', 'clock', 5, 8, 16, { shield: 35 }, { rewind: 5 }, 'enabler', 'Hits for {dmg} and a **Shield** of {shield}. Once, when your team drops under 30%: rewinds team HP to 5 seconds ago.', 'Has seen how this ends. Changed it.'),
];
// v0.7.6: every cooldown is 0.5s slower than written above (3s -> 3.5s ... 8s -> 8.5s)
export const CD_NERF = 0.5;
for (const x of MONS) x.cd = Math.round((x.cd + CD_NERF) * 10) / 10;
export const MON = Object.fromEntries(MONS.map(x => [x.id, x]));
// Balance knobs written by tools/balance.mjs from simulations:
// COST_ADJ = price change per mon (-5..+5, stronger archetypes cost more); TUNE = multiplier on all of a mon's numbers.
export const COST_ADJ = {"skulldrone":5,"tinfoil":-5,"meowma":5,"pyra":5,"frost":5,"skarr":5,"mothership":5,"kite":5,"sora":-5,"rhea":5,"willow":5,"aries":5,"pisces":-5,"scorpio":5,"libra":-5,"sagittarius":-5,"leo":5,"ophiuchus":-5,"bertha":-5,"oldtusk":-5,"mara":-5,"rexalon":5,"lirien":5,"grovesinger":-5,"thornhoof":5,"nx1":5,"leech":-5,"reaper":5,"siphon":-5,"graft":-5,"dreadnought":-5,"nullcore":-5,"mainframe":-5,"magpie":-5,"dora":-5,"clanker":5,"crane":-5,"ogre":5,"baron":5,"landfill":-5,"brine":5,"coral":-5,"tidecaller":5,"bell":-5,"kraken":-5,"trench":-5,"snoozle":-5,"moth":5,"sandman":-5,"dread":-5,"tick":5,"tock":-5,"mainspring":-5,"pendulum":5,"escapement":5,"cuckoo":5,"orrery":5};
export const TUNE = {"tinfoil":0.959,"meowma":0.644,"rosa":1.17,"pyra":0.751,"frost":0.512,"skarr":0.797,"mothership":0.465,"pip":0.853,"bao":0.919,"kite":0.959,"rhea":0.724,"gorran":0.964,"ashi":1.123,"hoshi":1.224,"ryo":0.921,"aries":1.034,"pisces":1.035,"taurus":1.131,"scorpio":0.84,"libra":1.452,"sagittarius":1.222,"leo":1.324,"ilse":0.915,"harpoon":0.761,"mara":2.1,"rexalon":0.862,"mosswhisper":0.985,"kaelen":0.834,"grovesinger":1.148,"windrunner":0.919,"elderbark":1.097,"ysil":1.473,"aelyth":1.02,"nx1":0.789,"leech":0.893,"reaper":0.57,"siphon":1.82,"graft":1.358,"dreadnought":1.317,"nullcore":0.954,"omega":0.88,"mainframe":1.095,"binkle":0.774,"magpie":1.302,"dora":1.496,"clanker":0.888,"rhino":0.92,"crane":1.684,"ogre":0.791,"baron":0.577,"landfill":1.122,"glimmerfin":0.892,"eel":0.942,"brine":0.882,"coral":0.989,"angler":0.856,"leviathan":1.5,"bell":1.564,"kraken":0.896,"trench":1.208,"snoozle":0.919,"moth":0.826,"baku":1.458,"drowse":0.751,"lunara":0.96,"dread":1.467,"tick":0.944,"tock":0.957,"spring":0.902,"mainspring":0.974,"cuckoo":1.088,"orrery":0.602,"grimhorn":1.003,"willow":0.914,"gemini":0.823,"ophiuchus":1.55,"dunemaw":0.844,"hale":1.496,"isolde":0.946,"lirien":1.072,"thornhoof":0.883,"harvester":1.095,"pillow":0.911,"sandman":1.211,"lucid":0.779,"winder":1.197,"escapement":1.449,"sora":0.736,"jester":1.087,"pendulum":0.939,"chronarch":1.478,"worldtree":1.116,"colossus":1.506,"skulldrone":0.947,"virgo":1.224,"brann":1.004,"brick":0.971,"oldtusk":0.976,"tidecaller":0.955,"bertha":0.987};

// Effect metadata: icon, label, and how levels scale it.
// scale: dmg (like hits), fx (flat effects), pct, sec, lvl (base x level), flat (never scales)
export const FX = {
  dmg:       { icon: '💥', label: 'Hit', scale: 'dmg' },
  burn:      { icon: '🔥', label: 'Burn', scale: 'fx' },
  heal:      { icon: '💚', label: 'Heal', scale: 'fx' },
  cleanse:   { icon: '🫧', label: 'Cleanse', scale: 'fx' },
  growth:    { icon: '🌿', label: 'Growth', scale: 'pct', unit: '%' },
  selfgrow:  { icon: '💪', label: 'Ramp', scale: 'pct', unit: '%' },
  haste:     { icon: '⚡', label: 'Haste', scale: 'pct', unit: '%' },
  charge:    { icon: '🔋', label: 'Charge all', scale: 'sec', unit: 's' },
  chargeNext:{ icon: '🔋', label: 'Charge next', scale: 'sec', unit: 's' },
  chill:     { icon: '❄️', label: 'Chill', scale: 'pct', unit: '%' },
  freeze:    { icon: '💤', label: 'Sleep', scale: 'sec', unit: 's' },
  freezeTop: { icon: '💤', label: 'Sleep readiest', scale: 'sec', unit: 's' },
  freezeAll: { icon: '💤', label: 'Sleep all', scale: 'sec', unit: 's' },
  shield:    { icon: '🛡️', label: 'Shield', scale: 'fx' },
  poison:    { icon: '☠️', label: 'Poison', scale: 'fx' },
  expose:    { icon: '🎯', label: 'Expose', scale: 'pct', unit: '%' },
  weaken:    { icon: '🌀', label: 'Weaken', scale: 'pct', unit: '%' },
  doom:      { icon: '💀', label: 'Doom', scale: 'fx' },
  scrap:     { icon: '🔩', label: 'Scrap', scale: 'lvl' },
  echo:      { icon: '🎵', label: 'Echo ally in front', scale: 'pct', unit: '%' },
  echoBack:  { icon: '🎵', label: 'Echo ally behind', scale: 'pct', unit: '%' },
  echoBoth:  { icon: '🎶', label: 'Echo front & behind', scale: 'pct', unit: '%' },
  regen:     { icon: '✨', label: 'Regen/s', scale: 'fx' },
  rebirth:   { icon: '🪶', label: 'Rebirth heal', scale: 'pct', unit: '%' },
  // v0.7 dimension mechanics
  lastStand: { icon: '🩸', label: 'Last Stand', scale: 'pct', unit: '%' },
  overclock: { icon: '🛸', label: 'Overclock', scale: 'flat' },
  ki:        { icon: '🔥', label: 'Ki to all', scale: 'lvl' },
  kinova:    { icon: '🌟', label: 'Per Ki gained', scale: 'dmg' },
  copyLast:  { icon: '🪞', label: 'Copy last cast', scale: 'pct', unit: '%' },
  frontRow:  { icon: '⬆️', label: 'Front row bonus', scale: 'pct', unit: '%' },
  perAlign:  { icon: '♈', label: 'Per aligned pair', scale: 'dmg' },
  balance:   { icon: '⚖️', label: 'Per % gap', scale: 'fx' },
  burst:     { icon: '💫', label: 'Cosmic Burst', scale: 'pct', unit: '%' },
  perGiant:  { icon: '🦣', label: 'Per Giant', scale: 'dmg' },
  strip:     { icon: '🕳️', label: 'Shield strip', scale: 'flat', unit: '%' },
  shieldPerHunter: { icon: '🎯', label: 'Shield per Hunter', scale: 'fx' },
  volleyAdj: { icon: '🏹', label: 'Per adjacent Archer', scale: 'pct', unit: '%' },
  volley:    { icon: '🏹', label: 'Archers cast', scale: 'flat' },
  healPct:   { icon: '💚', label: 'Heal % HP', scale: 'pct', unit: '%' },
  drain:     { icon: '🩸', label: 'Self drain', scale: 'flat', unit: '%' },
  selfHurt:  { icon: '🩸', label: 'Self damage', scale: 'flat', unit: '%' },
  sapGrowth: { icon: '🥀', label: 'Growth lost', scale: 'flat', unit: '%' },
  healPerScrap: { icon: '🔩', label: 'Heal per Scrap', scale: 'fx' },
  spendScrap:{ icon: '🔩', label: 'Scrap spend bonus', scale: 'pct', unit: '%' },
  shieldPerTrinket: { icon: '🎒', label: 'Shield per trinket', scale: 'fx' },
  missingShield: { icon: '♻️', label: 'Missing HP to shield', scale: 'pct', unit: '%' },
  perScrap:  { icon: '🔩', label: 'Per Scrap', scale: 'dmg' },
  pressure:  { icon: '🌊', label: 'Pressure', scale: 'lvl' },
  shieldPerPressure: { icon: '🌊', label: 'Shield per Pressure', scale: 'fx' },
  perPressure: { icon: '🌊', label: 'Per Pressure', scale: 'pct', unit: '%' },
  crush:     { icon: '🌊', label: 'Per Pressure (uses it)', scale: 'dmg' },
  vsSleep:   { icon: '💤', label: 'Vs sleeping', scale: 'pct', unit: '%' },
  confuse:   { icon: '😵', label: 'Confuse', scale: 'pct', unit: '%' },
  dreamHeal: { icon: '💤', label: 'Dream heal', scale: 'pct', unit: '%' },
  vsDebuff:  { icon: '🗡️', label: 'Vs Exposed/Weakened', scale: 'pct', unit: '%' },
  perDebuff: { icon: '🌑', label: 'Per debuff', scale: 'dmg' },
  every4:    { icon: '🔁', label: 'Every 4th cast twice', scale: 'flat' },
  perAllyCast: { icon: '🐦', label: 'Per ally cast', scale: 'dmg' },
};
export const ECHO_KEYS = ['echo', 'echoBack', 'echoBoth'];
// keys that only describe the being (shown in its text), not a separate chip
export const TEXT_ONLY = ['every4', 'overclock', 'volley'];

// Keyword glossary: shown when a bold keyword is tapped in details, help and results
export const KEYWORDS = {
  'Burn': 'Burn hits every second and fades by 30% each tick. Blocked by Shield.',
  'Burning': 'The enemy has Burn on them.',
  'Poison': 'Poison hits every second for a third of its stack, never fades and goes through Shield.',
  'Heals': 'Restores team HP. Healing past full HP becomes Shield at half value.',
  'Cleanses': 'Removes Burn first, then Poison, from your team.',
  'Shield': 'Soaks hits and Burn before HP. Can reach 50% of team HP.',
  'Chill': 'Slows the whole enemy team. Fades 3% per second.',
  'Chilled': 'The enemy has Chill on them.',
  'Haste': 'Speeds up your whole team. Fades 3% per second.',
  'Growth': 'Raises your whole team\'s hit damage for the rest of the battle.',
  'Expose': 'The enemy takes more damage from everything. Fades over time.',
  'Exposed': 'The enemy has Expose on them.',
  'Weaken': 'The enemy deals less hit damage. Fades over time.',
  'Weakened': 'The enemy has Weaken on them.',
  'Doom': 'Piles up on the enemy and detonates 5 seconds after it starts, going through Shield.',
  'Ki': 'Martial Realm beings gain 1 Ki per cast; any being can receive Ki. At 5 Ki a being Transforms.',
  'Transform': 'At 5 Ki: +50% ATK and POW for 6 seconds, then Ki starts over.',
  'Transforms': 'At 5 Ki: +50% ATK and POW for 6 seconds, then Ki starts over.',
  'Transformed': 'At 5 Ki: +50% ATK and POW for 6 seconds, then Ki starts over.',
  'Transformations': 'At 5 Ki: +50% ATK and POW for 6 seconds, then Ki starts over.',
  'Aligned': 'A Zodiac being next to another of the same element (fire, earth, air, water) gets +20% ATK and POW.',
  'Alignment': 'A Zodiac being next to another of the same element (fire, earth, air, water) gets +20% ATK and POW.',
  'Cosmic Burst': 'Turns your Shield into damage, then the Shield is gone.',
  'Giant': 'A tag: giant beasts from the Age of Giants.',
  'Hunter': 'A tag: the hunters of the Age of Giants.',
  'Archer': 'A tag: Elvenwood bowmen.',
  'Auras': 'Ongoing bonuses a being gives to allies in certain slots.',
  'Last Stand': 'Deals more damage the more HP your team has lost, up to the full bonus at 0 HP.',
  'Overclock': 'Every ally\'s next cast happens twice.',
  'Assimilate': 'The machine drains its own allies: they get less ATK and POW.',
  'Scrap': 'Piles up on your team (limit 40). Every Junkverse being hits +0.5 harder per Scrap.',
  'Pressure': 'Stacks on the enemy and never fades (limit 30). Some Abyss beings get stronger with it or use it up.',
  'Sleep': 'Pushes enemy timers back. For 2 seconds after, the enemy counts as Asleep.',
  'Asleep': 'An enemy was put to Sleep in the last 2 seconds.',
  'Confuses': 'The enemy\'s next cast hits their own team instead, at reduced power.',
  'Charges': 'Pushes ally timers forward.',
  'Echoes': 'Repeats another being\'s cast at partial power.',
};

// ------------------------------------------------------------------ triggers
// One extra trigger per being (optional), separate from its cooldown cast.
// Combat: allyCast (filter by dimension and/or position: front, behind, adjacent), selfCast, lowHp, foeLow, sudden, shieldGain, healed, doomBoom
// Shop:   buy, sell, levelUp, trinket, allySold, reroll, win, loss, battleEnd
// do: { cast } | { multicast: N } | { plus: N } (+N hit damage for the run) | { junk: N } | { trinket: T }
//     | { fx: {effect: base} } | { pct: 'dmg'|'heal'|'shield', v } | { grow: {atk|pow} } | { growAll: {type, atk|pow} }
//     | { growFront: {atk|pow} } | { growRand: {type, atk|pow} } | { gold }
// Rules: a being is never triggered by a copy of itself; each fires at most once per trigger chain (stops loops).
const tg = (on, d, extra = {}) => ({ on, do: d, ...extra });
export const TRIGGERS = {
  pip: tg('win', { grow: { atk: 0.04 } }),
  harpoon: tg('foeLow', { cast: 1 }),
  reaper: tg('lowHp', { multicast: 2 }),
  ogre: tg('lowHp', { cast: 1 }),
  isolde: tg('foeLow', { fx: { expose: 20 } }),
  kraken: tg('sudden', { fx: { doom: 70 } }),
  frost: tg('allyCast', { fx: { chill: 6 } }, { from: 'adjacent' }),
  coral: tg('shieldGain', { pct: 'dmg', v: 20 }),
  tock: tg('allyCast', { fx: { haste: 2 } }, { type: 'clock' }),
  sandman: tg('allyCast', { cast: 1 }, { type: 'dream', from: 'front' }),
  bao: tg('lowHp', { fx: { shield: 40 } }),
  mosswhisper: tg('healed', { fx: { growth: 1 } }),
  magpie: tg('win', { junk: 1 }),
  landfill: tg('battleEnd', { junk: 1 }),
  rhino: tg('trinket', { grow: { pow: 0.1 } }),
  baron: tg('sell', { gold: 1 }),
  crane: tg('allySold', { grow: { atk: 0.1 } }),
  binkle: tg('reroll', { grow: { atk: 0.02 } }),
  hale: tg('buy', { growAll: { type: 'giants', pow: 0.05 } }),
  kite: tg('levelUp', { growAll: { type: 'martial', atk: 0.06 } }),
  gemini: tg('levelUp', { trinket: 2 }),
  spring: tg('selfCast', { plus: 0.05 }),
};
export const SHOP_TRIGGERS = ['buy', 'sell', 'levelUp', 'trinket', 'allySold', 'reroll', 'win', 'loss', 'battleEnd'];

// Ongoing auras: who = front | behind | adjacent | nonadjacent | row | all; atk/pow/speed in %, scaled x1/1.5/2 by level
// tag: only allies with that tag. Negative values = Assimilate (Necro Machines).
export const AURAS = {
  nx1: { who: 'all', atk: -10, pow: -10 },
  siphon: { who: 'all', atk: -10, pow: -10 },
  harvester: { who: 'adjacent', atk: -50, pow: -50 },
  dreadnought: { who: 'all', atk: -50, pow: -50 },
  omega: { who: 'all', atk: -60, pow: -60 },
  mara: { who: 'adjacent', speed: 20, tag: 'giant' },
  leo: { who: 'row', atk: 30, pow: 30 },
  tock: { who: 'adjacent', speed: 10 },
  orrery: { who: 'all', speed: 15 },
  mosswhisper: { who: 'adjacent', atk: 10 },
  thornhoof: { who: 'adjacent', pow: 15 },
  ysil: { who: 'behind', atk: 20, pow: 20 },
  meowma: { who: 'behind', atk: 15 },
  gorran: { who: 'front', pow: 20 },
  taurus: { who: 'behind', atk: 15, pow: 15 },
  eel: { who: 'adjacent', pow: 10 },
};
export const WHO_TEXT = { front: 'the ally in front', behind: 'the ally behind', adjacent: 'adjacent allies', nonadjacent: 'all allies not next to it', row: 'allies in its row', all: 'all your other beings' };
// Team grid: slots 1-3 (index 0-2) = front row, 4-6 (index 3-5) = back row; slot 4 is behind slot 1.
// Adjacent = left/right/front/behind neighbour (no diagonals). Is slot j in zone "who" of slot i?
export function inZone(who, i, j) {
  if (i === j) return false;
  const ri = Math.floor(i / 3), ci = i % 3, rj = Math.floor(j / 3), cj = j % 3;
  const adj = (ri === rj && Math.abs(ci - cj) === 1) || (ci === cj && Math.abs(ri - rj) === 1);
  if (who === 'front') return ci === cj && rj === ri - 1;
  if (who === 'behind') return ci === cj && rj === ri + 1;
  if (who === 'adjacent') return adj;
  if (who === 'nonadjacent') return !adj;
  if (who === 'row') return ri === rj;
  if (who === 'all') return true;
  return false;
}
const ON_TEXT = {
  selfCast: 'Each time it casts', battleEnd: 'After each battle',
  lowHp: 'When your team drops below 50% (once)', foeLow: 'When the enemy drops below 50% (once)', sudden: 'When sudden death starts',
  shieldGain: 'When your team gains shield', healed: 'When your team is healed', doomBoom: 'When enemy Doom detonates',
  buy: 'When bought', sell: 'When sold', levelUp: 'On level up', trinket: 'When you gain a trinket', allySold: 'When an ally is sold',
  reroll: 'On each reroll', win: 'After each win', loss: 'After each loss',
};
const statTxt = (o, lvl) => Object.entries(o).filter(([k]) => k === 'atk' || k === 'pow').map(([k, v]) => `+${Math.round(v * 100 * lvl)}% ${k.toUpperCase()}`).join(' and ');
export function triggerText(def, lvl = 1, pow = 1) {
  const t = TRIGGERS[def.id]; if (!t) return '';
  let when = ON_TEXT[t.on];
  if (t.on === 'allyCast') {
    const dim = t.type ? `${TYPES[t.type].name} ` : '';
    when = t.from ? `When ${{ front: `the ${dim}ally in front`, behind: `the ${dim}ally behind`, adjacent: `an adjacent ${dim}ally` }[t.from]} casts` : `When an ally ${dim}being casts`;
  }
  const d = t.do; let what = '';
  if (d.cast) what = 'it casts too (cooldown resets)';
  else if (d.multicast) what = `it casts ${d.multicast} times in a row (cooldown resets)`;
  else if (d.plus) what = `+${Math.round(d.plus * lvl * 100) / 100} hit damage for the run`;
  else if (d.junk) what = `gain ${d.junk * lvl} junk trinket${d.junk * lvl > 1 ? 's' : ''} (no effect, but they count as trinkets)`;
  else if (d.trinket) what = `gain a random tier ${Math.min(5, d.trinket + lvl - 1)} trinket`;
  else if (d.fx) what = Object.entries(d.fx).map(([k, v]) => `${FX[k].icon} ${FX[k].label} ${Math.round(fxValue(k, v, def, lvl, pow) * 10) / 10}${FX[k].unit || ''}`).join(', ');
  else if (d.pct) what = { dmg: `deals ${d.v}% of it as damage`, heal: `heals ${d.v}% of it`, shield: `gains ${d.v}% of it as shield` }[d.pct];
  else if (d.grow) what = `this being gets ${statTxt(d.grow, lvl)} for the run`;
  else if (d.growAll) what = `all your ${TYPES[d.growAll.type].name} beings get ${statTxt(d.growAll, lvl)} for the run`;
  else if (d.growFront) what = `the being in front gets ${statTxt(d.growFront, lvl)} for the run`;
  else if (d.growRand) what = `a random ${TYPES[d.growRand.type].name} ally gets ${statTxt(d.growRand, lvl)} for the run`;
  else if (d.gold) what = `+${d.gold * lvl} gold`;
  return `${when}: ${what}.`;
}
export function auraText(def, lvl = 1) {
  const a = AURAS[def.id]; if (!a) return '';
  const k = LV.pct[lvl], parts = [];
  const sg = (v) => (v > 0 ? '+' : '') + Math.round(v * k);
  if (a.atk) parts.push(`${sg(a.atk)}% ATK`);
  if (a.pow) parts.push(`${sg(a.pow)}% POW`);
  const one = a.who === 'front' || a.who === 'behind';
  if (a.speed) parts.push(`${one ? 'acts' : 'act'} ${Math.round(a.speed * k)}% faster`);
  let who = WHO_TEXT[a.who];
  if (a.tag) who = { adjacent: 'adjacent', all: 'all your' }[a.who] + ' ' + TAGS[a.tag].split(' ')[1] + 's';
  return `Ongoing: ${who} ${a.speed && !a.atk && !a.pow ? '' : (one ? 'gets ' : 'get ')}${parts.join(', ')}.`;
}

export const RANKS = [
  { name: 'Styrofoam', icon: '🥡', color: '#e8e8e8' },
  { name: 'Wood', icon: '🪵', color: '#b07a45' },
  { name: 'Iron', icon: '⛓️', color: '#9aa4ad' },
  { name: 'Bronze', icon: '🥉', color: '#cd7f32' },
  { name: 'Silver', icon: '🥈', color: '#d0d8e0' },
  { name: 'Gold', icon: '🥇', color: '#ffd54a' },
  { name: 'Platinum', icon: '💠', color: '#7fe3d4' },
  { name: 'Diamond', icon: '💎', color: '#8ad8ff' },
];
// Ranked: the run's final win count moves your rank once the run ends.
export const RANK_RULE = { up: 6, stay: 5 }; // 6+ wins: up one rank, exactly 5: stay, under 5: down one
export const rankDelta = (wins) => wins >= RANK_RULE.up ? 1 : wins === RANK_RULE.stay ? 0 : -1;

export const AVATARS = [
  { id: 'captain', name: 'Captain Brawn', face: '🧔', perk: 'Team HP +15%.' },
  { id: 'merchant', name: 'Merchant Mira', face: '👩‍💼', perk: '+8 gold every day.' },
  { id: 'scholar', name: 'Scholar Quill', face: '🧑‍🎓', perk: 'Shop shows 6 offers instead of 5.' },
  { id: 'breeder', name: 'Breeder Bea', face: '👩‍🌾', perk: 'Every merge adds +10% ATK and POW.' },
  { id: 'coach', name: 'Coach Kip', face: '🧢', perk: 'Your front being (slot 1) gets +30% ATK and POW.' },
  { id: 'gambler', name: 'Gambler Dex', face: '🎩', perk: 'First reroll each day is free.' },
  { id: 'mystic', name: 'Mystic Oona', face: '🧙‍♀️', perk: 'Start the run with a random tier 2 trinket.' },
  { id: 'junkyard', name: 'Junkyard Jo', face: '👷', perk: 'Selling gives +3 gold per copy.' },
  { id: 'tamer', name: 'Tamer Rex', face: '🤠', perk: 'Start with 2 random tier 1 beings.' },
];
export const AVATAR = Object.fromEntries(AVATARS.map(a => [a.id, a]));

// v0.7.6 trinket overhaul: no flat team-wide stat boosts. Trinkets bend rules, reward positions, or change how a
// dimension's own mechanic works (relics). Trinkets can repeat (effects stack), except those with a `max`.
// Battle keys (summed per copy): slot1/slot6 (ATK+POW % for that slot), sd (sudden death cut %), wind (once: heal % HP <30%),
// totem, mirror (echo %), hp (team HP %, negative for Glass Cannon), watch (slots pre-charged), sand (enemy charge delay s),
// mix (cross-dimension follow-up hit %), glass (first cast echoes), wolf (speed % with <=3 beings), rainbow, fame,
// twin (twin echo %), fault (enemy back row slow %), chimera, turn (refill cooldowns at 50%), paragon, gear (charge s),
// r_<dimension> (relics). Run keys: goldDay, winGold, bench, rerolls, copy, offers, coupon, spare, wish, hand, anvil.
const tk = (id, tier, name, icon, desc, fx, max) => ({ id, tier, name, icon, desc, fx, max });
export const TRINKETS = [
  // tier 1
  tk('coinpurse', 1, 'Coin Purse', '🪙', '+4 gold every day.', { goldDay: 4 }),
  tk('clover', 1, 'Lucky Clover', '🍀', 'Copies of your beings show up in the shop more often, even after level 3.', { copy: 10, noFade: 1 }),
  tk('coupon', 1, 'Coupon Book', '🎟️', 'The first being you buy each day costs 5 less.', { coupon: 5 }),
  tk('pocketwatch', 1, 'Pocket Watch', '⏱️', 'Your slot 1 being starts every battle ready to cast. Each extra watch readies the next slot too.', { watch: 1 }),
  tk('sandbottle', 1, 'Bottle of Sand', '🏺', 'Enemy beings start every battle 1.5s behind.', { sand: 1.5 }),
  tk('spareparts', 1, 'Spare Parts', '🔧', 'Selling a being also gives you a junk trinket.', { spare: 1 }),
  // tier 2
  tk('leaderbadge', 2, 'Leader Badge', '🎖️', 'Slot 1 being gets +30% ATK and POW.', { slot1: 30 }),
  tk('fatwallet', 2, 'Fat Wallet', '👛', '+8 gold every day.', { goldDay: 8 }),
  tk('dice', 2, 'Loaded Dice', '🎲', '1 free reroll every day.', { rerolls: 1 }),
  tk('wishbone', 2, 'Wishbone', '🦴', 'Lose by less than 10% of their HP and you keep your life. Then it snaps.', { wish: 1 }),
  tk('handmedowns', 2, 'Hand-me-downs', '🧥', 'When you sell a being, a random ally from the same dimension gets half of its bonus ATK, POW and earned hit damage.', { hand: 1 }),
  tk('mixtape', 2, 'Mixtape', '📼', 'When a being casts right after an ally from a different dimension, it hits 25% harder.', { mix: 25 }),
  // tier 3
  tk('rearguard', 3, 'Rear Guard', '🛡️', 'Slot 6 being gets +40% ATK and POW.', { slot6: 40 }),
  tk('overtime', 3, 'Overtime Boots', '🥾', 'Take 50% less sudden death drain.', { sd: 50 }),
  tk('goldenegg', 3, 'Golden Egg', '🥚', '+10 gold after every win.', { winGold: 10 }),
  tk('backpack', 3, 'Big Backpack', '🎒', '+2 bench slots.', { bench: 2 }, 2),
  tk('glasscannon', 3, 'Glass Cannon', '🔫', 'Team HP −25%, but every being\'s first cast each battle is echoed at full power.', { hp: -25, glass: 1 }),
  tk('lonewolf', 3, 'Lone Wolf', '🐺', 'If 3 or fewer beings fight, they act 40% faster.', { wolf: 40 }),
  tk('rainbow', 3, 'Rainbow Badge', '🌈', 'Every different dimension on your team counts as 1 more trinket.', { rainbow: 1 }),
  // tier 4
  tk('treasuremap', 4, 'Treasure Map', '🗺️', 'The shop shows 1 more offer.', { offers: 1 }, 2),
  tk('twinfates', 4, 'Twin Fates', '♊', 'Two copies of the same being on your team (not merged) are twins: when one casts, the other echoes it at 60%.', { twin: 60 }),
  tk('halloffame', 4, 'Hall of Fame', '🏛️', 'Every being at level 4 or higher counts as 1 more trinket, and gives +15 gold each time it levels up.', { fame: 1 }),
  tk('faultline', 4, 'Fault Line', '🪨', 'The enemy back row acts 25% slower.', { fault: 25 }),
  // tier 5
  tk('chimera', 5, 'Chimera Crown', '👑', 'Your slot 1 being also counts as a Giant, a Hunter, an Archer and every Zodiac element.', { chimera: 1 }),
  tk('timeturner', 5, 'Time Turner', '⌛', 'The first time your HP drops below 50%, all your beings are instantly ready to cast.', { turn: 1 }),
  tk('phoenixfeather', 5, 'Phoenix Feather', '🪶', 'Once per battle, heal 30% team HP when under 30%.', { wind: 30 }),
  tk('goldengoose', 5, 'Golden Goose', '🪿', '+15 gold every day and +10 after every win.', { goldDay: 15, winGold: 10 }),
  // tier 6: legendary, one of each per run. From level 3 merges of tier 5 beings and every level past 3.
  tk('undying', 6, 'Undying Totem', '🗿', 'Once per battle, survive a lethal blow at 1 HP and heal 40% team HP.', { totem: 40 }, 1),
  tk('mirror', 6, 'Mirror of Echoes', '🪞', 'Every cast of your beings also echoes at 25% power.', { mirror: 25 }, 1),
  tk('dragonhoard', 6, 'Dragon Hoard', '💰', '+25 gold every day and +15 after every win.', { goldDay: 25, winGold: 15 }, 1),
  tk('paragon', 6, 'Paragon\'s Laurel', '🏅', 'Your highest-level being casts everything twice.', { paragon: 1 }, 1),
  tk('clockwork', 6, 'Clockwork Heart', '⚙️', 'Whenever one of your beings casts, your least-charged being gains 0.3s.', { gear: 0.3 }, 1),
  tk('anvil', 6, 'Starforge Anvil', '⚒️', 'Every copy that levels up a being past level 3 also adds +10% ATK and POW to it.', { anvil: 10 }, 1),
];
// tier 0 = junk trinkets: no effect, stackable, only from junk-trinket triggers (they still fire "trinket gained")
for (const [id, name, icon] of [['bottlecap', 'Bottle Cap', '🔘'], ['rubberduck', 'Rubber Duck', '🦆'], ['oldsock', 'Old Sock', '🧦'], ['bentspoon', 'Bent Spoon', '🥄'], ['lostbutton', 'Lost Button', '🪡'], ['banana', 'Banana Peel', '🍌']])
  TRINKETS.push(tk(id, 0, name, icon, 'Junk. Does nothing, but counts as a trinket.', {}));
export const trinketPrice = (t) => 10 + 10 * t.tier;
// relics (tier 3): one per dimension, each changes how that dimension's mechanic works
const RELICS = {
  fallen: ['Dead Man\'s Switch', '🔴', 'Last Stand acts as if your team had 20% less HP than it does.'],
  martial: ['Black Belt', '🥋', 'Martial beings Transform at 4 Ki instead of 5, and their Transformations last 3s longer.'],
  zodiac: ['Star Chart', '🗺️', 'Diagonal neighbours count as adjacent for Alignment, and Aligned gives +10% more.'],
  giants: ['Trophy Rack', '🦌', 'Every Giant counts twice for your Hunters.'],
  elven: ['Moonwell', '🌕', 'Every Archer cast heals 1% team HP.'],
  necro: ['Kill Switch', '🔌', 'Assimilate drains your allies only half as much.'],
  junk: ['Scrap Magnet', '🧲', 'Start every battle with 1 Scrap per trinket you own.'],
  abyss: ['Anchor', '⚓', 'The enemy starts with 3 Pressure, and cashing in Pressure only uses half of it.'],
  dream: ['Lullaby Box', '🎶', 'Your Sleep effects last 50% longer.'],
  clock: ['Metronome', '🎼', 'Every 5th cast your team makes is echoed at full power.'],
};
for (const t of Object.keys(TYPES)) { const [name, icon, desc] = RELICS[t]; TRINKETS.push(tk('relic_' + t, 3, name, icon, `${TYPES[t].name} relic. ${desc}`, { ['r_' + t]: 1 })); }
// saves from before v0.7.6: removed trinkets become a new one of the same tier
export const TRINKET_MIGRATE = {
  whetstone: 'pocketwatch', sneakers: 'sandbottle', lunchbox: 'coupon', pebblecharm: 'spareparts',
  hourglass: 'mixtape', thickhide: 'wishbone', prism: 'handmedowns',
  spikedcollar: 'glasscannon', openingact: 'lonewolf', warmblanket: 'rainbow',
  wardrum: 'faultline', heartlocket: 'halloffame', crystalball: 'twinfates', secondwind: 'faultline', berserker: 'twinfates',
  crown: 'chimera', dragonscale: 'phoenixfeather', elementalorb: 'chimera',
  worldseed: 'paragon', secondsun: 'anvil',
};
for (const t of Object.keys(TYPES)) TRINKET_MIGRATE['charm_' + t] = 'relic_' + t;
export const TRINKET = Object.fromEntries(TRINKETS.map(t => [t.id, t]));
export const ECON_KEYS = ['goldDay', 'winGold', 'bench', 'rerolls', 'copy', 'offers', 'noFade', 'coupon', 'spare', 'wish', 'hand', 'anvil'];
export const isBattleTrinket = (id) => TRINKET[id] && Object.keys(TRINKET[id].fx).some(k => !ECON_KEYS.includes(k));
// Sum of all trinket effects (charms merge per type)
export function trinketBonus(ids) {
  const b = { type: {} };
  for (const id of ids || []) {
    const t = TRINKET[id]; if (!t) continue;
    for (const [k, v] of Object.entries(t.fx)) {
      if (k === 'type') for (const [ty, x] of Object.entries(v)) b.type[ty] = (b.type[ty] || 0) + x;
      else b[k] = (b[k] || 0) + v;
    }
  }
  return b;
}

export const BOT_NAMES = ['Ash Tray', 'Misty Window', 'Brock Lee', 'Gary Oakley', 'Professor Elm Street', 'Nurse Jolene', 'Team Rocket Science', 'Lass Vegas', 'Youngster Joey', 'Bug Catcher Bob', 'Hiker Mike', 'Swimmer Sue', 'Picnicker Pam', 'Cool Trainer Kai', 'Ace Ventura', 'Super Nerd Ned', 'Fisher Price', 'Biker Bart', 'Gentleman Jim', 'Beauty Bella', 'Psychic Sam', 'Blackbelt Bo', 'Juggler Jules', 'Rancher Rita', 'Tamer Tina', 'Ranger Rick', 'Burglar Barry', 'Scientist Sid', 'Sailor Sal', 'Camper Cam', 'Dragon Tamer Dot', 'Old Man Pete', 'Twin Tia & Tea', 'Cue Ball Carl', 'Rocker Roxy', 'Medium Maud', 'Channeler Chan', 'Bird Keeper Birdie', 'Artist Arturo', 'Collector Colin'];

export const CHANGELOG = [
  { v: '0.7.6', date: '2026-11-27', notes: [
    'Levels past 3: once a being is level 3, every extra copy you buy adds a level (4, 5, 6... no cap), and every level past 3 gives a legendary (tier 6) trinket pick.',
    'Beings you own at level 3 or higher show up only 25% as often in the shop (Lucky Clover cancels this).',
    'Every being\'s cooldown is 0.5s slower (3s is now 3.5s).',
    'Trinket overhaul: no more flat stat boosts. New trinkets bend the rules: Pocket Watch, Bottle of Sand, Coupon Book, Spare Parts, Wishbone, Hand-me-downs, Mixtape, Glass Cannon, Lone Wolf, Rainbow Badge, Twin Fates, Hall of Fame, Fault Line, Chimera Crown, Time Turner, Paragon\'s Laurel, Clockwork Heart, Starforge Anvil.',
    'Dimension charms are now relics that change how each dimension\'s trick works (Dead Man\'s Switch, Black Belt, Star Chart, Trophy Rack, Moonwell, Kill Switch, Scrap Magnet, Anchor, Lullaby Box, Metronome).',
    'You can own the same trinket more than once and effects stack, except Big Backpack and Treasure Map (2 max) and legendaries (1 each).',
    'Your saved run carries over: removed trinkets were swapped for new ones of the same tier. Classic v0.7 now keeps its own saved run.',
  ] },
  { v: '0.7.5', date: '2026-11-26', notes: [
    'The "Rift" presentation update. Same rules, same beings, brand new look: a black rift with every card a window into its dimension, a poster font, and line icons and dimension sigils in place of emoji.',
    'Battles show who did what: every hit beams from the being that cast it into the enemy HP bar, with the number where it lands. Gold links show which ally set off a trigger. Each being shows the damage it has dealt so far.',
    'CHAIN counter: casts and triggers that fire close together build a chain. Big hits shake the screen, HP bars drain with a white trail, and every fight ends with a K.O.',
    'KO time: every win is graded S (under 6s), A, B, C or D, and your best KO is saved. Great teams win in seconds.',
    'Sound! Every dimension has its own cast sound, and chains climb in pitch. Mute from the title or the menu.',
    'Multidex: beings you own are caught for good, beings you meet are seen, the rest are silhouettes. New catches get a NEW DISCOVERY stamp.',
    'A VS screen before each fight, a DAY card between days with your wins and lives, a "so close" note on narrow losses, and a battle history on the run summary.',
    'The team label counts your beings per dimension (counts only: synergies stay secret).',
    'Miss the old look? "Play classic v0.7" on the title screen. Both versions share your saved run.',
  ] },
  { v: '0.7', date: '2026-11-26', notes: [
    'The multiverse update: the 11 types are gone. 100 new beings from 10 dimensions take their place: Fallen Earth, Martial Realm, Zodiac, Age of Giants, Elvenwood, Necro Machines, Junkverse, The Abyss, Dreamscape and Clockwork City. Every dimension is in every run.',
    'Each dimension has its own trick: Last Stand, Ki and Transformations, Zodiac Alignment, Hunters and Giants, archer volleys, Assimilate, Scrap, Pressure, Sleep and Confusion, and Clockwork tempo. Synergies are hidden: find them!',
    'New art: every dimension is drawn in its own style (comic, manga ink, starlight, woodcut, watercolor, chrome and neon, crayon stickers, bioluminescence, pastel dreams and blueprints).',
    'Slower, clearer battles: cooldowns now run from 3s (fast) to 8s (very slow), with bigger numbers per cast. Team HP grows faster in later days.',
    'Battle report: after each fight, see how much damage and support every being gave on both teams, with an MVP each. "Hide" now shows damage badges on the board.',
    'Details now explain each being in plain words. Tap any bold keyword to see what it means.',
    'Small numbers (prices, tiers, levels, stats) use a clearer font.',
    'Prices and power were rebalanced with thousands of simulated runs. All numbers are placeholders: friends will be able to tune them soon.',
  ] },
  { v: '0.6b', date: '2026-11-25', notes: [
    'Easier to read: brighter secondary text, darker backgrounds behind small text, slightly heavier small fonts, and darker reds and pinks behind white text. Every text colour now passes the standard contrast check for its size.',
  ] },
  { v: '0.6', date: '2026-11-25', notes: [
    'See your buffs: cards and details now show battle-ready stats, including auras, charms, slot trinkets and growth. Buffed numbers glow (green, then bold, then gold, then rainbow), and the details list where each buff comes from. Selecting an aura mon outlines the slots it buffs.',
    'Stat badges under every mon: hit damage and its main effect at a glance.',
    'Battles: tap any mon (yours or theirs) to see its live stats while the fight runs. New ⏸ pause button and a 2× toggle. "Hide" on the result box lets you look at the board after the fight.',
    'Reaching level 3 now gives ONE trinket pick, one tier higher. Six new legendary tier 6 trinkets for level 3 tier 5 mons.',
    'All mon prices now end in 0 or 5.',
    'Fresh look: pixel font, coloured section headers, name and price strips on cards, chunkier buttons, bigger HP bars, trainer portraits in battle.',
    'Rebalanced.',
  ] },
  { v: '0.5', date: '2026-11-25', notes: [
    'The shop and event screens now fit on one screen: no scrolling, ever. Cards size themselves to your phone.',
    'Taps only select: tapping a mon shows its details, tapping another just switches. Nothing moves or gets bought by tapping.',
    'Moving is drag-only, with no hold needed: drag a card about a finger-width onto a glowing slot. Releasing anywhere else cancels. Buy and Sell buttons are still in the details panel.',
    'Shop items open their details at the top, so you can keep tapping through the shop; your mons open theirs at the bottom.',
    'The merge-reward trinket pick is now a popup.',
  ] },
  { v: '0.4', date: '2026-11-25', notes: [
    'Drag and drop: hold a shop card for a moment, then drag it onto a slot to buy it there. Drag your mons to swap them, or onto the bottom bar to sell. Releasing anywhere else cancels, and tapping still shows details.',
    'Merges get a fanfare (level 3 even more), and every new trinket pops out of a gift box.',
    'The shop now always has one trinket for sale (20-60 gold by tier). You can lock it like any offer.',
    'New triggers: multicast (Encorca, Infernodon, Symphonix cast several times in a row), permanent flat hit damage (Cindermite, Pyrrhino and Lashvine grow every cast; Elderoot, Ghoulpup, Gearwolf, Titanox and Rustacean grow on wins or trinkets).',
    'Trinket makers: Canrat, Magnetick and Dumpsterix hand out no-effect junk trinkets (they stack and feed trinket triggers); Oraclam, Recyclops and Crushbox find real ones. Try a trinket snowball team!',
    'Rebalanced with the new mechanics.',
  ] },
  { v: '0.3', date: '2026-11-25', notes: [
    'Triggers: 43 mons now have a 🔔 trigger on top of their normal cast: when bought, sold, levelled up, gaining a trinket, rerolling, after wins or losses, when allies cast, at low HP, at sudden death, on shield or healing... A few even cast again on the spot.',
    'Team grid: slots 1-3 are the front row, 4-6 the back row. 13 mons have an ✨ aura that buffs the ally in front, behind, next to them, or everyone not next to them. Echo now uses the grid too.',
    'Bigger, cleaner shop: large cards in a 3-wide grid, clear prices and tiers, and a details sheet that slides up when you tap a mon.',
    '3-second countdown before every battle, showing who you are about to fight.',
    'Ranked opponents are now matched by a hidden team rating that predicts fights much better. The ⚡ Power you see is just the sum of your stats, for fun.',
    'Full rebalance with the new mechanics (every type now wins 45-55% when stacked).',
  ] },
  { v: '0.2', date: '2026-11-25', notes: [
    'Merge rewards: every merge offers a pick of 3 trinkets of the merged mon\'s tier. Trinkets now have tiers 1-5 (37 trinkets, incl. a Charm for each type).',
    'Prices are now about 10 × tier, ±5 by how strong each mon is. Income, rerolls, selling and event gold were rescaled to match.',
    'Ranked: your rank moves when the run ends. 6+ wins rank up, 5 holds, under 5 ranks down.',
    'Battle button asks for confirmation (and warns about empty slots or unspent gold).',
    'New art: every type has its own body shapes (flames, fish, crystals, golems, slimes, jellyfish, trash cans, speakers...).',
    'Rebalanced every mon with 3,000+ simulated runs, including bots that hunt for the strongest mons.',
    'Old v0.1 runs in progress were reset (rank carried over).',
  ] },
  { v: '0.1', date: '2026-11-25', notes: [
    'First playable: 11 types, 110 mons (2 per type per tier), 9 avatars, 14 trinkets, 12 event kinds.',
    'Days: event → shop → one 30 second battle against a same-day snapshot. Sudden death after 30s.',
    'Merging: 3 copies → level 2, two level 2s → level 3, keeping the best ATK and POW of each copy.',
    'Normal and Ranked modes. Ranked matches by team power and moves you from Styrofoam to Diamond.',
    'Opponents come from a library of bot runs simulated with the real rules (friends\' snapshots need a small server, planned).',
  ] },
];
