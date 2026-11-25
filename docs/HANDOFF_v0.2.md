# Pocketomon handoff — v0.2

Use this to pick the project up in a new chat. Rules: `docs/POCKETOMON_DESIGN_v0.2.md`. Previous: `docs/HANDOFF_v0.1.md`.

## What it is
Browser auto battler (static files, no build step) at `https://nickvmbox.duckdns.org/pocketomon/`, repo `nickvmprojects/pocketomon`, pulled onto the VM by the once-a-minute cron. Linked from the vmhub hub page.

## What changed in v0.2
- Merges offer a pick of 3 trinkets of the merged mon's tier. Trinkets now have tiers 1-5 (37, including a Charm per type), applied generically through `trinketBonus()` in data.js.
- Prices ≈ 10 × tier ± 5 (`COST_ADJ`), economy rescaled (income 40→90, reroll 3, sell half).
- Ranked: rank moves at run end by wins (6+ up, 5 holds, under 5 down). Profile stores `rank`/`peakRank`; old RP migrates.
- Battle confirmation modal (warns about empty slots / unspent gold).
- Art v2: 32 body families (2-3 per type), gradients, tier 4 sparkles, tier 5 crown + aura, idle bob.
- Balance: `TUNE` multipliers per mon from `tools/balance.mjs`; Psychic expose/weaken decay 2 → 1.5 per second.
- Title splash text (tap to cycle), defaulting to the Futurama nod the user asked for.
- Saves: run format bumped to `v: 2` (v0.1 runs in progress reset).

## Files
- `js/data.js` — content + tuning: rules, prices (`price(def)`), `COST_ADJ`, `TUNE`, `fxValue(key, base, def, lvl, pow)`, types, 110 mons, trinkets, ranks (`rankDelta`), trainers, changelog.
- `js/battle.js` — deterministic engine; trinkets via `team.bonus`.
- `js/run.js` — run state, shop, merging + `trinketQueue` / `currentTrinketChoice` / `chooseTrinket`, events (`validTarget`), snapshots.
- `js/bot.js` — bots (price-aware; optional `know` table for informed bots; picks trinkets).
- `js/art.js` — procedural SVG per mon (`BODIES[type]` families).
- `js/ui.js` — screens, battle replay, ranked end-of-run logic (`finishRunStats`).
- `js/snapdata.js` — generated opponent library.
- `tools/gen.mjs` (sim + report, `--write`, `--learn`, `--json=`), `tools/balance.mjs` (auto-tuner), `tools/strength.json` (informed-bot table), `tools/patch_mons.py`.

## Ideas parked
- Snapshot server on the VM so friends fight each other's teams.
- Type synergy bonuses; per-mon damage breakdown after battle; champion bonus in ranked (e.g. +2 ranks for 10 wins).
- Cache busting: every module import ends in ?v=X (and index.html). Bump all of them together on release: sed -i 's/?v=0.2/?v=0.3/g' index.html js/*.js tools/gen.mjs
