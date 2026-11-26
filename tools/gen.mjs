// Population simulation: N bot runs play day by day against each other's same-day
// snapshots. Prints balance stats and (with --write) saves js/snapdata.js.
// usage: node tools/gen.mjs [bots=600] [--write] [--seed=1]
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { MON, MONS, TYPES, BOT_NAMES, RULES, TRINKET, price } from '../js/data.js?v=0.6b';
import { makeRng } from '../js/rng.js?v=0.6b';
import * as R from '../js/run.js?v=0.6b';
import { simulate } from '../js/battle.js?v=0.6b';
import { makeProfile, botDay } from '../js/bot.js?v=0.6b';

const args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) || 600);
const WRITE = args.includes('--write');
const SEED = Number((args.find(a => a.startsWith('--seed=')) || '--seed=7').split('=')[1]);
const PER_DAY = 50;
const LEARN = args.includes('--learn');
const KNOW_PATH = new URL('./strength.json', import.meta.url);
const KNOW = existsSync(KNOW_PATH) ? JSON.parse(readFileSync(KNOW_PATH, 'utf8')) : null;

const master = makeRng(SEED);
const bots = [];
for (let i = 0; i < N; i++) {
  const run = R.newRun('normal', (master() * 4294967296) >>> 0);
  const r = makeRng((master() * 4294967296) >>> 0);
  // half the bots know which mons won most in the last --learn pass (so strong mons get over-picked if they exist)
  const informed = KNOW && i % 2 === 0;
  bots.push({ run, r, informed, prof: makeProfile(r, run, informed ? KNOW : null), name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '') });
}

const library = {};
const stats = { pred: { n: 0, ok: 0 }, predP: { n: 0, ok: 0 }, byDay: {}, mon: {}, type: {}, trk: {}, ends: { champion: 0, out: 0 }, sudden: 0, battles: 0, ties: 0 };
const monStat = (id) => stats.mon[id] || (stats.mon[id] = { n: 0, w: 0 });
const typeStat = (t) => stats.type[t] || (stats.type[t] = { n: 0, w: 0 });

for (let day = 1; day <= 20; day++) {
  const alive = bots.filter(b => b.run.phase !== 'over');
  if (!alive.length) break;
  for (const b of alive) botDay(b.run, b.r, b.prof);
  const snaps = alive.map(b => ({ b, s: R.snapshot(b.run, b.name) }));
  // library sample spread over power
  const sorted = snaps.map(x => x.s).sort((a, c) => a.power - c.power);
  const step = Math.max(1, sorted.length / PER_DAY);
  library[day] = [];
  for (let k = 0; k < sorted.length && library[day].length < PER_DAY; k += step) library[day].push(sorted[Math.floor(k)]);
  const ds = stats.byDay[day] = { n: 0, t: 0, sudden: 0, power: 0, lv2: 0, lv3: 0, mons: 0, tmin: 99, tmax: 0, under15: 0, hpLeft: 0 };
  for (const { b, s } of snaps) {
    let opp = master.pick(snaps);
    if (opp.b === b && snaps.length > 1) opp = snaps[(snaps.indexOf(opp) + 1) % snaps.length];
    const res = simulate(R.battleTeamFromSnap(s), R.battleTeamFromSnap(opp.s));
    const won = res.winner === 0;
    if (s.rating !== opp.s.rating) { stats.pred.n++; if ((s.rating > opp.s.rating) === won) stats.pred.ok++; }
    if (s.power !== opp.s.power) { stats.predP.n++; if ((s.power > opp.s.power) === won) stats.predP.ok++; }
    stats.battles++; ds.n++; ds.t += res.t; ds.tmin = Math.min(ds.tmin, res.t); ds.tmax = Math.max(ds.tmax, res.t);
    if (res.t > RULES.battleSeconds) { stats.sudden++; ds.sudden++; }
    if (res.t < 15) ds.under15++;
    ds.hpLeft += res.hp[res.winner] / res.maxHp[res.winner];
    if (res.hp[0] <= 0 && res.hp[1] <= 0) stats.ties++;
    ds.power += s.power;
    const types = {};
    for (const m of s.team) if (m) {
      ds.mons++; if (m.lvl === 2) ds.lv2++; if (m.lvl === 3) ds.lv3++;
      const st = monStat(m.id); st.n++; if (won) st.w++; if (b.informed) st.inf = (st.inf || 0) + 1;
      types[MON[m.id].type] = (types[MON[m.id].type] || 0) + 1;
    }
    for (const [t, c] of Object.entries(types)) if (c >= 3) { const ts = typeStat(t); ts.n++; if (won) ts.w++; }
    for (const t of s.trinkets) { const x = stats.trk[t] || (stats.trk[t] = { n: 0, w: 0 }); x.n++; if (won) x.w++; }
    R.finishBattle(b.run, won, opp.s, res.gains[0]);
    if (b.run.phase === 'over') stats.ends[b.run.result]++;
  }
}

