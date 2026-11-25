// Iterative balancer. Each pass: simulate (half the bots informed by the previous pass), then
// - pass 1: set COST_ADJ from each mon's strength vs its tier (stronger archetype = pricier, -5..+5)
// - every pass: nudge TUNE so a mon's win rate approaches 50% + 0.8 pt per gold of COST_ADJ
//   (an expensive mon should be a bit stronger per slot, a cheap one a bit weaker)
// usage: node tools/balance.mjs [passes=4] [bots=800] [--fresh]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const nums = args.filter(a => /^\d+$/.test(a)).map(Number);
const PASSES = nums[0] || 4, BOTS = nums[1] || 800;
const DATA = new URL('../js/data.js', import.meta.url);
const read = () => readFileSync(DATA, 'utf8');
const getObj = (src, name) => JSON.parse(src.match(new RegExp(`export const ${name} = (\\{.*\\});`))[1]);
const setObj = (src, name, obj) => src.replace(new RegExp(`export const ${name} = \\{.*\\};`), `export const ${name} = ${JSON.stringify(obj)};`);

const tierOf = {};
for (const m of read().matchAll(/m\('(\w+)', '[^']*', '\w+', (\d)/g)) tierOf[m[1]] = Number(m[2]);

let fresh = args.includes('--fresh');
for (let pass = 1; pass <= PASSES; pass++) {
  execFileSync('node', ['tools/gen.mjs', String(BOTS), '--learn', `--seed=${100 + pass}`, '--json=/tmp/pkm_stats.json'], { stdio: 'ignore' });
  const st = JSON.parse(readFileSync('/tmp/pkm_stats.json', 'utf8'));
  let src = read();
  const adj = getObj(src, 'COST_ADJ'), tune = getObj(src, 'TUNE');
  // tier means
  const mean = {};
  for (let t = 1; t <= 5; t++) {
    const ids = Object.keys(tierOf).filter(id => tierOf[id] === t && st.mon[id]);
    let n = 0, w = 0; for (const id of ids) { n += st.mon[id].n; w += st.mon[id].w; }
    mean[t] = w / n;
  }
  let moved = 0, spread = [];
  for (const id of Object.keys(tierOf)) {
    const s = st.mon[id]; if (!s || s.n < 40) continue;
    const dev = (s.w / s.n - mean[tierOf[id]]) * 100; // points vs tier mean
    if (fresh && pass === 1) adj[id] = Math.max(-5, Math.min(5, Math.round(dev / 2)));
    const target = (adj[id] || 0) * 0.8;
    const err = dev - target;
    spread.push(Math.abs(err));
    if (Math.abs(err) > 2) {
      const k = Math.max(0.9, Math.min(1.1, 1 - err * 0.006));
      tune[id] = +((tune[id] || 1) * k).toFixed(3);
      moved++;
    }
    if (!adj[id]) delete adj[id];
    if (tune[id] === 1) delete tune[id];
  }
  src = setObj(setObj(src, 'COST_ADJ', adj), 'TUNE', tune);
  writeFileSync(DATA, src);
  spread.sort((a, b) => a - b);
  console.log(`pass ${pass}: champions ${st.champions}, tuned ${moved} mons, median |err| ${spread[spread.length >> 1].toFixed(1)}pt, worst ${spread[spread.length - 1].toFixed(1)}pt`);
  fresh = fresh && false;
}
