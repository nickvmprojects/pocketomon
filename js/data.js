// Pocketomon — game data. All numbers are first-pass and tuned by tools/gen.mjs.
export const VERSION = '0.6b';

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
  typesPerRun: 5,
  copyBias: 0.2,           // chance a shop slot shows a copy of a mon you own
  shieldCap: 0.5,          // shield can't exceed 50% of max HP
};

export const teamHp = (day) => 200 + day * 100;
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
// flat amounts (hits, burn, heal, shield, poison, doom, regen) are compressed by tier so
// late-game fights don't end in 5 seconds while day 1 fights still finish in time
export const TIER_SCALE = [0, 1.6, 1.35, 1.1, 0.95, 0.85];
// def = the mon definition (tier + id for TUNE)
export function fxValue(key, base, def, lvl, pow = 1) {
  const sc = FX[key] ? FX[key].scale : 'fx';
  if (sc === 'lvl') return base * lvl;
  const lv = sc === 'dmg' ? LV.dmg : sc === 'sec' ? LV.sec : sc === 'pct' ? LV.pct : LV.fx;
  const flat = sc === 'dmg' || sc === 'fx';
  return base * lv[lvl] * pow * (flat ? TIER_SCALE[def.tier] : 1) * (TUNE[def.id] || 1);
}
export const TIER_POWER = [0, 10, 14, 19, 25, 32];
export const LV_POWER = [0, 1, 1.8, 2.8];

export const TYPES = {
  fire:     { name: 'Fire',     icon: '🔥', color: '#ff6a3d', dark: '#8f2a12', mech: 'Burn',    blurb: 'Burn stacks hit every second and fade by 30% each tick.' },
  water:    { name: 'Water',    icon: '💧', color: '#3fa9ff', dark: '#14548f', mech: 'Heal',    blurb: 'Heals your team HP and washes off burn and poison.' },
  grass:    { name: 'Grass',    icon: '🌿', color: '#5fd068', dark: '#22712c', mech: 'Growth',  blurb: 'Growth permanently raises your whole team\'s damage for the battle.' },
  electric: { name: 'Electric', icon: '⚡', color: '#ffd83d', dark: '#8f7410', mech: 'Haste',   blurb: 'Haste speeds up your team\'s cooldowns; Charge pushes allies\' timers forward.' },
  ice:      { name: 'Ice',      icon: '❄️', color: '#8fe8ff', dark: '#2d7d93', mech: 'Chill',   blurb: 'Chill slows the enemy team; Freeze pushes enemy timers back.' },
  rock:     { name: 'Rock',     icon: '🪨', color: '#c49a6c', dark: '#6b4b2a', mech: 'Shield',  blurb: 'Shield soaks direct hits and burn (not poison or doom).' },
  poison:   { name: 'Poison',   icon: '☠️', color: '#b05cff', dark: '#5a2096', mech: 'Toxin',   blurb: 'Poison stacks never fade and pierce shields. Slow, then deadly.' },
  psychic:  { name: 'Psychic',  icon: '🔮', color: '#ff6fc8', dark: '#93266b', mech: 'Mind',    blurb: 'Expose makes the enemy take more damage (all kinds); Weaken makes them deal less.' },
  ghost:    { name: 'Ghost',    icon: '👻', color: '#8a8cff', dark: '#33358f', mech: 'Doom',    blurb: 'Doom piles up and detonates 5s after it starts, piercing shields.' },
  junk:     { name: 'Junk',     icon: '🗑️', color: '#9aa37a', dark: '#4b5233', mech: 'Scrap',   blurb: 'Scrap piles make every Junk mon hit harder. Some salvage gold after battle.' },
  sound:    { name: 'Sound',    icon: '🎵', color: '#ffa94d', dark: '#8f4f10', mech: 'Echo',    blurb: 'Echo repeats the move of the ally in front (or behind) at partial power. If there is none, an adjacent ally.' },
};
export const TYPE_KEYS = Object.keys(TYPES);

// m(id, name, type, tier, cooldown, damage, effects, passives, flavor)
// effects scale by level and POW roll. passives: start{...}, salvage, rebirth, regen
const m = (id, name, type, tier, cd, dmg, fx = {}, pas = {}, flavor = '') => ({ id, name, type, tier, cd, dmg, fx, pas, flavor });

