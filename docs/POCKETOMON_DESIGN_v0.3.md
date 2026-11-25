# Pocketomon — design v0.3

Simple asynchronous team auto battler. Players buy mons in a shop, merge copies, and fight one 30 second battle per day against another trainer's same-day snapshot.

## Run structure
- A run is a sequence of **days**. Each day: **event** (pick 1 of 3) → **shop** → **one battle**.
- Day 1's event is the **trainer (avatar) pick**: 3 of 9 trainers, each with a run-long perk.
- Run ends at **10 wins** (Champion) or **5 losses** (lives). Typical length 10–15 days.
- **5 random types** (of 11) are active in each run's shop. With 110 mons, this keeps the pool at 10 mons per tier so copies show up often enough to merge. Junkyard Jo always adds Junk.

## Economy (v0.2: rescaled so prices are ~10 × tier)
- Income per day: `min(30 + 10 × day, 90)` gold (40 on day 1, capped at 90 from day 6). Unspent gold carries over (no interest).
- Mon price = `10 × tier + COST_ADJ` where COST_ADJ is −5..+5 per mon: stronger archetypes cost more. Set by `tools/balance.mjs` from simulations.
- Reroll 3 gold. Sell = half the mon's price per copy merged in (Junkyard Jo +3 per copy).
- Shop: 5 offers (Scholar +1, Treasure Map +1). Lock offers to keep them for the next day (unlocking is free). 20% of shop slots show a copy of a mon you already own (Lucky Clover +10%), so merges are reachable.
- Tier odds by day (T1..T5): d1 100% T1, d2 75/25, d3 60/40, d4 45/40/15, d5 35/40/25, d6 25/35/30/10, d7 20/30/30/20, d8 15/25/30/20/10, d9 10/20/30/25/15, d10+ 8/15/27/30/20.

## Team, bench, merging
- Team: 6 slots (they fight, in slot order). Bench: 4 slots (Big Backpack: +2).
- Each shop copy rolls **ATK** and **POW** independently between 85% and 115% (5% steps). ATK scales hits, POW scales effects.
- **3 level 1 copies → level 2**, **two level 2 → level 3**. **Every merge offers a pick of 3 trinkets of the merged mon's tier** (if a tier runs out, neighbouring tiers fill in). The battle button stays locked until you pick. Merges happen automatically on buying (no free slot needed for the merging copy). The merged mon keeps the **best ATK and best POW** among the copies (buffs included). Tier never changes.
- Level multipliers: hits ×1 / 1.6 / 2.4, flat effects ×1 / 1.5 / 2.1, percent effects ×1 / 1.5 / 2.0, seconds ×1 / 1.3 / 1.6.

## Battle rules (js/battle.js, deterministic)
- Both teams share one **team HP bar**. Team HP = `200 + 100 × day` (× bonuses: Captain +15%, Thick Hide +15%, Hot Springs +10% each).
- Clock ticks every 0.1s. Each tick: every mon charges (× team speed); mons whose charge reached their cooldown cast **in slot order, player before opponent on the same slot**; then the battle ends if any team is at 0. Both at 0 = tie = **player wins**.
- Every second: burn, poison, doom and regen tick; haste/chill decay 3 points, expose/weaken decay 2 points.
- After 30s, **sudden death**: each second both teams lose `1.5% × seconds into sudden death` of max HP (piercing). Hard cap 60s (higher HP% wins).
- No randomness in battles.

### Type mechanics
| Type | Mechanic | Rules |
|---|---|---|
| 🔥 Fire | Burn | Burn deals its stack value each second, then fades 30%. Blocked by shield. |
| 💧 Water | Heal | Heals team HP; overheal becomes shield at half value. Cleanse removes burn then poison. |
| 🌿 Grass | Growth | Team damage +X% for the rest of the battle (cap 150%). Some ramp only themselves. |
| ⚡ Electric | Haste / Charge | Haste: team acts faster (cap 60%). Charge: pushes allies' timers forward. |
| ❄️ Ice | Chill / Freeze | Chill: enemy acts slower (cap 50%). Freeze: pushes enemy timers back. |
| 🪨 Rock | Shield | Shield absorbs hits and burn (not poison, doom or sudden death). Cap 50% max HP. |
| ☠️ Poison | Toxin | Stacks never fade; each deals 0.33/s and pierces shield. |
| 🔮 Psychic | Expose / Weaken | Expose: enemy takes +X% from everything (cap 60%). Weaken: enemy hits deal −X% (cap 40%). |
| 👻 Ghost | Doom / Lifesteal | Doom piles up and detonates 5s after the first stack, piercing shield. Lifesteal heals. |
| 🗑️ Junk | Scrap / Salvage | Each scrap gives all your Junk mons +0.4 hit damage (× level). Salvage = gold after battle. |
| 🎵 Sound | Echo | Repeats the move of the ally in front (or behind) at X% power. Echoes never chain. |

Flat amounts (hits, burn, heal, shield, poison, doom, regen, scrap) are multiplied by a **tier compression** factor (T1 1.6, T2 1.35, T3 1.1, T4 0.95, T5 0.85) so day 1 fights finish in time and late fights don't end in 5 seconds. The UI always shows final values.

## Team grid and auras (v0.3)
- Slots 1-3 (index 0-2) are the **front row**, slots 4-6 the **back row**; slot 4 is behind slot 1. Cast order is still slot 1 → 6.
- **Adjacent** = left, right, front or behind neighbour (no diagonals). **Behind** = directly behind, **front** = directly in front.
- **Echo** uses the grid: Echo front → the ally in front (else an adjacent ally), Echo behind → the ally behind, Echo both → front and behind.
- **Auras** (13 mons, `AURAS` in data.js): ongoing +ATK / +POW / +speed % to the ally in front, behind, adjacent allies, or all non-adjacent allies. Scaled ×1 / 1.5 / 2 by level. Several auras on one mon add up; auras are computed from base stats so an aura never strengthens another aura.

