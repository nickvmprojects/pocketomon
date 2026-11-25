// Pocketomon — game data. All numbers are first-pass and tuned by tools/gen.mjs.
export const VERSION = '0.1';

export const RULES = {
  battleSeconds: 30,       // regular time
  hardCapSeconds: 60,      // safety cap (sudden death almost always ends it sooner)
  suddenDeathRamp: 0.015,  // drain = maxHp * ramp * secondsIntoSuddenDeath, every second
  teamSlots: 6,
  benchSlots: 4,
  shopSlots: 5,
  startLives: 5,
  winsToChampion: 10,
  rerollCost: 1,
  typesPerRun: 5,
  copyBias: 0.2,           // chance a shop slot shows a copy of a mon you own
  shieldCap: 0.5,          // shield can't exceed 50% of max HP
};

export const teamHp = (day) => 200 + day * 100;
export const income = (day) => Math.min(11 + day, 16);
export const price = (tier) => tier + 2;              // 3,4,5,6,7
export const sellPerCopy = (tier) => 1 + Math.floor(tier / 2); // 1,2,2,3,3

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
export function fxValue(key, base, tier, lvl, pow = 1) {
  const sc = FX[key] ? FX[key].scale : 'fx';
  if (sc === 'lvl') return base * lvl;
  const lv = sc === 'dmg' ? LV.dmg : sc === 'sec' ? LV.sec : sc === 'pct' ? LV.pct : LV.fx;
  const flat = sc === 'dmg' || sc === 'fx';
  return base * lv[lvl] * pow * (flat ? TIER_SCALE[tier] : 1);
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
  m('canrat', 'Canrat', 'junk', 1, 2, 3, {}, { salvage: 1 }, 'Brings home loose change after every fight.'),
  m('binbot', 'Binbot', 'junk', 2, 3, 6, { scrap: 2 }, {}, 'Collection day is every day.'),
  m('rustacean', 'Rustacean', 'junk', 2, 3, 7, { shield: 6 }, { salvage: 1 }, 'A crab in a rusty can. Sells the can afterwards.'),
  m('dumpsterix', 'Dumpsterix', 'junk', 3, 3.5, 12, { scrap: 2 }, {}, 'Rolls in on squeaky wheels.'),
  m('magnetick', 'Magnetick', 'junk', 3, 2.5, 7, { scrap: 1 }, { salvage: 2 }, 'Everything metal sticks to it. Including coins.'),
  m('crushbox', 'Crushbox', 'junk', 4, 4, 26, { scrap: 4 }, {}, 'A compactor with opinions.'),
  m('gearwolf', 'Gearwolf', 'junk', 4, 3, 10, { scrap: 2, scrapper: 100 }, {}, 'Howls at the scrap heap. Gets double from it.'),
  m('landfillion', 'Landfillion', 'junk', 5, 4.5, 46, { scrap: 5 }, {}, 'A lion made of everything you threw away.'),
  m('recyclops', 'Recyclops', 'junk', 5, 3.5, 26, { scrap: 3 }, { start: { scrap: 5 }, salvage: 3 }, 'Sorts the waste. Keeps the good stuff.'),

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
export const RANK_STEP = 100;
export const RP = { win: 20, loss: -15, champion: 40 };

export const AVATARS = [
  { id: 'captain', name: 'Captain Brawn', face: '🧔', perk: 'Team HP +15%.' },
  { id: 'merchant', name: 'Merchant Mira', face: '👩‍💼', perk: '+2 gold every day.' },
  { id: 'scholar', name: 'Scholar Quill', face: '🧑‍🎓', perk: 'Shop shows 6 offers instead of 5.' },
  { id: 'breeder', name: 'Breeder Bea', face: '👩‍🌾', perk: 'Every merge adds +10% ATK and POW.' },
  { id: 'coach', name: 'Coach Kip', face: '🧢', perk: 'Your front mon (slot 1) gets +30% ATK and POW.' },
  { id: 'gambler', name: 'Gambler Dex', face: '🎩', perk: 'First reroll each day is free.' },
  { id: 'mystic', name: 'Mystic Oona', face: '🧙‍♀️', perk: 'Start the run with a random trinket.' },
  { id: 'junkyard', name: 'Junkyard Jo', face: '👷', perk: 'Selling gives +1 gold per copy. Junk always in the run.' },
  { id: 'tamer', name: 'Tamer Rex', face: '🤠', perk: 'Start with 2 random tier 1 mons.' },
];
export const AVATAR = Object.fromEntries(AVATARS.map(a => [a.id, a]));

export const TRINKETS = [
  { id: 'whetstone', name: 'Whetstone', icon: '🗡️', desc: 'All your hits deal +10% damage.' },
  { id: 'hourglass', name: 'Hourglass', icon: '⏳', desc: 'Your team acts 8% faster.' },
  { id: 'thickhide', name: 'Thick Hide', icon: '🦏', desc: 'Team HP +15%.' },
  { id: 'prism', name: 'Prism', icon: '🔷', desc: 'All type effects +20% (not hits).' },
  { id: 'openingact', name: 'Opening Act', icon: '🎬', desc: 'Your team acts 50% faster during the first 4 seconds.' },
  { id: 'overtime', name: 'Overtime Boots', icon: '🥾', desc: 'Take 50% less sudden death drain.' },
  { id: 'leaderbadge', name: 'Leader Badge', icon: '🎖️', desc: 'Slot 1 mon gets +35% ATK and POW.' },
  { id: 'rearguard', name: 'Rear Guard', icon: '🛡️', desc: 'Slot 6 mon gets +35% ATK and POW.' },
  { id: 'warmblanket', name: 'Warm Blanket', icon: '🧣', desc: 'Start every battle with a shield of 10% team HP.' },
  { id: 'fatwallet', name: 'Fat Wallet', icon: '👛', desc: '+2 gold every day.' },
  { id: 'backpack', name: 'Big Backpack', icon: '🎒', desc: '+2 bench slots.' },
  { id: 'dice', name: 'Loaded Dice', icon: '🎲', desc: '1 free reroll every day.' },
  { id: 'goldenegg', name: 'Golden Egg', icon: '🥚', desc: '+2 gold after every win.' },
  { id: 'luckycollar', name: 'Lucky Collar', icon: '🍀', desc: 'Copies of your mons show up in the shop more often.' },
];
export const TRINKET = Object.fromEntries(TRINKETS.map(t => [t.id, t]));
export const BATTLE_TRINKETS = ['whetstone', 'hourglass', 'thickhide', 'prism', 'openingact', 'overtime', 'leaderbadge', 'rearguard', 'warmblanket'];

export const BOT_NAMES = ['Ash Tray', 'Misty Window', 'Brock Lee', 'Gary Oakley', 'Professor Elm Street', 'Nurse Jolene', 'Team Rocket Science', 'Lass Vegas', 'Youngster Joey', 'Bug Catcher Bob', 'Hiker Mike', 'Swimmer Sue', 'Picnicker Pam', 'Cool Trainer Kai', 'Ace Ventura', 'Super Nerd Ned', 'Fisher Price', 'Biker Bart', 'Gentleman Jim', 'Beauty Bella', 'Psychic Sam', 'Blackbelt Bo', 'Juggler Jules', 'Rancher Rita', 'Tamer Tina', 'Ranger Rick', 'Burglar Barry', 'Scientist Sid', 'Sailor Sal', 'Camper Cam', 'Dragon Tamer Dot', 'Old Man Pete', 'Twin Tia & Tea', 'Cue Ball Carl', 'Rocker Roxy', 'Medium Maud', 'Channeler Chan', 'Bird Keeper Birdie', 'Artist Arturo', 'Collector Colin'];

export const CHANGELOG = [
  { v: '0.1', date: '2026-11-25', notes: [
    'First playable: 11 types, 110 mons (2 per type per tier), 9 avatars, 14 trinkets, 12 event kinds.',
    'Days: event → shop → one 30 second battle against a same-day snapshot. Sudden death after 30s.',
    'Merging: 3 copies → level 2, two level 2s → level 3, keeping the best ATK and POW of each copy.',
    'Normal and Ranked modes. Ranked matches by team power and moves you from Styrofoam to Diamond.',
    'Opponents come from a library of bot runs simulated with the real rules (friends\' snapshots need a small server, planned).',
  ] },
];
