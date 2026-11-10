# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally (confirmed 2026-11-10):

- **Players.** People who remember SnowCraft from 1999 office inboxes and holiday e-cards, and people who just want a quick snowball fight. They arrive from a shared link, usually in December, on a work laptop or a phone. Their job: be playing within seconds, then send it to someone.
- **Rich Crane's audience.** People arriving from Inventing Fire with AI and MILL5 channels who want to see how the original was recovered and rebuilt. They play too, then look for the story and the repo.

## Product Purpose

Snowcraft Reforged is a free browser remake of SnowCraft, the 1999 holiday snowball-fight game by Nicholson NY. Three red kids against a growing green team across ten levels. It exists so the game can be played again without the dead Director plug-in, and so the recovery work has a public home.

Success: a visitor plays within seconds of arriving and shares the link. The owner's stated goal for the page is "viral and compelling".

## Positioning

A holiday tradition is back (owner's chosen claim). The proof behind the claim: rules, timing, level layouts and sounds were recovered from the original 1999 Director game, so it plays the way people remember, now on any browser or phone with optional redrawn high-resolution artwork.

## Operating Context

- Static site on GitHub Pages at https://chiefinnovator.github.io/snowcraftai/. No build step; Phaser 4.2 from a CDN.
- The game is the page. It must be playable in the first viewport with no install, account or ads.
- Phones play in landscape and full screen; portrait shows a turn-your-phone hint.
- A native Flutter edition (Android/iOS) exists in the repo; it is not published to stores.

## Capabilities and Constraints

- Controls on the page: Difficulty (Easy/Normal/Hard), Display size, Artwork (High resolution default, Original), Background music, Mute all, Full screen.
- Mouse: point at a kid, hold to charge, drag to move, release to throw. Touch: same with a finger.
- Ten levels (3, 5, 7, 9, then twelve green kids). Red kids take two hits; green take three on Normal. Score tops out at 1000.
- Santa visits the grove from time to time (decorative).
- The game script depends on these DOM hooks: `#game-container`, `.game-wrap`, `#difficulty-select`, `#scale-select`, `#artwork-select`, `#music-checkbox`, `#mute-checkbox`, `#fullscreen-btn`, `#rotate-hint`, the `--stage-w` custom property, the `pseudo-fs` class on `<html>`, and `data-artwork` on the container.
- A Content-Security-Policy meta tag forbids inline script; fonts come from Google Fonts.
- The browser test suite (`web/tests/browser-ui.mjs`) checks text anchoring, phone rotation, full screen and page width against the live page.

## Brand Commitments

- Name: Snowcraft Reforged. The original is "SnowCraft" (1999, Nicholson NY).
- Credit: built by Rich Crane (Microsoft MVP, MILL5), part of Inventing Fire with AI. Real mark: `web/assets/images/inventing-fire-mark.png`. Never invent logos or brand marks.
- Legal line stays: not affiliated with Nicholson NY, IconMedialab, Macromedia or Adobe; SnowCraft (1999) remains with its original rights holders; link to `NOTICE.md`.
- Owner direction for the page: must not copy the previous page, must not fall back on generic minimal styling, and must not read as AI-made.

## Evidence on Hand

- The playable game itself, in two artwork modes.
- Original sprites recovered from the 1999 game: `web/assets/cast/` (36 kid frames, snowball, splat, power meter).
- Redrawn high-resolution art: `web/assets/hd/characters/`, `web/assets/hd/motion/`, `web/assets/hd/scenery/ground.png`, `web/assets/santa/hd/` (Santa frames and the decorated grove).
- Original sounds: `web/assets/sounds/` (15 WAVs).
- Recovery documentation: `docs/PARITY.md`, `docs/reference-app.md`, `docs/GRAPHICS.md`.
- No testimonials, press, play counts or download numbers exist. Do not fabricate any.

## Product Principles

1. The game comes first. Nothing sits between arriving and throwing a snowball.
2. It plays the way people remember. Faithfulness to 1999 is the reason to trust the remake.
3. Say only what is true. No invented numbers, quotes or claims.
4. Built to be passed along. One link, works everywhere, nothing to install.
5. Credit the original and its makers plainly.
