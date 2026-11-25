# Pocketomon handoff — v0.4

Use this to pick the project up in a new chat. Rules: `docs/POCKETOMON_DESIGN_v0.4.md`. Older handoffs: v0.1–v0.3 (v0.3 has the full file map).

## Working agreement
Lots of back-and-forth design. **Never start a new build until the user explicitly says so.**

## What changed in v0.4
- Shop trinket slot (`run.tshop`, `rollTrinketOffer`, `buyTrinket`, `trinketPrice`).
- Junk trinkets (tier 0), `gainTrinket()` as the single entry point for any trinket (queues a gift + fires triggers).
- Trigger actions `multicast`, `plus`, `junk`, `trinket`; events `selfCast`, `battleEnd`. Combat `plus` gains come back in `simulate().gains` and are applied by `finishBattle(run, won, opp, gains)`.
- UI: drag and drop (`DRAG` module in ui.js), celebration queue (`run.celebrate`, `playCelebrations`), trinket card + sheet, grouped trinket icons, battle result lists damage gained.
- Rebalance + regenerated library. Cache-bust tag is `?v=0.4` (bump all together: `sed -i 's/?v=0.4/?v=0.5/g' index.html js/*.js tools/gen.mjs`).

## v0.5 plan from the user (design together first)
- Rework the shop UI: v0.3/v0.4 cards are now too big. **No scrolling, ever**: the whole shop (team, bench, shop, trinket, buttons) must fit one phone screen.
- Keep drag and drop for buying, accepting only clear, deliberate movements to avoid accidents.
