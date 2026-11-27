# Pocketomon handoff — v0.7.5 "Rift" (presentation overhaul)

Live: https://nickvmbox.duckdns.org/pocketomon/ · classic v0.7: https://nickvmbox.duckdns.org/pocketomon/classic/

## Working agreement (unchanged)
- Lots of back-and-forth design. **Never start a build until the user says "build vX".** (v0.7.5 was an explicit "build and push".)
- UX goal: avoid accidents, reduce frustration. Taps only select; moving/buying/selling is drag (plus Buy/Sell buttons).
- Handoff files carry the version in the file name. v0.8 "Workshop" plan from HANDOFF_v0.7.md still stands.

## Thesis
The engine and loop are sound; the presentation hid the payoff. In an auto battler the hook is *watching your build work*,
and v0.7 showed an emoji flying to an HP bar. v0.7.5 makes causality visible, turns the designer's pacing goal (great
builds win in 3-6s) into the player's score, and gives the multiverse one strong neutral frame so 10 art styles read as one game.

## What changed (rules, balance, beings: unchanged)
- **Look**: black void + bone type + one accent per side (you mint `#3cf2c0`, foe red `#ff4a5c`, gold `#ffcc3d`).
  Anton (display/big numbers) + DM Sans (body/small numbers), bundled in `/fonts` (OFL, subset .woff). No Google Fonts.
  Static film grain + vignette. Cards are full-bleed "windows" (art cropped with `object-fit: cover`, scale 1.14).
- `js/icons.js`: line icons (`IC`) + one sigil per dimension (`SIGIL`) + flavour coordinates (`COORD`, D-01..D-10).
- `js/sfx.js`: Web Audio synth, no files. Per-dimension cast voices, pitch rises with chain length. `prof.mute`.
- `js/fx.js`: battle canvas (additive): beams, sparks, rings, curved trigger links, flashes.
- **Battle**: VS countdown screen; front rows face each other across the rift (opponent grid drawn back row on top);
  hits beam from the caster to the current edge of the enemy HP fill with the number where it lands (size scales with
  damage); support casts ring the caster; trigger links in gold; CHAIN ×N per side (casts+triggers within 0.9s battle time);
  hit-stop + screen shake on big hits; HP bar with delayed bone "ghost" trail; live damage counter per being (`frame.dm`);
  K.O./TIME slam + loser bar shatter.
- **Engine touch (display only)**: `trig` events now carry `from` (ally that set it off). Results identical.
- **KO time grade** on wins: S <6s, A <10s, B <15s, C <30s, D sudden death. `prof.bestKO`; `run.history[i].t`.
- **Multidex**: `prof.caught` (ever owned), `prof.spotted` (seen in shop/battle). Uncaught = darkened + "?".
  NEW DISCOVERY stamp (batched, shop/event only). `run.disc` counts catches per run.
- DAY N card between days (wins diamonds + lives hearts), tarot-style event cards, "so close" note on losses <15% foe HP,
  run summary with per-battle W/L + KO times, dimension tally next to "Team" (counts only, synergies stay hidden).
- Title: rift portal cycling all 100 beings with a glitch cut, orbiting sigils, rank/caught/best KO/titles strip,
  sound toggle, "Play classic v0.7" link.

## Classic
`/classic/` is a frozen copy of v0.7 (its own css/js). Same localStorage keys, same run format → both share the saved run.
Only change: a "back to the new Pocketomon" link in its footer. Don't edit classic going forward.

## Ideas parked (not built)
- Per-dimension battle backdrops behind each team (abstract, based on the dominant dimension).
- Daily seed / shared "beat my KO" link for WhatsApp (fits v0.8 Workshop share buttons).
- Replay of a fight's best chain as a shareable GIF/video.