export const MONS = [
  // ---------------- FIRE ----------------
  m('emberpup', 'Emberpup', 'fire', 1, 2.5, 4, { burn: 1.6 }, {}, 'Wags so hard its tail sets the rug on fire.'),
  m('cindermite', 'Cindermite', 'fire', 1, 1.6, 2, { burn: 1.2 }, {}, 'A spark with legs. Many legs.'),
  m('kilnkit', 'Kilnkit', 'fire', 2, 3, 7, { burn: 3 }, {}, 'Sleeps inside pottery ovens. Bakes its own snacks.'),
  m('flarebat', 'Flarebat', 'fire', 2, 2, 3, { burn: 2.6 }, {}, 'Hangs upside down from chimneys.'),
  m('pyrrhino', 'Pyrrhino', 'fire', 3, 4, 16, { burn: 4 }, {}, 'Charges first, cools down never.'),
  m('wickwisp', 'Wickwisp', 'fire', 3, 2.2, 3, { burn: 3, stoke: 20 }, {}, 'Fans existing flames into bonfires.'),
  m('magmaw', 'Magmaw', 'fire', 4, 4.5, 26, { burn: 8 }, {}, 'Its burps are classified as eruptions.'),
  m('sunmoth', 'Sunmoth', 'fire', 4, 3, 10, { burn: 7 }, { start: { burn: 14 } }, 'Opens the battle by flying into the enemy\'s face.'),
  m('infernodon', 'Infernodon', 'fire', 5, 4.5, 48, { burn: 14 }, {}, 'Extinct twice. Came back angrier.'),
  m('phoenyx', 'Phoenyx', 'fire', 5, 3.5, 14, { burn: 10 }, { rebirth: 15 }, 'Once per battle, rises from your team\'s ashes.'),

  // ---------------- WATER ----------------
  m('puddlefin', 'Puddlefin', 'water', 1, 2.5, 3, { heal: 6 }, {}, 'Lives in the puddle you just stepped in.'),
  m('bubblot', 'Bubblot', 'water', 1, 3, 2, { heal: 5, cleanse: 3 }, {}, 'Blows soap bubbles. Somehow they heal.'),
  m('ripplet', 'Ripplet', 'water', 2, 2.8, 6, { heal: 9 }, {}, 'Skips across ponds like a stone. Proud of it.'),
  m('mistle', 'Mistle', 'water', 2, 3.5, 2, { heal: 16 }, {}, 'A walking spa day.'),
  m('tidalon', 'Tidalon', 'water', 3, 3.5, 13, { heal: 12 }, {}, 'Brings the tide in, and also a fist.'),
  m('corallis', 'Corallis', 'water', 3, 3, 4, { heal: 13, cleanse: 5 }, {}, 'A reef that decided to go for a walk.'),
  m('krakenling', 'Krakenling', 'water', 4, 4, 24, { heal: 21 }, {}, 'Eight arms, eight hugs, eight punches.'),
  m('rainbeau', 'Rainbeau', 'water', 4, 3, 6, { heal: 26, lowheal: 50 }, {}, 'Shows up when things look darkest.'),
  m('leviathorn', 'Leviathorn', 'water', 5, 4, 44, { heal: 38 }, {}, 'Ships go around it. Islands too.'),
  m('aquarion', 'Aquarion', 'water', 5, 4, 16, { heal: 30, cleanse: 12 }, { regen: 7 }, 'Every battlefield becomes a spring.'),

  // ---------------- GRASS ----------------
  m('sproutle', 'Sproutle', 'grass', 1, 2.5, 3, { growth: 3 }, {}, 'Cheers the team on with tiny leaf pom-poms.'),
  m('thornbit', 'Thornbit', 'grass', 1, 1.8, 3, { selfgrow: 10 }, {}, 'Gets pricklier every time it pokes.'),
  m('leaflynx', 'Leaflynx', 'grass', 2, 2.5, 6, { growth: 4 }, {}, 'Camouflaged as a bush. A suspicious bush.'),
  m('budgeon', 'Budgeon', 'grass', 2, 3, 4, { growth: 6 }, {}, 'A pigeon that photosynthesizes.'),
  m('oakhorn', 'Oakhorn', 'grass', 3, 4, 14, { growth: 6 }, {}, 'Its antlers have their own squirrels.'),
  m('lashvine', 'Lashvine', 'grass', 3, 1.8, 5, { selfgrow: 16 }, {}, 'Whips faster and harder until it\'s a blur.'),
  m('petalisk', 'Petalisk', 'grass', 4, 3, 8, { growth: 10 }, {}, 'One glance and your team blooms.'),
  m('barkodile', 'Barkodile', 'grass', 4, 4.5, 24, { growth: 6, shield: 8 }, {}, 'Bark worse than its bite. Both are bad.'),
  m('elderoot', 'Elderoot', 'grass', 5, 5, 30, { growth: 15 }, {}, 'Older than the map. Remembers when it was a seed.'),
  m('verdragon', 'Verdragon', 'grass', 5, 3.5, 16, { growth: 8 }, { start: { growth: 15 } }, 'Where it lands, meadows sprout.'),

  // ---------------- ELECTRIC ----------------
  m('zapling', 'Zapling', 'electric', 1, 2, 3, { haste: 3 }, {}, 'Plug it in and it does laps.'),
  m('voltmouse', 'Voltmouse', 'electric', 1, 1.4, 3, { chargeNext: 0.4 }, {}, 'Chews cables. Passes the buzz along.'),
  m('sparkoon', 'Sparkoon', 'electric', 2, 2.5, 6, { haste: 4 }, {}, 'Steals batteries from remotes.'),
  m('dynamole', 'Dynamole', 'electric', 2, 3, 4, { charge: 0.35 }, {}, 'Digs tunnels that hum.'),
  m('thunderam', 'Thunderam', 'electric', 3, 3.5, 14, { haste: 5 }, {}, 'Headbutts so hard it causes weather.'),
  m('coilbee', 'Coilbee', 'electric', 3, 1.5, 4, { charge: 0.15 }, {}, 'Buzzes at 60 hertz.'),
  m('stormlion', 'Stormlion', 'electric', 4, 3.5, 20, { haste: 8 }, {}, 'Its roar comes with a flash, then a boom.'),
  m('teslug', 'Teslug', 'electric', 4, 3, 6, { charge: 0.35, haste: 3 }, {}, 'Slow. Except at conducting.'),
  m('raijumbo', 'Raijumbo', 'electric', 5, 4, 34, { haste: 9 }, {}, 'An elephant-sized thunderstorm.'),
  m('ampharaoh', 'Ampharaoh', 'electric', 5, 3, 14, { charge: 0.5 }, { start: { haste: 10 } }, 'Ancient ruler of the power grid.'),

  // ---------------- ICE ----------------
  m('frostkit', 'Frostkit', 'ice', 1, 2.5, 3, { chill: 4 }, {}, 'Its nose is always cold. Everything is.'),
  m('snowpeck', 'Snowpeck', 'ice', 1, 3, 3, { freeze: 1.2 }, {}, 'Pecks the mon in front of it into an ice cube.'),
  m('glaciub', 'Glaciub', 'ice', 2, 2.8, 6, { chill: 5 }, {}, 'A bear cub carved from a glacier.'),
  m('flurrfox', 'Flurrfox', 'ice', 2, 2.5, 4, { freeze: 1.1 }, {}, 'Its tail is a tiny blizzard.'),
  m('tuskfrost', 'Tuskfrost', 'ice', 3, 4, 15, { chill: 7 }, {}, 'Mammoth energy, in every sense.'),
  m('shiverling', 'Shiverling', 'ice', 3, 3, 5, { freezeTop: 1.3 }, {}, 'Always freezes whoever is about to act.'),
  m('blizzowl', 'Blizzowl', 'ice', 4, 3.5, 16, { chill: 6 }, {}, 'Silent wings, loud snowstorms.'),
  m('crystalynx', 'Crystalynx', 'ice', 4, 3.5, 10, { freezeAll: 0.35 }, {}, 'Refracts time itself. Briefly.'),
  m('glacierex', 'Glacierex', 'ice', 5, 5, 38, { chill: 9 }, {}, 'The last ice age was its nap.'),
  m('borealis', 'Borealis', 'ice', 5, 4, 14, { freezeAll: 0.35 }, { start: { chill: 10 } }, 'The northern lights, with teeth.'),

  // ---------------- ROCK ----------------
  m('pebblet', 'Pebblet', 'rock', 1, 2.8, 3, { shield: 9 }, {}, 'Collects smaller pebbles. Calls them family.'),
  m('gravelump', 'Gravelump', 'rock', 1, 3.5, 5, {}, { start: { shield: 30 } }, 'Starts every fight already behind a wall.'),
  m('cragcub', 'Cragcub', 'rock', 2, 3, 6, { shield: 10 }, {}, 'Headbutts boulders for fun.'),
  m('geodot', 'Geodot', 'rock', 2, 3.5, 3, { shield: 19 }, {}, 'Plain outside, sparkly inside.'),
  m('quarrion', 'Quarrion', 'rock', 3, 4, 15, { shield: 15 }, {}, 'A walking quarry. Hard hat not included.'),
  m('spikeshell', 'Spikeshell', 'rock', 3, 3, 5, { shield: 13, bash: 30 }, {}, 'Hits harder the thicker your walls are.'),
  m('monolith', 'Monolith', 'rock', 4, 4, 26, { shield: 25 }, {}, 'Nobody knows who put it there.'),
  m('obsidrake', 'Obsidrake', 'rock', 4, 3.5, 12, { shield: 18, burn: 3 }, {}, 'Volcanic glass, still warm.'),
  m('titanox', 'Titanox', 'rock', 5, 5, 46, { shield: 45 }, {}, 'Mountains call it "sir".'),
  m('colossite', 'Colossite', 'rock', 5, 4, 22, { shield: 32 }, { start: { shield: 90 } }, 'A fortress that learned to walk.'),

  // ---------------- POISON ----------------
  m('sludgit', 'Sludgit', 'poison', 1, 2.5, 2, { poison: 1.7 }, {}, 'Leaves a trail. Do not follow the trail.'),
  m('stinkbug', 'Stinkbug', 'poison', 1, 2, 3, { poison: 1 }, {}, 'Its personality is also bad.'),
  m('toxitoad', 'Toxitoad', 'poison', 2, 3, 5, { poison: 2.7 }, {}, 'Lick it once. Regret it forever.'),
  m('fungloom', 'Fungloom', 'poison', 2, 3.5, 2, { poison: 4.3 }, {}, 'Releases spores when sad. Always sad.'),
  m('venomba', 'Venomba', 'poison', 3, 3.5, 12, { poison: 4 }, {}, 'Dances. Bites. Dances again.'),
  m('miasmite', 'Miasmite', 'poison', 3, 3, 4, { poison: 3, spread: 10 }, {}, 'Makes existing poison multiply.'),
  m('plagueroo', 'Plagueroo', 'poison', 4, 4, 20, { poison: 7 }, {}, 'Kicks with toxic hind legs.'),
  m('belladonix', 'Belladonix', 'poison', 4, 3, 6, { poison: 8 }, {}, 'Pretty flower. Terrible idea.'),
  m('hydraxis', 'Hydraxis', 'poison', 5, 4.5, 32, { poison: 12 }, {}, 'Cut off one head and it grows two grudges.'),
  m('morbulb', 'Morbulb', 'poison', 5, 3.5, 10, { poison: 10 }, { start: { poison: 15 } }, 'The air turns green when it arrives.'),

  // ---------------- PSYCHIC ----------------
  m('mindle', 'Mindle', 'psychic', 1, 2.5, 3, { expose: 6 }, {}, 'Points out your flaws. Accurately.'),
  m('dozzle', 'Dozzle', 'psychic', 1, 3, 3, { weaken: 7 }, {}, 'Yawns. Everyone else gets sleepy.'),
  m('psyfox', 'Psyfox', 'psychic', 2, 2.8, 6, { expose: 7 }, {}, 'Knows where you\'re going to step.'),
  m('trancey', 'Trancey', 'psychic', 2, 3, 4, { weaken: 10 }, {}, 'Swings a pocket watch. Back and forth.'),
  m('cerebrox', 'Cerebrox', 'psychic', 3, 3.5, 14, { expose: 10 }, {}, 'Its brain is visible. And throbbing.'),
  m('mesmeray', 'Mesmeray', 'psychic', 3, 3, 5, { weaken: 8, expose: 6 }, {}, 'A manta ray of hypnotic patterns.'),
  m('oraclam', 'Oraclam', 'psychic', 4, 3.5, 18, { expose: 14 }, {}, 'Opens its shell to tell your fortune. It\'s bad.'),
  m('sphinxie', 'Sphinxie', 'psychic', 4, 4, 10, { weaken: 16 }, {}, 'Asks a riddle. Nobody hits hard while thinking.'),
  m('psyclops', 'Psyclops', 'psychic', 5, 4.5, 34, { expose: 18 }, {}, 'One eye. Sees everything.'),
  m('cosmind', 'Cosmind', 'psychic', 5, 3.5, 14, { expose: 10, weaken: 10 }, { start: { expose: 25 } }, 'Thinks in galaxies.'),

  // ---------------- GHOST ----------------
  m('boolet', 'Boolet', 'ghost', 1, 2.5, 2, { doom: 6.5 }, {}, 'Says boo. Means it.'),
  m('wisplet', 'Wisplet', 'ghost', 1, 2, 3, { lifesteal: 60 }, {}, 'Sips a little life with every touch.'),
  m('spookit', 'Spookit', 'ghost', 2, 3, 3, { doom: 12 }, {}, 'A haunted teapot. Whistles at midnight.'),
  m('ghoulpup', 'Ghoulpup', 'ghost', 2, 2.5, 6, { lifesteal: 60 }, {}, 'Fetches souls instead of sticks.'),
  m('wraithorn', 'Wraithorn', 'ghost', 3, 3.5, 6, { doom: 23 }, {}, 'You hear it a few seconds after it hits.'),
  m('lanternik', 'Lanternik', 'ghost', 3, 3, 10, { lifesteal: 60, doom: 6 }, {}, 'Its lantern burns on borrowed time.'),
  m('banshriek', 'Banshriek', 'ghost', 4, 4, 8, { doom: 44 }, {}, 'Its scream arrives late but loud.'),
  m('soulsipper', 'Soulsipper', 'ghost', 4, 3, 14, { lifesteal: 70 }, {}, 'Drinks through a bendy straw.'),
  m('phantomaw', 'Phantomaw', 'ghost', 5, 4.5, 12, { doom: 70 }, {}, 'The jaws close five seconds after you see them.'),
  m('reapurr', 'Reapurr', 'ghost', 5, 3.5, 28, { lifesteal: 50, execute: 100 }, {}, 'A cat with a scythe. Finishes what others start.'),

  // ---------------- JUNK ----------------
  m('trashling', 'Trashling', 'junk', 1, 2.5, 3, { scrap: 1 }, {}, 'One mon\'s trash is another mon\'s treasure.'),
  m('canrat', 'Canrat', 'junk', 1, 2, 3, {}, { salvage: 3 }, 'Brings home loose change after every fight.'),
  m('binbot', 'Binbot', 'junk', 2, 3, 6, { scrap: 2 }, {}, 'Collection day is every day.'),
  m('rustacean', 'Rustacean', 'junk', 2, 3, 7, { shield: 6 }, { salvage: 3 }, 'A crab in a rusty can. Sells the can afterwards.'),
  m('dumpsterix', 'Dumpsterix', 'junk', 3, 3.5, 12, { scrap: 2 }, {}, 'Rolls in on squeaky wheels.'),
  m('magnetick', 'Magnetick', 'junk', 3, 2.5, 7, { scrap: 1 }, { salvage: 6 }, 'Everything metal sticks to it. Including coins.'),
  m('crushbox', 'Crushbox', 'junk', 4, 4, 26, { scrap: 4 }, {}, 'A compactor with opinions.'),
  m('gearwolf', 'Gearwolf', 'junk', 4, 3, 10, { scrap: 2, scrapper: 100 }, {}, 'Howls at the scrap heap. Gets double from it.'),
  m('landfillion', 'Landfillion', 'junk', 5, 4.5, 46, { scrap: 5 }, {}, 'A lion made of everything you threw away.'),
  m('recyclops', 'Recyclops', 'junk', 5, 3.5, 26, { scrap: 3 }, { start: { scrap: 5 }, salvage: 9 }, 'Sorts the waste. Keeps the good stuff.'),

  // ---------------- SOUND ----------------
  m('chirpip', 'Chirpip', 'sound', 1, 2.5, 3, { echo: 40 }, {}, 'Repeats whatever the mon in front just did.'),
  m('drumbo', 'Drumbo', 'sound', 1, 2.2, 3, { selfgrow: 10 }, {}, 'Every beat louder than the last.'),
  m('hummingbard', 'Hummingbard', 'sound', 2, 3, 4, { echo: 55 }, {}, 'Hums along with its friends.'),
  m('bassloon', 'Bassloon', 'sound', 2, 3, 7, { chargeNext: 0.8 }, {}, 'Its bass drop pushes the next ally forward.'),
  m('amplifox', 'Amplifox', 'sound', 3, 3.5, 8, { echo: 70 }, {}, 'Ears like speakers. Turned up to 11.'),
  m('kazooka', 'Kazooka', 'sound', 3, 2.2, 6, { selfgrow: 20 }, {}, 'Plays the kazoo. It only gets worse.'),
  m('banjoar', 'Banjoar', 'sound', 4, 3.5, 10, { echo: 85 }, {}, 'A boar with a banjo. Duelling is encouraged.'),
  m('maestrich', 'Maestrich', 'sound', 4, 3, 8, { echoBack: 75 }, {}, 'Conducts the mon behind it.'),
  m('symphonix', 'Symphonix', 'sound', 5, 4, 15, { echoBoth: 50 }, {}, 'A whole orchestra in one bird.'),
  m('encorca', 'Encorca', 'sound', 5, 4, 28, { selfgrow: 15 }, { start: { haste: 10 } }, 'An orca rockstar. Always plays one more.'),
];
export const MON = Object.fromEntries(MONS.map(x => [x.id, x]));
// Balance knobs written by tools/balance.mjs from simulations:
// COST_ADJ = price change per mon (-5..+5, stronger archetypes cost more); TUNE = multiplier on all of a mon's numbers.
export const COST_ADJ = {"flarebat":5,"wickwisp":5,"ripplet":5,"tidalon":-5,"krakenling":-5,"lashvine":-5,"petalisk":5,"verdragon":5,"dynamole":-5,"stormlion":-5,"blizzowl":5,"crystalynx":5,"borealis":5,"geodot":5,"quarrion":-5,"spikeshell":5,"stinkbug":5,"toxitoad":-5,"plagueroo":-5,"psyfox":5,"psyclops":5,"cosmind":5,"soulsipper":-5,"reapurr":-5,"rustacean":-5,"dumpsterix":-5,"landfillion":-5,"corallis":5,"thunderam":-5,"fungloom":-5,"wisplet":5,"binbot":-5};
export const TUNE = {"cindermite":0.761,"kilnkit":0.955,"wickwisp":0.722,"infernodon":0.81,"puddlefin":0.9,"bubblot":0.904,"mistle":0.938,"tidalon":1.054,"krakenling":1.214,"rainbeau":1.068,"aquarion":1.167,"sproutle":1.045,"budgeon":1.171,"oakhorn":0.882,"lashvine":0.995,"petalisk":0.948,"barkodile":0.993,"zapling":1.033,"coilbee":0.817,"teslug":0.893,"raijumbo":0.858,"ampharaoh":0.597,"frostkit":1.073,"snowpeck":1.058,"glaciub":0.809,"tuskfrost":0.878,"blizzowl":0.993,"crystalynx":0.993,"borealis":0.899,"pebblet":0.728,"geodot":0.814,"monolith":1.055,"obsidrake":1.24,"colossite":1.153,"stinkbug":0.878,"plagueroo":0.992,"hydraxis":1.307,"morbulb":1.159,"mindle":1.015,"psyfox":0.88,"cerebrox":0.893,"mesmeray":0.901,"oraclam":0.823,"psyclops":1.395,"cosmind":0.85,"boolet":0.994,"ghoulpup":1.064,"wraithorn":1.06,"soulsipper":1.175,"phantomaw":0.919,"canrat":1.407,"rustacean":0.685,"dumpsterix":1.179,"magnetick":1.261,"crushbox":1.023,"gearwolf":0.856,"landfillion":1.303,"drumbo":1.142,"bassloon":1.331,"amplifox":0.875,"kazooka":1.018,"banjoar":0.847,"maestrich":0.829,"encorca":1.122,"emberpup":0.802,"sunmoth":1.003,"phoenyx":0.869,"corallis":1.016,"leviathorn":1.185,"elderoot":0.922,"verdragon":0.832,"voltmouse":0.919,"sparkoon":1.087,"dynamole":0.878,"shiverling":1.082,"glacierex":0.8,"gravelump":1.106,"cragcub":0.91,"spikeshell":0.953,"titanox":1.117,"fungloom":0.964,"miasmite":0.788,"belladonix":1.199,"dozzle":1.15,"trancey":1.125,"sphinxie":0.884,"wisplet":0.851,"spookit":1.126,"binbot":1.019,"recyclops":1.445,"hummingbard":1.025,"symphonix":1.219,"leaflynx":0.982,"flurrfox":1.216,"sludgit":0.936,"toxitoad":0.943,"lanternik":0.925,"trashling":0.961,"magmaw":1.216,"thunderam":0.939,"stormlion":0.72,"quarrion":1.072,"banshriek":1.037,"flarebat":0.874,"thornbit":0.97,"chirpip":0.898,"pyrrhino":1.105,"venomba":1.163,"reapurr":1.091,"ripplet":1.015};

