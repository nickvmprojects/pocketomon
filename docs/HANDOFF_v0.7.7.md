# Pocketomon handoff — v0.7.7 (balance pass: no sub-second fights, same-level merges, player-like bots)

Live: https://nickvmbox.duckdns.org/pocketomon/ · classic v0.7: /pocketomon/classic/

## Decisions (user, 2026-11-28)
- Levels past 3: two copies at the SAME level merge into the next (L3+L3 → L4, L4+L4 → L5...), like L2+L2 → L3.
  Copies: L3 = 6, L4 = 12, L5 = 24. Each merge past 3 = tier 6 trinket pick. Level 4+ is meant to be a special
  occasion (shop weight for owned L3+ beings stays 25%). Beings fed past 3 in v0.7.6 keep their level.
- Event where every choice is blocked gets a "Pass: +10 gold" choice (`R.ensurePassable`).
- Trinkets: ONE shop purchase per day; rerolls no longer restock the trinket slot (`rollShop(..., keepTrinket)`,
  `run.tBought`, `R.trinketBuysLeft`). New T5 Merchant's Satchel (+1/day, max 1).
- Pocket Watch: max 1; readied first cast deals 90% less damage (effects full strength).
- Trinkets never grant extra casts. Repeats come from combinations of beings only. Reworked: Mirror of Echoes
  (beings' echoes/copies +50%), Paragon's Laurel (highest-level being +15% speed per level above 2), Glass Cannon
  (first cast +50% damage), Twin Fates (twin gains 1s charge), Metronome (every 5th cast: others +0.3s charge).
- Permanent growth by tier (`TIER_GROWTH`): T1 50%, T2 65%, T3 80%, T4-5 100% (shop-trigger grow/plus, battle gains).
- Reaper Drone (T2 Necro): 50 → 36 damage, self-hurt 3% → 4% (it carried most early S-grade wins alone).
- Bots: new "tryhard" profile (1/3 of bots): picks dimensions from learned strength, rerolls hard, buys the daily
  trinket when it fits, scores rewards for synergy, and tests buys and layouts by simulating against 3 strong teams
  from the previous day. Tryhard win rate ~59% vs casual ~48%; champion rate ~38% vs ~12%.

## Test results (before push)
- Fuzz: 3,000 random runs / 273k actions, no merge-rule or trinket-limit violations, no stuck events.
- Library fights: no fight under 3s on any day; under 6s (S grade) 0-6% per day; S-grade damage ~79% from T4-T5.
- Abuse test (top teams + best tempo trinket stacks, even the old 5-watch exploit): fastest win 4.0s, none under 3s.
- Tools: tests are in chat-session scratch (levels/speed/abuse), not in the repo.

## Open
- Battle presentation: pixel sprites (B) + chain pot prototype under discussion; 10 hand-drawn beings need sprites.
- Sudden death ~6% of fights; >25s fights 10-30% on later days (watch the "slog" feeling).
