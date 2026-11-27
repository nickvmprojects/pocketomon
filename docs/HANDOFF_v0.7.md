# Pocketomon handoff — v0.7 "Multiverse" (part 1)

Live: https://nickvmbox.duckdns.org/pocketomon/ · repo nickvmprojects/pocketomon · hub nickvmprojects/vmhub

## Working agreement (unchanged)
- Lots of back-and-forth design. **Never start a build until the user says "build vX".** Discuss options first.
- UX goal: avoid accidents, reduce frustration. The user plays and reviews on an Android phone.
- Handoff files carry the version in the file name.

## What v0.7 changed
- **Types are gone; 10 dimensions replace them.** The `type` field on a being now holds its dimension key
  (`fallen, martial, zodiac, giants, elven, necro, junk, abyss, dream, clock`). 100 beings, 2 per tier per dimension.
  Every dimension is in every run (`RULES.typesPerRun = 10`), so merges are rarer by design.
- **Roster sheet** (Claude Sheets artifact "Pocketomon v0.7 multiverse roster (draft)") has the design intent:
  Roster tab (role, cooldown, text, hidden synergy notes), Dimensions tab, Combos tab. The code in `js/data.js`
  follows it, with placeholder numbers that the simulations then tuned.
- **Roles**: `dmg`, `carry` (late carry), `support`, `enabler` → 37 damage/carry, 63 support/enabler.
- **Cooldowns** 3 (fast) to 8 (very slow), half steps allowed. **Team HP** curve B: `150 + 50·day + 12·day²`.
- **Damage scale by tier** `DMG_SCALE = [0, 1.8, 1.75, 1.9, 2.05, 2.2]` applies to hits, burn, poison and doom only
  (heals and shields are not scaled). `TIER_SCALE` is now all 1.

### Dimension mechanics (engine: `js/battle.js`)
| Dimension | Mechanic | Engine pieces |
|---|---|---|
| Fallen Earth | Last Stand (low HP = stronger) | `lastStand` mult, `x.lowX2` doubles effects under 50%, `pas.rally` (Brick), `overclock` (Mothership: next cast twice), `x.vsChill` / `x.vsBurn` (fairy pair) |
| Martial Realm | Ki → Transform | martial beings gain 1 Ki per cast; `ki` gives Ki to all allies; 5 Ki = +50% ATK/POW for 6s; `pas.kiLong`, `pas.train`, `kinova`, `copyLast` (Ashi), `x.transTwice` |
| Zodiac | Alignment | `x.el` fire/earth/air/water/all; adjacent same element = "Aligned" +20% ATK/POW; `perAlign`, `burst` (Ophiuchus uses up shield), `balance` (Libra), `pas.shieldCap` (Leo 75%) |
| Age of Giants | Hunters & Giants | `x.tags` hunter/giant; `perGiant`, `shieldPerHunter`, tag-filtered aura (Mara), `strip` |
| Elvenwood | Harmony | `x.tags` archer; `volleyAdj`, `volley` (Aelyth: archers cast now), `x.immune` (Kaelen ignores chill/sleep), `pas.overheal` (full-value overheal), `pas.auraX2` (World Tree doubles positive auras) |
| Necro Machines | Assimilate | negative auras (`who: 'all'`), `pas.absorb` (Omega), `pas.mainframe` (drained allies faster), `selfHurt`, `drain`, `sapGrowth` |
| Junkverse | Scrap | junk beings +0.5 hit per Scrap; `spendScrap`, `perScrap`, `healPerScrap`, `shieldPerTrinket` (uses total trinket count `ntrink`, junk included), `missingShield`, `pas.trinketPow`, `pas.scrapCap2` |
| The Abyss | Pressure | side-level `pressure` (cap 30, never fades); `perPressure`, `crush` (uses it up), `shieldPerPressure`, `pas.late` |
| Dreamscape | Sleep/Confuse | freeze effects = Sleep (side counts as Asleep for 2s); `vsSleep`, `dreamHeal`, `confuse`, `vsDebuff`, `perDebuff`, `pas.linger` |
| Clockwork City | Tempo | `every4`, `perAllyCast`, `pas.reset15` (Orrery), `pas.rewind` (Chronarch), haste/charge/echo |

- New auras zones: `row`, `all`; aura `tag` filter.
- **Battle report**: `simulate()` returns `report[side][slot] = { dmg, sup, casts }`. DoT damage is split between the
  beings that applied it; support = healing done + shield given + small credit for growth/haste.
- Frames carry `ki`, `tr` (transformed), `dm`, `pressure`, `sleep`.

### Art (`js/art.js`, `js/artspecs.js`)
- 200×200 portraits with a background, served as cached `<img>` data URLs (filters render once, no id clashes).
- 10 hand-drawn style samples in `HAND` (Skull-Drone, Pip, Leo, Rexalon, Lirien, Omega, Binkle, Kraken, Snoozle, Tick).
- The other 90 use the parts kit (`humanoid, quad, blob, robot, serpent, squid, fish, moth, bird, golem, construct, orb`)
  with a per-being spec in `SPECS`; the dimension style paints roles (main, alt, skin, dark, accent, glow, metal...).
- Styles: Fallen comic halftone · Martial manga ink · Zodiac stellar rose window · Giants woodcut · Elvenwood moonlit
  watercolor (night elves: lavender skin, huge ears) · Necro chrome & red neon · Junk crayon stickers · Abyss
  bioluminescence · Dream pastel bloom · Clock blueprint.
- `monSource(id)` gives raw SVG (for galleries/exports). Gallery script idea: render all into one page with `<img>`.

### UI
- Details: plain-language text from `def.text` with live numbers (`{key}`) and tappable **keywords** (popup, `D.KEYWORDS`).
  Role, tags and element chips. Keyword list also in How to play.
- Clear system font for small numbers (`--num`), titles stay pixel.
- Result box: You/Opponent tabs, damage and support bars scaled to the battle's top value, MVP per team.
  "Hide" shows damage badges on each being.
- Battle: Ki counter, Transform glow, 💤 sleep, 🌊 pressure chips, REWIND / LAST STAND / OVERCLOCK floaters.
- "Mondex" is now "Multidex" (portrait grid). Saved runs from older versions are discarded (`run.v` 3).

## Balance status (1000-bot sims)
- Day 1 fights avg 14.2s (63% under 15s), later days ~20s, sudden death ~11%.
- Dimension stacks (3+ on a team) win 45–62%; Martial and Fallen strongest, Necro weakest.
- Hidden rating predicts the winner ~71%.
- Tools: `node tools/balance.mjs [passes] [bots] [--fresh]`, `node tools/gen.mjs 1000 --learn`, `--write` for the snapshot library.

## Next: v0.8 "Workshop" (agreed design, not built)
- In-game Workshop page on the VM for friends (phone-first): browse beings as cards, edit stats with +/− steppers,
  upload art from gallery/camera (server resizes: card copy + full-size detail copy), free-text mechanic ideas.
- "Test it": quick in-browser simulation of the change (win rate / pick rate before vs after) before submitting.
- Approval: friends vote 👍, **the user has the final say**. Stats and art editable directly; mechanics are text ideas only.
- Access: one shared invite code + a display name.
- Group uses **WhatsApp**: no bot. Use share buttons (`wa.me/?text=`) and per-being links with Open Graph previews
  so links show the being's art in the chat.
- Needs a small Node service on the VM next to the static site (proposals, images, history/rollback).

## Locker (parked ideas)
- Buy/Sell buttons in the details panel: drag works well; idea parked, buttons still there for now.