## Triggers (v0.3)
Every mon keeps its cooldown cast. 43 mons also have one trigger (`TRIGGERS` in data.js):
- **Combat:** ally casts (filtered by type or by position: front / behind / adjacent), your team drops below 50% (once), the enemy drops below 50% (once), sudden death starts, your team gains shield, your team is healed, enemy Doom detonates.
- **Shop / run:** bought, sold, level up (merge), trinket gained, ally sold, reroll, after a win, after a loss.
- **Actions:** cast now with cooldown reset (rare: Wickwisp, Coilbee, Kazooka, Rainbeau, Monolith, Banshriek), apply an effect (scaled like the move), a % of the triggering amount (damage / heal / shield), permanent ATK/POW growth (self, a type, the mon in front, a random ally of a type), or gold.
- **Rules:** a mon is never triggered by a copy of itself (same species, any level), and each mon fires at most once per trigger chain, which makes loops impossible. No rate limits and no growth caps: balanced by simulation instead. Permanent growth is stored on the mon, so snapshots carry it.

## Events (day 2+)
Gold (10 + 3 × day), wild mon (free, tier = shop max or one below), mystery egg (one tier above the shop), training (+20% ATK), meditation (+20% POW), trinket (shop's top tier), hot springs (+10% HP), bag of dice (+4 free rerolls), sale (−5 gold per mon today), cloning vat (copy a level 1 mon, day 3+), coin flip (+30 / −10), lucky charm (+1 life).

## Trainers (avatars)
Captain Brawn (+15% HP), Merchant Mira (+8 gold/day), Scholar Quill (6 shop offers), Breeder Bea (merges +10% ATK/POW), Coach Kip (slot 1 +30%), Gambler Dex (first reroll each day free), Mystic Oona (random tier 2 trinket), Junkyard Jo (sell +3/copy, Junk always in), Tamer Rex (2 free T1 mons).

## Trinkets (tiers 1-5, 37 total)
- T1: Whetstone (hits +6%), Sneakers (speed +4%), Lunchbox (HP +6%), Pebble Charm (start shield 5%), Coin Purse (+4 gold/day), Lucky Clover (more copies).
- T2: Hourglass (speed +7%), Thick Hide (HP +12%), Prism (effects +12%), Leader Badge (slot 1 +30%), Fat Wallet (+8 gold/day), Loaded Dice (1 free reroll/day).
- T3: Spiked Collar (hits +12%), Opening Act (+50% speed first 4s), Rear Guard (slot 6 +40%), Warm Blanket (start shield 12%), Overtime Boots (−50% sudden death), Golden Egg (+10 gold per win), Big Backpack (+2 bench), plus a **Charm per type** (that type's mons +30% ATK and POW; only charms for the run's types are offered).
- T4: War Drum (speed +12%), Heart Locket (HP +22%), Crystal Ball (effects +25%), Second Wind (once: heal 15% under 30% HP), Berserker Mask (hits +30% under 50% HP), Treasure Map (+1 shop offer).
- T5: Crown of Kings (hits/effects +15%, HP +10%), Time Turner (speed +18%), Phoenix Feather (once: heal 30%), Dragon Scale (HP +10%, start shield 25%), Elemental Orb (effects +40%), Golden Goose (+15 gold/day, +10 per win).

## Modes and ranks
- **Normal**: opponent = random snapshot from the same day.
- **Ranked**: opponent = one of the 5 same-day snapshots whose **hidden rating** is closest to yours × (1 + 3% × rank index). The rank moves once at run end: **6+ wins up, 5 holds, under 5 down**.
- **Hidden rating** (`rateTeam` in battle.js): kill time = seconds to empty a passive dummy with the team's own HP; survive time = seconds lasted against a par attacker dealing HP/24 per second (75% hits affected by chill/weaken/expose, 25% piercing). Rating = survive / kill. Stored in every snapshot; computed for the player when the opponent is picked. It predicts the winner of real bot fights ~72% of the time (the shown Power: ~56%).
- **Shown ⚡ Power**: the plain sum of the team's stat numbers (hit + every effect value, with level, rolls and growth; cooldowns ignored). For the player to enjoy, deliberately not the real strength.

## Snapshots
- v0.1 has no server. Opponents come from `js/snapdata.js`: 800 bot runs simulated day by day with the real rules by `tools/gen.mjs`, 50 snapshots kept per day spread across power. Days beyond the library reuse the last available day at the current day's HP.
- Results are applied before the replay starts, so refreshing mid-battle can't reroll an opponent.
- Next step for real async play: a tiny API on the VM that stores player snapshots per day/mode and serves matches (same snapshot format as the library).

## Balance (tools/balance.mjs + tools/gen.mjs)
- `node tools/balance.mjs 4 3000` runs passes of 3,000 bot runs. Half the bots are "informed" (they over-value mons that won most in the previous pass), so a strong mon shows up as overused. Each pass nudges `TUNE` toward 50% win rate + 0.8 pt per gold of `COST_ADJ`. `--fresh` re-derives `COST_ADJ` (−5..+5) from raw strength.
- Bots place Echo mons and "when the ally in front casts" mons directly behind their strongest front-row mon, and "boost the ally behind" aura mons in the front row.
- v0.3 result (2,000 runs): ~16% of battles reach sudden death, ~20% of bot runs become Champion. Type stacks win 45–55%. Most mons win 43–58% within their tier. Trashling, Binbot and Gearwolf are picked about 2× a fair share by informed bots (growth carries) but win at normal rates.
- Regenerate the opponent library after any balance change: `node tools/gen.mjs 2000 --write`.