// ---------- report ----------
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-';
console.log(`bots ${N}, battles ${stats.battles}, sudden death ${pct(stats.sudden, stats.battles)}, ties ${stats.ties}`);
console.log(`hidden rating predicts the winner ${pct(stats.pred.ok, stats.pred.n)} of the time; shown Power ${pct(stats.predP.ok, stats.predP.n)}`);
console.log(`champions ${stats.ends.champion} (${pct(stats.ends.champion, N)}), knocked out ${stats.ends.out}`);
console.log('day  n    avgT  min  max  <15s  sudden avgPow  L2%  L3%  winnerHP');
for (const [d, s] of Object.entries(stats.byDay)) {
  console.log(`${d.padStart(3)} ${String(s.n).padStart(4)}  ${(s.t / s.n).toFixed(1).padStart(5)} ${s.tmin.toFixed(1).padStart(4)} ${s.tmax.toFixed(1).padStart(4)}  ${pct(s.under15, s.n).padStart(4)}  ${pct(s.sudden, s.n).padStart(5)}  ${(s.power / s.n).toFixed(0).padStart(5)}  ${pct(s.lv2, s.mons).padStart(4)} ${pct(s.lv3, s.mons).padStart(4)}   ${pct(s.hpLeft, s.n)}`);
}
console.log('\nType stacks (3+ of a type on team): win rate');
for (const [t, s] of Object.entries(stats.type).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)) console.log(`  ${t.padEnd(9)} ${pct(s.w, s.n).padStart(4)}  (n=${s.n})`);
// usage = share of team slots of that tier vs a fair share (1.0 = average); win = win rate when fielded
console.log('\nMons by tier: win% · usage (1.0 = fair share) · price. Flags: ▲ strong/overused, ▼ weak/underused');
const flagged = [];
for (let tier = 1; tier <= 5; tier++) {
  const ms = MONS.filter(m => m.tier === tier);
  const total = ms.reduce((a, m) => a + (stats.mon[m.id] ? stats.mon[m.id].n : 0), 0);
  const rows = ms.map(m => { const st = stats.mon[m.id] || { n: 0, w: 0 }; return { id: m.id, w: st.n ? st.w / st.n : 0, use: total ? st.n / (total / ms.length) : 0, n: st.n, p: price(m) }; })
    .sort((a, b) => b.w - a.w);
  console.log(`  T${tier}: ` + rows.map(x => {
    const f = (x.w > 0.56 || x.use > 1.6) ? '▲' : (x.w < 0.44 || x.use < 0.5) ? '▼' : '';
    if (f) flagged.push(`${f}${x.id}(${(x.w * 100).toFixed(0)}%,${x.use.toFixed(1)}x)`);
    return `${x.id} ${(x.w * 100).toFixed(0)}/${x.use.toFixed(1)}/${x.p}${f}`;
  }).join(', '));
}
console.log(`\nFlagged (${flagged.length}): ${flagged.join(' ')}`);
console.log('\nTrinkets fielded (n, win%):');
console.log('  ' + Object.entries(stats.trk).sort((a, b) => b[1].n - a[1].n).map(([t, x]) => `${t} ${x.n}/${(100 * x.w / x.n).toFixed(0)}`).join(', '));

const JSON_OUT = (args.find(a => a.startsWith('--json=')) || '').slice(7);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ mon: stats.mon, type: stats.type, byDay: stats.byDay, champions: stats.ends.champion }));

if (LEARN) {
  const know = {};
  for (const m of MONS) { const st = stats.mon[m.id]; know[m.id] = st && st.n >= 30 ? +Math.pow(Math.max(0.2, st.w / st.n) / 0.5, 2).toFixed(2) : 1; }
  writeFileSync(KNOW_PATH, JSON.stringify(know));
  console.log('wrote tools/strength.json');
}

if (WRITE) {
  const out = `// Generated by tools/gen.mjs (${N} bot runs, seed ${SEED}). Snapshot library by day.\nexport const LIBRARY = ${JSON.stringify(library)};\n`;
  writeFileSync(new URL('../js/snapdata.js', import.meta.url), out);
  console.log(`\nwrote js/snapdata.js (${(out.length / 1024).toFixed(0)} KB)`);
}
