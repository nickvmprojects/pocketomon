# Pocketomon handoff — v0.5

Use this to pick the project up in a new chat. Rules: `docs/POCKETOMON_DESIGN_v0.5.md`. Older handoffs: v0.1–v0.4 (v0.3 has the full file map, v0.4 the trigger/trinket systems).

## Working agreement
Lots of back-and-forth design. **Never start a new build until the user explicitly says so.** The user's UX goal: avoid accidents and reduce player frustration.

## What changed in v0.5 (UI only, no balance changes)
- Shop and event screens fit one screen (`main.fit`, `.zone.team/.bench/.shop`, `.infobar`), no scrolling.
- Taps only select (`tapSlot`), background tap closes the sheet; moving is drag-only.
- Drag starts after 20px, no hold (`pointMove`); `touch-action: none` on `main.fit`.
- Details sheet `.top` for shop items; To bench/To team buttons removed; Buy/Sell buttons kept (user will decide after feedback).
- Merge-reward pick as `.popup`.
- Cache-bust tag `?v=0.5` (bump: `sed -i 's/?v=0.5/?v=0.6/g' index.html js/*.js tools/gen.mjs`).

## Open / waiting on feedback
- Whether to keep the Buy/Sell buttons alongside drag and drop.
