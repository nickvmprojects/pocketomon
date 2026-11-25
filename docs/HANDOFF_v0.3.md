# Pocketomon handoff — v0.3

Use this to pick the project up in a new chat. Rules: `docs/POCKETOMON_DESIGN_v0.3.md`. Previous handoffs: v0.1, v0.2.

## Working agreement
The user does a lot of back-and-forth design. **Never start a new build until they explicitly say so** (e.g. "build v0.4"). Discuss options first.

## What changed in v0.3
- Triggers (43 mons) and auras (13 mons) — see design doc. Engine: `emit()` / `fireTrigger()` in battle.js (chain guard), shop side `fireShopTrigger()` / `fireAll()` in run.js.
- Grid positions (`inZone` in data.js), Echo on the grid.
- Hidden rating (`rateTeam`) for ranked matchmaking; shown Power = sum of stats (`monPower`).
- Shop layout A: 3-wide grids of large cards, bench row, bottom-sheet details (`.detail.sheet`), 🔔/✨ markers, bigger type.
- 3-second countdown before each battle with the opponent's name and trainer; first Skip skips the countdown.
- Rebalance: fresh `COST_ADJ`, new `TUNE`, Kilnkit/Wickwisp trimmed, Psychic +5%.
- Cache busting: every module import ends in `?v=0.3` (and index.html). Bump all together on release:
  `sed -i 's/?v=0.3/?v=0.4/g' index.html js/*.js tools/gen.mjs`

## v0.4 ideas from the user (to DESIGN together before building)
- Shop flair: bells and whistles on merges; a gift animation on screen when you get a trinket.
- One shop slot reserved for a single trinket offer you can buy.
- Drag and drop in the shop instead of tap-to-select.
- Multicast X trigger action: the mon repeats its cast X times (multicast can't multicast itself).
- Permanent absolute (flat) stat gains per trigger: small for frequent triggers (on cast), big for rare ones (on win, on trinket gain).
- Trinket-generating triggers: basic mons give no-effect "junk" trinkets (just to feed trinket triggers), rarer mons give real trinkets. Enables a "weak early, snowball through trinkets" strategy.

## Files
- `js/data.js` — content + tuning (`COST_ADJ`, `TUNE`, `TRIGGERS`, `AURAS`, `inZone`, `triggerText`, `auraText`).
- `js/battle.js` — engine, triggers, auras, `rateTeam`.
- `js/run.js` — run state, shop, merges, trinket rewards, shop triggers, snapshots (with `rating`), matchmaking.
- `js/bot.js` — bots (grid-aware arrange, trinket picks, informed mode).
- `js/art.js` — procedural art. `js/ui.js` — screens. `js/snapdata.js` — generated library.
- `tools/gen.mjs`, `tools/balance.mjs`, `tools/strength.json`, `tools/patch_mons.py`.
