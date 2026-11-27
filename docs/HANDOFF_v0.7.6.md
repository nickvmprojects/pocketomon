# Pocketomon handoff — v0.7.6 (levels 4+, trinket overhaul)

Live: https://nickvmbox.duckdns.org/pocketomon/ · classic v0.7: /pocketomon/classic/ (own saved run now)

## Decisions (user, 2026-11-26)
- Levels past 3: each extra copy after level 3 = +1 level, no cap. Every level past 3 queues a tier 6 trinket pick.
  Curves continue: hit ×0.6/level (L3 2.4 → L4 3.0), effects ×0.45, seconds ×0.2, percents ×0.35 (`LV` in data.js, `LV_STEP`).
  Stars: ★/★★/★★★ then "★4", "★5"...
- Shop: beings owned at level 3+ have 25% weight in the random pool (`RULES.highLvlOdds`), excluded from the copy bias.
  Lucky Clover (`noFade`) cancels both.
- Cooldowns +0.5s on every being (`CD_NERF` post-process in data.js; roster literals unchanged). No damage compensation:
  day 1 average fight 16.4s (was ~14.6s).
- Trinkets repeat and stack. Caps via `max`: Big Backpack 2, Treasure Map 2, tier 6 legendaries 1 each.
- Trinket overhaul accepted without review ("try it live, comment later"): no flat team-wide stat boosts.
  Kept: Coin Purse, Lucky Clover, Leader Badge, Fat Wallet, Loaded Dice, Rear Guard, Overtime Boots, Golden Egg,
  Big Backpack, Treasure Map, Phoenix Feather, Golden Goose, Undying Totem, Mirror of Echoes, Dragon Hoard, junk.
  Cut: Opening Act plus all flat stat trinkets. Charms → relics (one per dimension, change the mechanic).
  New: Coupon Book, Pocket Watch, Bottle of Sand, Spare Parts, Wishbone, Hand-me-downs, Mixtape, Glass Cannon,
  Lone Wolf, Rainbow Badge, Twin Fates, Hall of Fame, Fault Line, Chimera Crown, Time Turner (reworked),
  Paragon's Laurel, Clockwork Heart (reworked), Starforge Anvil.
- Old saves: `TRINKET_MIGRATE` maps removed ids to same-tier new ones (`R.migrateRun`, flag `run.mig076`).
- Run save key is now `pocketomon.run.v2` (copied from v1 on first load); classic keeps v1.

## Sim (600 bots, regenerated snapdata)
Most-fielded: Pocket Watch, Bottle of Sand, Mixtape, Leader Badge (~55% win). Legendaries ~80% (expected).
Weakest: Rainbow Badge 48%, Hall of Fame 47%, Lullaby Box 45% (watch these).

## Next
- User tries 0.7.6 live, then comments on trinkets.
- Discuss the Vlambeer/Balatro-style battle presentation prototype (concept shared in chat 2026-11-27).
- v0.8 Workshop plan unchanged.