// Effect metadata: icon, label, and how levels scale it.
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
  freeze:    { icon: '🧊', label: 'Freeze', scale: 'sec', unit: 's' },
  freezeTop: { icon: '🧊', label: 'Freeze fastest', scale: 'sec', unit: 's' },
  freezeAll: { icon: '🧊', label: 'Freeze all', scale: 'sec', unit: 's' },
  shield:    { icon: '🛡️', label: 'Shield', scale: 'fx' },
  bash:      { icon: '🪨', label: 'Bash (shield→dmg)', scale: 'pct', unit: '%' },
  poison:    { icon: '☠️', label: 'Poison', scale: 'fx' },
  spread:    { icon: '🦠', label: 'Spread', scale: 'pct', unit: '%' },
  stoke:     { icon: '♨️', label: 'Stoke', scale: 'pct', unit: '%' },
  expose:    { icon: '🎯', label: 'Expose', scale: 'pct', unit: '%' },
  weaken:    { icon: '🌀', label: 'Weaken', scale: 'pct', unit: '%' },
  doom:      { icon: '💀', label: 'Doom', scale: 'fx' },
  lifesteal: { icon: '🩸', label: 'Lifesteal', scale: 'pct', unit: '%' },
  execute:   { icon: '🗡️', label: 'Execute <30%', scale: 'pct', unit: '%' },
  scrap:     { icon: '🔩', label: 'Scrap', scale: 'fx' },
  scrapper:  { icon: '🔧', label: 'Extra scrap dmg', scale: 'pct', unit: '%' },
  echo:      { icon: '🎵', label: 'Echo ally in front', scale: 'pct', unit: '%' },
  echoBack:  { icon: '🎵', label: 'Echo ally behind', scale: 'pct', unit: '%' },
  echoBoth:  { icon: '🎶', label: 'Echo front & behind', scale: 'pct', unit: '%' },
  lowheal:   { icon: '🌊', label: 'Heal+ when <50%', scale: 'pct', unit: '%' },
  regen:     { icon: '✨', label: 'Regen/s', scale: 'fx' },
  salvage:   { icon: '🪙', label: 'Gold after battle', scale: 'lvl' },
  rebirth:   { icon: '🪶', label: 'Rebirth heal', scale: 'pct', unit: '%' },
};
export const ECHO_KEYS = ['echo', 'echoBack', 'echoBoth'];

