// Pocketomon — game data. All numbers are first-pass and tuned by tools/gen.mjs.
export const VERSION = '0.2';

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
// Shop price = 10 x tier, adjusted -5..+5 per mon by how strong it is (COST_ADJ, tuned by tools/gen.mjs)
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
  sound:    { name: 'Sound',    icon: '🎵', color: '#ffa94d', dark: '#8f4f10', mech: 'Echo',    blurb: 'Echo repeats the move of the ally in front (or behind) at partial power.' },
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
export const COST_ADJ = {"emberpup":2,"cindermite":3,"kilnkit":3,"flarebat":1,"pyrrhino":-4,"wickwisp":3,"magmaw":-1,"sunmoth":-1,"infernodon":-3,"phoenyx":-1,"puddlefin":3,"bubblot":3,"ripplet":2,"mistle":-3,"tidalon":-5,"krakenling":-3,"rainbeau":-5,"leviathorn":1,"aquarion":-3,"sproutle":-3,"thornbit":2,"budgeon":-2,"oakhorn":1,"lashvine":-3,"petalisk":2,"barkodile":2,"verdragon":-1,"zapling":-5,"voltmouse":-1,"sparkoon":-1,"dynamole":1,"coilbee":2,"stormlion":1,"teslug":3,"raijumbo":2,"ampharaoh":5,"frostkit":-5,"snowpeck":-4,"glaciub":2,"flurrfox":-1,"tuskfrost":5,"shiverling":-1,"blizzowl":1,"crystalynx":2,"glacierex":2,"borealis":5,"pebblet":3,"gravelump":-1,"cragcub":-1,"geodot":2,"quarrion":-2,"spikeshell":-2,"monolith":-4,"obsidrake":-3,"titanox":-1,"colossite":-4,"sludgit":1,"stinkbug":3,"toxitoad":-2,"plagueroo":-2,"belladonix":-1,"hydraxis":-3,"morbulb":-5,"mindle":1,"dozzle":-2,"psyfox":4,"trancey":-1,"cerebrox":3,"mesmeray":3,"oraclam":3,"psyclops":2,"cosmind":4,"boolet":3,"spookit":-1,"ghoulpup":-2,"wraithorn":2,"lanternik":-2,"soulsipper":-4,"phantomaw":-5,"reapurr":-5,"canrat":-5,"rustacean":-3,"dumpsterix":-2,"magnetick":-4,"crushbox":-4,"gearwolf":-3,"landfillion":-5,"chirpip":1,"drumbo":-3,"hummingbard":2,"bassloon":-4,"amplifox":3,"kazooka":-3,"banjoar":3,"maestrich":2,"encorca":5};
export const TUNE = {"cindermite":0.983,"kilnkit":1.046,"wickwisp":0.93,"infernodon":0.897,"puddlefin":0.999,"bubblot":1.041,"mistle":0.961,"tidalon":0.968,"krakenling":1.115,"rainbeau":0.967,"aquarion":0.962,"sproutle":0.909,"budgeon":0.919,"oakhorn":0.964,"lashvine":1.032,"petalisk":0.932,"barkodile":0.99,"zapling":0.909,"coilbee":1.03,"teslug":0.916,"raijumbo":0.948,"ampharaoh":0.764,"frostkit":0.899,"snowpeck":0.943,"glaciub":0.935,"tuskfrost":0.913,"blizzowl":0.844,"crystalynx":0.901,"borealis":0.853,"pebblet":0.912,"geodot":0.986,"monolith":0.968,"obsidrake":1.072,"colossite":1.057,"stinkbug":0.988,"plagueroo":0.983,"hydraxis":1.063,"morbulb":0.96,"mindle":1.033,"psyfox":1.051,"cerebrox":0.892,"mesmeray":0.943,"oraclam":0.952,"psyclops":1.089,"cosmind":0.882,"boolet":1.107,"ghoulpup":1.014,"wraithorn":1.053,"soulsipper":1.085,"phantomaw":0.956,"reapurr":1.043,"canrat":0.989,"rustacean":0.925,"dumpsterix":1.157,"magnetick":1.048,"crushbox":0.896,"gearwolf":0.962,"landfillion":1.091,"drumbo":0.993,"bassloon":1.048,"amplifox":0.918,"kazooka":1.018,"banjoar":0.859,"maestrich":0.965,"encorca":1.237,"emberpup":0.946,"sunmoth":1.029,"phoenyx":0.914,"ripplet":1.038,"corallis":1.048,"leviathorn":1.115,"elderoot":0.979,"verdragon":0.869,"voltmouse":0.937,"sparkoon":0.98,"dynamole":0.989,"shiverling":1.077,"glacierex":0.82,"gravelump":1.046,"cragcub":1.012,"spikeshell":1.017,"titanox":1.139,"fungloom":1.002,"miasmite":0.863,"belladonix":1.028,"dozzle":1.008,"trancey":1.063,"sphinxie":1.192,"wisplet":1.045,"spookit":0.98,"binbot":1.069,"recyclops":1.275,"hummingbard":1.005,"symphonix":0.896,"leaflynx":0.89,"flurrfox":1.069,"sludgit":0.967,"toxitoad":0.904,"lanternik":0.934,"trashling":0.978,"magmaw":1.09,"thunderam":0.966,"stormlion":0.869,"quarrion":0.996,"banshriek":1.02,"flarebat":0.966,"thornbit":1.036,"chirpip":0.986,"pyrrhino":0.977};

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
  echo:      { icon: '🎵', label: 'Echo front', scale: 'pct', unit: '%' },
  echoBack:  { icon: '🎵', label: 'Echo behind', scale: 'pct', unit: '%' },
  echoBoth:  { icon: '🎶', label: 'Echo both', scale: 'pct', unit: '%' },
  lowheal:   { icon: '🌊', label: 'Heal+ when <50%', scale: 'pct', unit: '%' },
  regen:     { icon: '✨', label: 'Regen/s', scale: 'fx' },
  salvage:   { icon: '🪙', label: 'Gold after battle', scale: 'lvl' },
  rebirth:   { icon: '🪶', label: 'Rebirth heal', scale: 'pct', unit: '%' },
};
export const ECHO_KEYS = ['echo', 'echoBack', 'echoBoth'];

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
];
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
