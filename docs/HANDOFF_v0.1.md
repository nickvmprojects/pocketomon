# Pocketomon handoff — v0.1

Use this to pick the project up in a new chat.

## What it is
Browser auto battler (static files, no build step) at `https://nickvmbox.duckdns.org/pocketomon/`, repo `nickvmprojects/pocketomon`, pulled onto the VM by the once-a-minute cron like the other projects. Full rules: `docs/POCKETOMON_DESIGN_v0.1.md`.

## Files
- `index.html`, `css/style.css`
- `js/data.js` — all content and tuning: rules, prices, tier odds, 11 types, 110 mons, effects metadata, ranks, trainers, trinkets, bot names, changelog.
- `js/battle.js` — pure deterministic battle engine (`simulate(teamA, teamB, {log})`). Runs in Node too.
- `js/run.js` — run state: days, events, shop, buying, merging, selling, snapshots, opponent picking.
- `js/bot.js` — bot players (used for the snapshot library and balance sims).
- `js/art.js` — procedural SVG art for every mon (seeded by id, styled by type and tier).
- `js/ui.js` — all screens and the battle replay. Saves to localStorage (`pocketomon.run.v1`, `pocketomon.profile.v1`).
- `js/snapdata.js` — generated opponent library. Don't edit by hand.
- `tools/gen.mjs` — population sim + balance report. `node tools/gen.mjs 800` prints stats; add `--write` to regenerate `js/snapdata.js` (do this after any balance change).
- `tools/patch_mons.py` — helper to bulk-edit mon numbers from a JSON file.

## Mon format (data.js)
`m(id, name, type, tier, cooldown, damage, effects, passives, flavor)`. Effects keys: burn, heal, cleanse, growth, selfgrow, haste, charge, chargeNext, chill, freeze, freezeTop, freezeAll, shield, bash, poison, spread, stoke, expose, weaken, doom, lifesteal, execute, scrap, scrapper, echo, echoBack, echoBoth, lowheal. Passives: `start: {effect: value}`, `salvage`, `rebirth`, `regen`.

## Decisions made without the user (v0.1, open to change)
- 11 types: 8 classic (Fire, Water, Grass, Electric, Ice, Rock, Poison, Psychic) + 3 oddballs (Ghost/Doom, Junk/Scrap, Sound/Echo).
- 5 random types per run to keep merges reachable with 110 mons.
- Lives: 10 wins = Champion, 5 losses = out.
- Team HP kept at the suggested `200 + 100 × day`; mon numbers were tuned around it (tier compression on flat values).
- Ranked RP: +20 / −15 / +40 champion, 100 RP per rank, floor 0.
- Opponents are simulated bot snapshots until a small snapshot server exists.
- Merge auto-triggers on buy; copies roll ATK and POW separately; merge keeps the best of each.

## Ideas parked for later
- Snapshot server on the VM (friends fight each other's teams).
- Type synergy bonuses for 2/4/6 of a type.
- Selling refunds tuned per level, shop freeze UX polish, battle speed presets.
- Battle log / damage breakdown per mon after a fight.