// ------------------------------------------------------------------ triggers (v0.3)
// One extra trigger per mon (optional), separate from its cooldown cast.
// Combat: allyCast (filter by type and/or position: front, behind, adjacent), selfCast, lowHp, foeLow, sudden, shieldGain, healed, doomBoom
// Shop:   buy, sell, levelUp, trinket, allySold, reroll, win, loss, battleEnd
// v0.4 actions: { multicast: N } (casts N times now, cooldown resets), { plus: N } (+N flat hit damage, permanent for the run,
//   also from combat triggers), { junk: N } (gain N no-effect junk trinkets), { trinket: T } (gain a random real tier T trinket)
// do: { cast } (cast now, cooldown resets) | { fx: {effect: base} } (scaled like the move) | { pct: 'dmg'|'heal'|'shield', v }
//     | { grow: {atk|pow} } self, permanent | { growAll: {type, atk|pow} } | { growFront: {atk|pow} } | { growRand: {type, atk|pow} } | { gold }
// Rules: a mon is never triggered by a copy of itself; each mon fires at most once per trigger chain (stops loops). No other limits.
const tg = (on, d, extra = {}) => ({ on, do: d, ...extra });
export const TRIGGERS = {
  // rare "cast now" reactions
  wickwisp: tg('allyCast', { cast: 1 }, { type: 'fire' }),
  coilbee: tg('allyCast', { cast: 1 }, { type: 'electric' }),
  kazooka: tg('allyCast', { cast: 1 }, { from: 'front' }),
  rainbeau: tg('lowHp', { cast: 1 }),
  monolith: tg('lowHp', { cast: 1 }),
  banshriek: tg('sudden', { cast: 1 }),
  // combat effects
  encorca: tg('sudden', { multicast: 3 }),
  infernodon: tg('foeLow', { multicast: 2 }),
  symphonix: tg('lowHp', { multicast: 2 }),
  cerebrox: tg('allyCast', { fx: { expose: 3 } }, { type: 'psychic' }),
  stinkbug: tg('allyCast', { fx: { poison: 0.5 } }, { from: 'adjacent' }),
  ripplet: tg('allyCast', { fx: { heal: 2 } }, { from: 'adjacent' }),
  lanternik: tg('allyCast', { fx: { doom: 3 } }, { from: 'adjacent' }),
  thornbit: tg('allyCast', { fx: { selfgrow: 5 } }, { from: 'front' }),
  shiverling: tg('allyCast', { fx: { freezeTop: 0.3 } }, { from: 'behind' }),
  miasmite: tg('foeLow', { fx: { spread: 60 } }),
  glaciub: tg('foeLow', { fx: { freezeAll: 1 } }),
  flarebat: tg('foeLow', { fx: { burn: 15 } }),
  cragcub: tg('lowHp', { fx: { shield: 40 } }),
  mistle: tg('lowHp', { fx: { heal: 40 } }),
  raijumbo: tg('sudden', { fx: { haste: 30 } }),
  blizzowl: tg('sudden', { fx: { chill: 25 } }),
  spikeshell: tg('shieldGain', { pct: 'dmg', v: 25 }),
  corallis: tg('healed', { pct: 'shield', v: 25 }),
  wisplet: tg('healed', { fx: { doom: 2.5 } }),
  phantomaw: tg('doomBoom', { pct: 'heal', v: 30 }),
  // shop / run
  budgeon: tg('buy', { growFront: { pow: 0.1 } }),
  puddlefin: tg('sell', { growRand: { type: 'water', pow: 0.15 } }),
  canrat: tg('battleEnd', { junk: 1 }),
  magnetick: tg('battleEnd', { junk: 1 }),
  dumpsterix: tg('sell', { junk: 2 }),
  fungloom: tg('sell', { growAll: { type: 'poison', pow: 0.1 } }),
  kilnkit: tg('levelUp', { growAll: { type: 'fire', atk: 0.08 } }),
  hummingbard: tg('levelUp', { growAll: { type: 'sound', pow: 0.1 } }),
  recyclops: tg('win', { trinket: 2 }),
  crushbox: tg('levelUp', { trinket: 3 }),
  oraclam: tg('win', { trinket: 1 }),
  snowpeck: tg('trinket', { grow: { pow: 0.1 } }),
  geodot: tg('trinket', { grow: { pow: 0.2 } }),
  gearwolf: tg('trinket', { plus: 3 }),
  titanox: tg('trinket', { plus: 6 }),
  rustacean: tg('trinket', { plus: 1 }),
  psyfox: tg('trinket', { grow: { atk: 0.1, pow: 0.1 } }),
  trashling: tg('allySold', { grow: { atk: 0.1 } }),
  binbot: tg('allySold', { grow: { pow: 0.08 } }),
  mindle: tg('reroll', { grow: { pow: 0.02 } }),
  drumbo: tg('reroll', { grow: { atk: 0.03 } }),
  elderoot: tg('win', { plus: 6 }),
  ghoulpup: tg('win', { plus: 2 }),
  cindermite: tg('selfCast', { plus: 0.035 }),
  pyrrhino: tg('selfCast', { plus: 0.15 }),
  lashvine: tg('selfCast', { plus: 0.06 }),
  leaflynx: tg('win', { grow: { pow: 0.04 } }),
  toxitoad: tg('loss', { grow: { atk: 0.15 } }),
};
export const SHOP_TRIGGERS = ['buy', 'sell', 'levelUp', 'trinket', 'allySold', 'reroll', 'win', 'loss', 'battleEnd'];

