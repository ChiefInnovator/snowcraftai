# Original SnowCraft — observations from gameplay video

Source: https://www.youtube.com/watch?v=1ICjps2w7ZU (analysed 2026-11-08 via an automated video walkthrough).
**Unverified** — this is a machine summary of footage. Cross-check every number against the decompiled Lingo
and the Wine playthrough in [reference-app.md](reference-app.md) before acting on it.

## Flow & screens
- Title/end text "SnowCraft / Happy Holidays" over the field (00:26; again at game over 02:27–02:40, 03:28–03:53).
- Level banner: plain blue centred text "Level N" between rounds (00:27, 00:48, 01:46, 02:04, 02:52).
- No in-play HUD or score. **Game-over screen shows a final score** (e.g. `SCORE: 2730`) and a **PLAY AGAIN** button (02:30, 03:30).
- Video reaches Level 8 (01:57); afterwards it appears to **loop back to Level 2 with a huge enemy horde** (02:04) — possibly an overflow/wrap; verify.

## Teams
- Red: always 3 kids, loose triangle bottom-right. **Survivors do not carry over** — fresh 3 each level.
- Green, as observed: Level 2 = 3, Level 3 = 4, Level 5 = 6, top-left cluster. (Conflicts with the published "3, 5, 7…" description and our `LEVEL_CONFIG` — verify against Lingo.)
- Two crescent snow banks (upper-left, lower-right). No cover: balls fly over them, kids walk past.

## Controls & throwing
- Click a red kid → dashed blue ring under it + vertical multi-segment green power meter beside it.
- Hold and drag moves the kid; release throws.
- Power meter fills while held; distance ∝ hold time.
- **Throws always travel the fixed diagonal toward the upper-left** — no free aiming.

## Hits
- **Green: 1 hit knocks out.** (Ours: 1/3/4 by difficulty.)
- **Red: 3 hits knock out.** Hits 1–2 knock hood/gloves off (bare head).
- Knockout: kid flies backward, lands face-down, **stays on the field** for the rest of the level.

## Enemy AI
- Throws at regular intervals; danger comes from volume of fire.
- Walk slowly forward/down toward the red side or sidestep around the banks.
- **Dodge incoming snowballs** when not mid-throw (we have no dodging).

## Audio cues
- Quiet looping winter music throughout.
- "Smack" on any hit; groan/yelp plus thud on knockout.
