# Pocketomon handoff — v0.6b

Use this to pick the project up in a new chat. Rules: `docs/POCKETOMON_DESIGN_v0.6.md`. Older handoffs v0.1–v0.5 (v0.3 has the file map, v0.4 the trigger/trinket systems, v0.5 the no-scroll interaction rules).

## Working agreement
Lots of back-and-forth design. **Never start a new build until the user explicitly says so.** UX goal: avoid accidents, reduce frustration. Portrait layout for now (landscape maybe later).

## v0.6b (readability patch)
- Brighter secondary text (`--dim` #c8cff0), darker panels behind small text, medium weight for small text, darker pinks/reds behind white text (primary buttons, team header, hit badges), plain ❚❚ pause icon.
- Every text colour passes WCAG contrast for its size (checked automatically with a Playwright script over title, event, shop, details, help, battle and result screens; emojis excluded).
- Cache-bust tag is now `?v=0.6b` (bump: `sed -i 's/?v=0.6b/?v=0.7/g' index.html js/*.js tools/gen.mjs`).

## What changed in v0.6
- Merge chain → one trinket pick (L3 = tier + 1); 6 tier-6 trinkets (`worldseed`, `clockwork`, `undying`, `mirror`, `dragonhoard`, `secondsun`) with new bonus keys `all`, `totem`, `mirror`, `sunburn` in battle.js.
- `previewTeam()` + `ui.prev` → effective stats, `statBadges`, `buffCls`, `srcLines`, aura outlines (`aurahit`).
- Battle: inspect panel (`renderInsp`, frames now carry per-unit `rp` ramp and `pl` flat damage), pause, 2× toggle (`prof.speed` is 1 or 2), Hide/Show result.
- Visual refresh: Pixelify Sans from Google Fonts (falls back to system fonts offline), coloured `.zlabel` strips, name+price strip on cards, gold pill, chunky Reroll/Battle, bigger HP bars, trainer portraits, LV tags.
- Prices end in 0/5 (`COST_ADJ` ∈ {−5, +5}); `balance.mjs --fresh` keeps that rule.

## Future plans from the user (design together first)
- **v0.7: mon art update (pinned).** Paths the user is weighing: (1) "Mugen style" pop-culture parodies, (2) designs for friends who love Dragon Ball Z and Saint Seiya, (3) something more unique. Claude can't draw recognizable copyrighted characters, even as parodies; it suggested original themes instead (martial-arts power escalation, public-domain constellation/zodiac warriors, a junk/waste world, etc.). The art change will likely rework types and triggers thematically.
- **v0.8 or later — "real time tuning update":** all mon details loaded from a data file in the repo that is linked to a Google Sheet (or similar) the user can edit, with changes flowing into the game. How and when the game loads changes is still to be discussed.
- Open from v0.5: keep or drop the Buy/Sell buttons next to drag and drop (waiting on feedback).
