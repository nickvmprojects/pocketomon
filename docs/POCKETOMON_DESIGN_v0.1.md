# Pocketomon — design v0.1

Simple asynchronous team auto battler. Players buy mons in a shop, merge copies, and fight one 30 second battle per day against another trainer's same-day snapshot.

## Run structure
- A run is a sequence of **days**. Each day: **event** (pick 1 of 3) → **shop** → **one battle**.
- Day 1's event is the **trainer (avatar) pick**: 3 of 9 trainers, each with a run-long perk.
- Run ends at **10 wins** (Champion) or **5 losses** (lives). Typical length 10–15 days.
- **5 random types** (of 11) are active in each run's shop. With 110 mons, this keeps the pool at 10 mons per tier so copies show up often enough to merge. Junkyard Jo always adds Junk.

## Economy
- Income per day: `min(11 + day, 16)` gold (12 on day 1, capped at 16 from day 5). Unspent gold carries over (no interest).
- Mon price = tier + 2 (3/4/5/6/7). Reroll 1 gold. Sell = (1 + floor(tier/2)) per copy merged in.
- Shop: 5 offers (Scholar: 6). Lock offers to keep them for the next day (unlocking is free). 20% of shop slots show a copy of a mon you already own (Lucky Collar: 35%), so merges are reachable.
- Tier odds by day (T1..T5): d1 100% T1, d2 75/25, d3 60/40, d4 45/40/15, d5 35/40/25, d6 25/35/30/10, d7 20/30/30/20, d8 15/25/30/20/10, d9 10/20/30/25/15, d10+ 8/15/27/30/20.

## Team, bench, merging
- Team: 6 slots (they fight, in slot order). Bench: 4 slots (Big Backpack: +2).
- Each shop copy rolls **ATK** and **POW** independently between 85% and 115% (5% steps). ATK scales hits, POW scales effects.
- **3 level 1 copies → level 2**, **two level 2 → level 3**. Merges happen automatically on buying (no free slot needed for the merging copy). The merged mon keeps the **best ATK and best POW** among the copies (buffs included). Tier never changes.
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

## Events (day 2+)
Gold, wild mon (free, tier = shop max or one below), mystery egg (one tier above the shop), training (+20% ATK), meditation (+20% POW), trinket, hot springs (+10% HP), bag of dice (+4 free rerolls), sale (−1 cost today), cloning vat (copy a level 1 mon, day 3+), coin flip (+9 / −3), lucky charm (+1 life).

## Trainers (avatars)
Captain Brawn (+15% HP), Merchant Mira (+2 gold/day), Scholar Quill (6 shop offers), Breeder Bea (merges +10% ATK/POW), Coach Kip (slot 1 +30%), Gambler Dex (first reroll each day free), Mystic Oona (random starting trinket), Junkyard Jo (sell +1/copy, Junk always in), Tamer Rex (2 free T1 mons).

## Trinkets
Whetstone, Hourglass, Thick Hide, Prism, Opening Act, Overtime Boots, Leader Badge, Rear Guard, Warm Blanket, Fat Wallet, Big Backpack, Loaded Dice, Golden Egg, Lucky Collar.

## Modes and ranks
- **Normal**: opponent = random snapshot from the same day.
- **Ranked**: opponent = one of the 5 same-day snapshots closest to your **team power** × (1 + 3% × rank index). Win +20 RP, loss −15 RP (floor 0), Champion +40. 100 RP per rank: Styrofoam → Wood → Iron → Bronze → Silver → Gold → Platinum → Diamond.
- **Team power** = Σ tierPower (10/14/19/25/32) × levelPower (1/1.8/2.8) × avg(ATK, POW), × HP bonus multiplier, × (1 + 4% per battle trinket).

## Snapshots
- v0.1 has no server. Opponents come from `js/snapdata.js`: 800 bot runs simulated day by day with the real rules by `tools/gen.mjs`, 50 snapshots kept per day spread across power. Days beyond the library reuse the last available day at the current day's HP.
- Results are applied before the replay starts, so refreshing mid-battle can't reroll an opponent.
- Next step for real async play: a tiny API on the VM that stores player snapshots per day/mode and serves matches (same snapshot format as the library).

## Balance snapshot (tools/gen.mjs, 800 bots)
- Average battle 21–26s across days, ~21% reach sudden death, ~3.5% ties.
- Type stacks (3+ of a type) win rate: 46–61%. Fire/Poison strongest, Psychic/Water weakest.
- ~20% of bot runs become Champion.