// Ongoing auras: who = front | behind | adjacent | nonadjacent; atk/pow/speed in %, scaled x1/1.5/2 by level
export const AURAS = {
  sproutle: { who: 'adjacent', atk: 10 },
  zapling: { who: 'adjacent', speed: 8 },
  pebblet: { who: 'behind', atk: 15 },
  frostkit: { who: 'nonadjacent', pow: 8 },
  dozzle: { who: 'front', pow: 15 },
  chirpip: { who: 'front', atk: 12 },
  gravelump: { who: 'behind', atk: 20 },
  oakhorn: { who: 'adjacent', pow: 15 },
  petalisk: { who: 'nonadjacent', atk: 12 },
  sphinxie: { who: 'adjacent', speed: 10 },
  maestrich: { who: 'behind', speed: 15 },
  colossite: { who: 'behind', atk: 30, pow: 30 },
  verdragon: { who: 'adjacent', atk: 20 },
};
export const WHO_TEXT = { front: 'the ally in front', behind: 'the ally behind', adjacent: 'adjacent allies', nonadjacent: 'all allies not next to it' };
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
  if (t.on === 'allyCast') when = t.from ? `When ${{ front: 'the ally in front', behind: 'the ally behind', adjacent: 'an adjacent ally' }[t.from]} casts` : `When an ally ${TYPES[t.type].name} mon casts`;
  const d = t.do; let what = '';
  if (d.cast) what = 'it casts too (cooldown resets)';
  else if (d.multicast) what = `it casts ${d.multicast} times in a row (cooldown resets)`;
  else if (d.plus) what = `+${Math.round(d.plus * lvl * 100) / 100} hit damage for the run`;
  else if (d.junk) what = `gain ${d.junk * lvl} junk trinket${d.junk * lvl > 1 ? 's' : ''} (no effect, but they count as trinkets)`;
  else if (d.trinket) what = `gain a random tier ${Math.min(5, d.trinket + lvl - 1)} trinket`;
  else if (d.fx) what = Object.entries(d.fx).map(([k, v]) => `${FX[k].icon} ${FX[k].label} ${Math.round(fxValue(k, v, def, lvl, pow) * 10) / 10}${FX[k].unit || ''}`).join(', ');
  else if (d.pct) what = { dmg: `deals ${d.v}% of it as damage`, heal: `heals ${d.v}% of it`, shield: `gains ${d.v}% of it as shield` }[d.pct];
  else if (d.grow) what = `this mon gets ${statTxt(d.grow, lvl)} for the run`;
  else if (d.growAll) what = `all your ${TYPES[d.growAll.type].name} mons get ${statTxt(d.growAll, lvl)} for the run`;
  else if (d.growFront) what = `the mon in front gets ${statTxt(d.growFront, lvl)} for the run`;
  else if (d.growRand) what = `a random ${TYPES[d.growRand.type].name} ally gets ${statTxt(d.growRand, lvl)} for the run`;
  else if (d.gold) what = `+${d.gold * lvl} gold`;
  return `${when}: ${what}.`;
}
export function auraText(def, lvl = 1) {
  const a = AURAS[def.id]; if (!a) return '';
  const k = LV.pct[lvl], parts = [];
  if (a.atk) parts.push(`+${Math.round(a.atk * k)}% ATK`);
  if (a.pow) parts.push(`+${Math.round(a.pow * k)}% POW`);
  const one = a.who === 'front' || a.who === 'behind';
  if (a.speed) parts.push(`${one ? 'acts' : 'act'} ${Math.round(a.speed * k)}% faster`);
  return `Ongoing: ${WHO_TEXT[a.who]} ${a.speed && !a.atk && !a.pow ? '' : (one ? 'gets ' : 'get ')}${parts.join(', ')}.`;
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
  { id: 'coach', name: 'Coach Kip', face: '🧢', perk: 'Your front mon (slot 1) gets +30% ATK and POW.' },
  { id: 'gambler', name: 'Gambler Dex', face: '🎩', perk: 'First reroll each day is free.' },
  { id: 'mystic', name: 'Mystic Oona', face: '🧙‍♀️', perk: 'Start the run with a random tier 2 trinket.' },
  { id: 'junkyard', name: 'Junkyard Jo', face: '👷', perk: 'Selling gives +3 gold per copy. Junk always in the run.' },
  { id: 'tamer', name: 'Tamer Rex', face: '🤠', perk: 'Start with 2 random tier 1 mons.' },
];
export const AVATAR = Object.fromEntries(AVATARS.map(a => [a.id, a]));

// Trinkets have tiers 1-5. Merging a tier X mon offers 3 tier X trinkets; events offer trinkets of the shop's top tier.
// fx keys: dmg (hit %), speed (%), hp (%), fxp (effect power %), shield (start shield % HP), open (speed % first 4s),
// sd (sudden death drain cut %), slot1/slot6 (ATK+POW % for that slot), rage (hit % while under 50% HP),
// wind (once: heal % HP at <30%), type:{type:%} (ATK+POW for that type), goldDay, winGold, bench, rerolls, copy (shop copy chance %), offers
const tk = (id, tier, name, icon, desc, fx) => ({ id, tier, name, icon, desc, fx });
export const TRINKETS = [
  // tier 1
  tk('whetstone', 1, 'Whetstone', '🗡️', 'Your hits deal +6% damage.', { dmg: 6 }),
  tk('sneakers', 1, 'Sneakers', '👟', 'Your team acts 4% faster.', { speed: 4 }),
  tk('lunchbox', 1, 'Lunchbox', '🍱', 'Team HP +6%.', { hp: 6 }),
  tk('pebblecharm', 1, 'Pebble Charm', '🪨', 'Start each battle with a shield of 5% team HP.', { shield: 5 }),
  tk('coinpurse', 1, 'Coin Purse', '🪙', '+4 gold every day.', { goldDay: 4 }),
  tk('clover', 1, 'Lucky Clover', '🍀', 'Copies of your mons show up in the shop more often.', { copy: 10 }),
  // tier 2
  tk('hourglass', 2, 'Hourglass', '⏳', 'Your team acts 7% faster.', { speed: 7 }),
  tk('thickhide', 2, 'Thick Hide', '🦏', 'Team HP +12%.', { hp: 12 }),
  tk('prism', 2, 'Prism', '🔷', 'All type effects +12% (not hits).', { fxp: 12 }),
  tk('leaderbadge', 2, 'Leader Badge', '🎖️', 'Slot 1 mon gets +30% ATK and POW.', { slot1: 30 }),
  tk('fatwallet', 2, 'Fat Wallet', '👛', '+8 gold every day.', { goldDay: 8 }),
  tk('dice', 2, 'Loaded Dice', '🎲', '1 free reroll every day.', { rerolls: 1 }),
  // tier 3 (+ one type charm per type, generated below)
  tk('spikedcollar', 3, 'Spiked Collar', '⛓️', 'Your hits deal +12% damage.', { dmg: 12 }),
  tk('openingact', 3, 'Opening Act', '🎬', 'Your team acts 50% faster during the first 4 seconds.', { open: 50 }),
  tk('rearguard', 3, 'Rear Guard', '🛡️', 'Slot 6 mon gets +40% ATK and POW.', { slot6: 40 }),
  tk('warmblanket', 3, 'Warm Blanket', '🧣', 'Start each battle with a shield of 12% team HP.', { shield: 12 }),
  tk('overtime', 3, 'Overtime Boots', '🥾', 'Take 50% less sudden death drain.', { sd: 50 }),
  tk('goldenegg', 3, 'Golden Egg', '🥚', '+10 gold after every win.', { winGold: 10 }),
  tk('backpack', 3, 'Big Backpack', '🎒', '+2 bench slots.', { bench: 2 }),
  // tier 4
  tk('wardrum', 4, 'War Drum', '🥁', 'Your team acts 12% faster.', { speed: 12 }),
  tk('heartlocket', 4, 'Heart Locket', '💗', 'Team HP +22%.', { hp: 22 }),
  tk('crystalball', 4, 'Crystal Ball', '🔮', 'All type effects +25% (not hits).', { fxp: 25 }),
  tk('secondwind', 4, 'Second Wind', '🌬️', 'Once per battle, heal 15% team HP when under 30%.', { wind: 15 }),
  tk('berserker', 4, 'Berserker Mask', '👺', 'Your hits deal +30% damage while under 50% HP.', { rage: 30 }),
  tk('treasuremap', 4, 'Treasure Map', '🗺️', 'The shop shows 1 more offer.', { offers: 1 }),
  // tier 5
  tk('crown', 5, 'Crown of Kings', '👑', 'Hits +15%, type effects +15%, team HP +10%.', { dmg: 15, fxp: 15, hp: 10 }),
  tk('timeturner', 5, 'Time Turner', '⌛', 'Your team acts 18% faster.', { speed: 18 }),
  tk('phoenixfeather', 5, 'Phoenix Feather', '🪶', 'Once per battle, heal 30% team HP when under 30%.', { wind: 30 }),
  tk('dragonscale', 5, 'Dragon Scale', '🐉', 'Team HP +10% and start with a shield of 25% team HP.', { hp: 10, shield: 25 }),
  tk('elementalorb', 5, 'Elemental Orb', '🌈', 'All type effects +40% (not hits).', { fxp: 40 }),
  tk('goldengoose', 5, 'Golden Goose', '🪿', '+15 gold every day and +10 after every win.', { goldDay: 15, winGold: 10 }),
  // tier 6: legendary, only from merging a tier 5 mon to level 3
  tk('worldseed', 6, 'World Seed', '🌳', 'All your mons get +25% ATK and POW.', { all: 25 }),
  tk('clockwork', 6, 'Clockwork Heart', '⚙️', 'Your team acts 30% faster.', { speed: 30 }),
  tk('undying', 6, 'Undying Totem', '🗿', 'Once per battle, survive a lethal blow at 1 HP and heal 40% team HP.', { totem: 40 }),
  tk('mirror', 6, 'Mirror of Echoes', '🪞', 'Every cast of your mons also echoes at 25% power.', { mirror: 25 }),
  tk('dragonhoard', 6, 'Dragon Hoard', '💰', '+25 gold every day and +15 after every win.', { goldDay: 25, winGold: 15 }),
  tk('secondsun', 6, 'Second Sun', '☀️', 'Start each battle with a shield of 30% team HP, and the enemy burning.', { shield: 30, sunburn: 4 }),
];
// tier 0 = junk trinkets: no effect, stackable, only from junk-trinket triggers (they still fire "trinket gained")
for (const [id, name, icon] of [['bottlecap', 'Bottle Cap', '🔘'], ['rubberduck', 'Rubber Duck', '🦆'], ['oldsock', 'Old Sock', '🧦'], ['bentspoon', 'Bent Spoon', '🥄'], ['lostbutton', 'Lost Button', '🪡'], ['banana', 'Banana Peel', '🍌']])
  TRINKETS.push(tk(id, 0, name, icon, 'Junk. Does nothing, but counts as a trinket.', {}));
export const trinketPrice = (t) => 10 + 10 * t.tier;
for (const t of Object.keys(TYPES)) TRINKETS.push(tk('charm_' + t, 3, `${TYPES[t].name} Charm`, TYPES[t].icon, `Your ${TYPES[t].name} mons get +30% ATK and POW.`, { type: { [t]: 30 } }));
export const TRINKET = Object.fromEntries(TRINKETS.map(t => [t.id, t]));
export const ECON_KEYS = ['goldDay', 'winGold', 'bench', 'rerolls', 'copy', 'offers'];
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
