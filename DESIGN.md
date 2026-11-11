---
name: SnowCraft Reforged
description: A studio holiday card opened on a green desk blotter, with the 1999 snowball fight tipped inside.
colors:
  blotter: "#1d4a3a"
  blotter-deep: "#143427"
  on-blotter: "#f1f6f2"
  on-blotter-soft: "#c3d6cb"
  cranberry: "#8c1c2b"
  cranberry-deep: "#6c1420"
  on-cranberry: "#fbfbf8"
  on-cranberry-soft: "#f1d6d9"
  foil: "#d5d9df"
  envelope: "#d5d9df"
  card: "#fbfbf8"
  picture-white: "#ffffff"
  ink: "#15171a"
  ink-soft: "#474c55"
  hairline: "rgba(21, 23, 26, 0.18)"
typography:
  greeting:
    fontFamily: "Yesteryear, Brush Script MT, cursive"
    fontSize: "clamp(3rem, 27cqi, 6rem)"
    fontWeight: 400
    lineHeight: 0.98
  signature:
    fontFamily: "Yesteryear, Brush Script MT, cursive"
    fontSize: "2.5rem"
    fontWeight: 400
    lineHeight: 1.1
  headline:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "clamp(1.9rem, 4vw, 2.9rem)"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.022em"
  hook:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "clamp(1.25rem, 8.4cqi, 1.9rem)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  numeral:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  letter:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.62
  control:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 700
  button:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 700
  row:
    fontFamily: "Besley, Clarendon, Rockwell, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  lede:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  none: "0px"
  full: "50%"
spacing:
  perforation: "8px"
  action-gap: "12px"
  strip: "92px"
  strip-narrow: "66px"
  desk-block: "clamp(24px, 3.6vw, 48px)"
  desk-inline: "clamp(14px, 4vw, 48px)"
  leaf-pad: "clamp(18px, 2.4vw, 36px)"
  sheet-pad: "clamp(26px, 5vw, 64px)"
components:
  leaf-cover:
    backgroundColor: "{colors.cranberry}"
    textColor: "{colors.on-cranberry}"
    rounded: "{rounded.none}"
    padding: "clamp(26px, 3vw, 44px) clamp(24px, 2.6vw, 40px)"
    width: "clamp(280px, 27%, 440px)"
  leaf-inside:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.leaf-pad}"
  envelope:
    backgroundColor: "{colors.envelope}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.sheet-pad}"
    width: "min(100%, 1080px)"
  sheet-slip:
    backgroundColor: "{colors.envelope}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "clamp(22px, 2.6vw, 34px)"
  maker-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.small}"
    rounded: "{rounded.none}"
    padding: "clamp(22px, 4vw, 36px)"
    width: "min(100%, 720px)"
  mount:
    backgroundColor: "{colors.cranberry}"
    size: "26px"
  stamp:
    backgroundColor: "{colors.card}"
    padding: "{spacing.perforation}"
    width: "64px"
    height: "80px"
  edition:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.none}"
    padding: "7px 14px 7px 8px"
  edition-on:
    backgroundColor: "{colors.cranberry}"
    textColor: "{colors.on-cranberry}"
  plate-wipe:
    backgroundColor: "{colors.cranberry}"
    textColor: "{colors.foil}"
  wipe-year:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    padding: "5px 13px 6px"
  wipe-year-new:
    backgroundColor: "{colors.cranberry}"
    textColor: "{colors.picture-white}"
  wipe-knob:
    backgroundColor: "{colors.cranberry}"
    textColor: "{colors.picture-white}"
    rounded: "{rounded.full}"
    size: "48px"
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "11px 24px"
    height: "48px"
  button-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  button-primary:
    backgroundColor: "{colors.cranberry}"
    textColor: "{colors.picture-white}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "11px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.cranberry-deep}"
    textColor: "{colors.picture-white}"
  button-quiet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "9px 18px"
  button-quiet-hover:
    backgroundColor: "{colors.foil}"
  select-ruled:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "4px 24px 4px 1px"
    height: "34px"
  checkbox:
    backgroundColor: "transparent"
    rounded: "{rounded.none}"
    size: "19px"
  checkbox-checked:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  faq-row:
    textColor: "{colors.ink}"
    typography: "{typography.row}"
    padding: "16px 40px 16px 0"
  faq-row-hover:
    textColor: "{colors.cranberry}"
  enclosure-link:
    textColor: "{colors.on-cranberry}"
    typography: "{typography.button}"
    padding: "9px 26px 9px 0"
  enclosure-link-hover:
    textColor: "{colors.foil}"
  skip-link:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    padding: "10px 16px"
---

# Design System: SnowCraft Reforged

## Overview

**Creative North Star: "The Studio Holiday Card"**

The page is a piece of December post lying open on a desk. A spruce-green blotter is the ground, a silver envelope is slipped under an open card, the card's cranberry cover leaf sits beside its white inside leaf, and the playable game is tipped into that inside leaf like a print held by corner mounts. Everything further down is another piece of paper from the same envelope: a rules slip, a comparison sheet, a letter with a list tucked half under it, the small print, the envelope turned over and addressed, and the maker's card.

Every surface is paper, so every surface carries the same fine grain, square corners and one soft cast shadow, and most pieces lie a fraction of a degree off square. Colour is used the way a two-colour print job uses it: cranberry and black ink on white stock, silver for the envelope and the foil greeting, green only for the desk. Density is that of a printed card, not an app: one large picture, short lines of slab type, and controls set as the blanks on a reply card.

Motion is nearly absent. The envelope settles once when the page arrives, a cranberry sheet with the year wipes across the game when the artwork changes, and a dated postmark is struck when the page is sent on. Nothing animates on scroll.

**Key Characteristics:**
- Green blotter ground; all content sits on separate pieces of paper with a shared grain and cast shadow.
- One accent, cranberry, used for the card cover, corner mounts, the chosen print, links and the primary action.
- Three type voices: a brush script used twice, a Clarendon slab for everything printed, a grotesque for reading text and labels.
- Square corners everywhere; the only circles are the postmark and the knob on the comparison line.
- Paper tilts by 2 degrees or less; the game itself is never tilted.
- The game is in the first viewport at every size, and a phone held sideways shows nothing else.

## Colors

A two-ink print job on white stock, laid on a green desk: cranberry and near-black on paper, silver for the envelope, spruce underneath.

### Primary
- **Cranberry Card** (`cranberry`, #8c1c2b): the card's cover leaf, the corner mounts, the chosen artwork print, the sheet that wipes across the game, the primary button, the comparison knob and 2026 tag, links on paper, step numerals, list markers, FAQ plus signs, the signature and the struck postmark. Also the browser accent and caret colour.
- **Cranberry Deep** (`cranberry-deep`, #6c1420): primary button hover, the turn-your-phone panel over the game, and the share status line.

### Secondary
- **Envelope Silver** (`envelope`, #d5d9df): the envelope behind the card, the addressed envelope at the end, and the slip of paper tucked under the letter.
- **Foil** (`foil`, same value as the envelope): silver as ink on cranberry. The script greeting, the year on the wipe sheet, enclosure-link hover, text selection on the cover, and quiet-button hover.

### Tertiary
- **Blotter Spruce** (`blotter`, #1d4a3a): the page ground, with grain, and the browser theme colour. On paper it appears once, as the green team's heading on the rules slip.
- **Blotter Deep** (`blotter-deep`, #143427): the scrollbar track.

### Neutral
- **Card White** (`card`, #fbfbf8): paper stock. The inside leaf, every sheet, the maker's card, edition prints at rest, year tags, the stamp's paper, the comparison line, and text on ink-filled buttons.
- **Picture White** (`picture-white`, #ffffff): the ground behind pictures only: the game canvas, the comparison frame, close-up pairs and edition thumbnails. Also the text on cranberry buttons and tags in the shipped build.
- **Ink** (`ink`, #15171a): all text on paper, the 1px picture outline, form rules, checkbox fill, the 1999 postmark at 80% opacity and the cancel lines at 55%.
- **Ink Soft** (`ink-soft`, #474c55): field labels, edition captions, FAQ answers, the return address second line, the maker's card text.
- **Hairline** (`hairline`, ink at 18%): row rules on paper, the divider between the two rule columns, close-up frames.
- **On Blotter** (`on-blotter`, #f1f6f2) and **On Blotter Soft** (`on-blotter-soft`, #c3d6cb): the only text set directly on the desk, which is the legal line and its links; On Blotter is also the default focus ring.
- **On Cranberry** (`on-cranberry`, #fbfbf8) and **On Cranberry Soft** (`on-cranberry-soft`, #f1d6d9): text on the cover leaf and the chosen print; the soft tone is for the pitch, the enclosures label and the print's caption.

### Named Rules
**The Two Inks Rule.** On white and silver paper there are two inks, cranberry and black: every action and link is one or the other. Green belongs to the desk, and silver is an ink only on cranberry.

**The Lit Ring Rule.** The focus ring is 2.5px solid with a 3px offset and takes its colour from the surface it sits on: On Blotter on the desk and the cranberry cover, Cranberry on white and silver paper, Card White on the deep-cranberry phone panel.

## Typography

**Display Font:** Yesteryear (with Brush Script MT, cursive)
**Body Font:** Hanken Grotesk (with the system sans stack)
**Label/Mono Font:** Besley, a Clarendon revival (with Clarendon, Rockwell, Georgia), used for headings, numerals and controls

**Character:** A sign-painter's brush script for the greeting, a heavy bracketed slab for anything that would have been printed or rubber-stamped, and a plain grotesque that stays out of the way for sentences and labels. All three load from Google Fonts in one request: Besley 400 to 900, Hanken Grotesk 400 to 700, Yesteryear 400.

### Hierarchy
- **Greeting** (Yesteryear 400, clamp(3rem, 27cqi, 6rem), 0.98): the cover greeting, in foil. Sized by container query against the cover leaf; clamp(2.3rem, 8.4vw, 3.3rem) once the card stacks.
- **Signature** (Yesteryear 400, 2.5rem, 1.1): the sign-off on the letter, in cranberry.
- **Headline** (Besley 900, clamp(1.9rem, 4vw, 2.9rem), 1.04, -0.022em): one per sheet. The addressed envelope raises it to clamp(2rem, 5.4vw, 3.5rem) at 1.02 and -0.025em.
- **Hook** (Besley 700, clamp(1.25rem, 8.4cqi, 1.9rem), 1.14, -0.012em): the plain-words line under the greeting; with the greeting it forms the page's single h1.
- **Title** (Besley 800, 1.3rem, 1.2, -0.01em): sub-headings on a sheet; the maker's name uses the same voice at 1.25rem.
- **Numeral** (Besley 900, 1.75rem, 1, -0.02em): the years on the two prints. The same voice sets the step numbers (1.5rem), the year tags on the comparison (clamp(1.05rem, 2.6vw, 1.9rem)), the close-up captions (1rem) and the year on the wipe sheet (clamp(3rem, 9vw, 8.5rem), -0.03em).
- **Letter** (Besley 400, 1.125rem, 1.62, max 60ch): the body of the letter only.
- **Row / Button / Control** (Besley 700; 1.125rem FAQ questions, 1.0625rem buttons and enclosure links, 1rem select values and the quiet button, clamp(1rem, 1.25vw, 1.125rem) for the one-line instruction): anything the reader acts on.
- **Body** (Hanken Grotesk 400, 1.0625rem, 1.6): running text; paragraphs cap at 46ch on the rules slip, 66ch in FAQ answers, 70ch for the phone note. The cover pitch is 1rem at 1.5 and 34ch.
- **Lede** (Hanken Grotesk 400, 1.125rem): the opening paragraph of the comparison sheet and the send pitch.
- **Small** (Hanken Grotesk 400 to 600, 0.9375rem, 1.55): maker's card, notes, checkbox labels (500), maker links (600); the legal line is 0.875rem.
- **Label** (Hanken Grotesk 600, 0.8125rem, sentence case): field labels, edition captions, the enclosures label, the return address second line (500).

### Named Rules
**The Brush Twice Rule.** The script appears in two places: the greeting on the cover and the signature on the letter. It never sets a heading, a button or a caption.

**The Printed Year Rule.** 1999 and 2026 are always Besley 900 with tight negative tracking, wherever they appear.

**The Slab Acts Rule.** If the reader can press it, open it or choose it, its text is Besley 700. Hanken Grotesk is for sentences and for the small label above a field.

## Layout

The page is a desk with pieces of paper laid on it, top to bottom. Each section is a band of blotter with padding of clamp(24px, 3.6vw, 48px) block and clamp(14px, 4vw, 48px) inline holding one piece of paper (the letter and its slip share a band). Bands clip horizontally so tilted paper never widens the page.

- **The mailing.** Up to 1680px wide. A 92px strip at the top shows the envelope: return address at the left, franking (cancel lines, postmark, stamp, and the send control) at the right. The envelope extends 26px past the card on three sides and is tilted. The card is a two-column grid: cover leaf clamp(280px, 27%, 440px), inside leaf the remainder. The card itself is square to the page.
- **Inside leaf.** The game plate, centred and shrink-wrapped to the game; beneath it a row exactly as wide as the game, with the two edition prints at the left and the one-line instruction over the settings at the right.
- **Sheets.** Centred, width-capped pieces of paper: 1080px by default, 1180px for the comparison sheet and for the letter-plus-slip pair, 820px for the small print, 940px for the addressed envelope, 720px for the maker's card. Padding clamp(26px, 5vw, 64px).
- **Letter and slip.** A 1.55fr / 1fr grid; the slip overlaps the letter by 30px and drops clamp(40px, 8vw, 120px) below its top.
- **Rules slip.** Two equal columns divided by a hairline; steps are a three-column row of numeral, 92px figure and text.

Tilts in the build: envelope -1.4deg, rules slip -0.5deg, comparison sheet 0.3deg, letter 0.35deg, slip 1.5deg, small print -0.25deg, addressed envelope -0.9deg, maker's card 0.6deg, the chosen print -1.6deg, year tags -2deg and 2deg.

Responsive behaviour:
- **1200px and wider:** sheets drift off the centre line (rules slip -3vw, small print 5vw, addressed envelope -2vw, maker's card 4vw).
- **961px and wider with a viewport 820px tall or less:** the cover drops its pitch paragraph so the whole card still fits.
- **960px and narrower:** the card stacks, cover leaf above inside leaf. The cover keeps only the greeting and hook; the enclosure links move to a centred row under the settings. The envelope strip shrinks to 66px, its tilt to -0.7deg, the cancel lines are hidden, corner mounts go from 26px to 20px, the under-plate row stacks and centres, the rule columns and the letter-plus-slip stack.
- **560px and narrower:** smaller stamp gap and prints, 76px figures, the return address second line is dropped, the maker's card becomes one column, and the dated postmark is struck across the stamp because there is no room beside it.
- **Phone held sideways** (landscape, 520px tall or less, coarse pointer): the envelope, cover leaf, under-plate row, enclosure row, wipe sheet and mounts are all removed and the game is centred alone in the viewport.

**The Where It Fell Rule.** Paper tilts by 2 degrees or less and only whole pieces tilt. The card, the game, the comparison frame and all running text stay square.

**The Game First Rule.** At every breakpoint the game is in the first viewport; the cover gives up content before the game gives up space.

## Elevation & Depth

Depth is physical: paper lying on a desk. There is one cast shadow for paper on the blotter, a tighter ink-tinted shadow for pictures and tags lying on paper, and inset shadows for the fold of the card. Surfaces also carry a fine noise grain (fractal noise at 9% alpha, 180px tile) over their flat colour, which is what makes them read as stock. Pictures are flat white with no grain.

### Shadow Vocabulary
- **Paper on the desk** (`box-shadow: 0 1px 1px rgba(5, 22, 16, 0.28), 0 10px 18px -8px rgba(5, 22, 16, 0.5), 0 36px 54px -26px rgba(5, 22, 16, 0.62)`): the envelope, the card, every sheet, the addressed envelope, the maker's card. Green-black, so it belongs to the blotter.
- **Picture on paper** (`box-shadow: 0 2px 3px rgba(21, 23, 26, 0.18), 0 14px 22px -14px rgba(21, 23, 26, 0.45)`): the game and the comparison frame, always with a 1px ink outline.
- **Picked-up print** (`box-shadow: 0 2px 2px rgba(21, 23, 26, 0.25), 0 14px 18px -9px rgba(21, 23, 26, 0.6)`): the chosen edition print, with its lift and tilt.
- **Tag** (`box-shadow: 0 2px 3px rgba(21, 23, 26, 0.22), 0 8px 12px -6px rgba(21, 23, 26, 0.4)`): the year tags on the comparison.
- **Knob** (`box-shadow: 0 0 0 3px #fbfbf8, 0 3px 4px rgba(21, 23, 26, 0.3), 0 10px 14px -6px rgba(21, 23, 26, 0.55)`): the comparison knob, ringed in card white.
- **Fold** (`box-shadow: inset -20px 0 24px -20px rgba(0, 0, 0, 0.42)` on the cover, `inset 20px 0 24px -20px rgba(0, 0, 0, 0.16)` on the inside leaf): the crease between the leaves. When the card stacks the fold turns horizontal (16px/20px offsets, same alphas).

### Named Rules
**The One Light Rule.** Every piece of paper on the blotter takes the same cast shadow. Height is shown by tilt and overlap, never by a bigger or differently coloured shadow.

**The Settle Once Rule.** The only arrival animation is the envelope settling (0.7s, cubic-bezier(0.16, 1, 0.3, 1)). Nothing animates on scroll, and reduced-motion removes every transition and animation while leaving a struck postmark visible.

## Shapes

Everything is cut paper, so corners are square (0 radius) on leaves, sheets, buttons, prints, tags, fields and checkboxes. The exceptions are things that are round in the world: the postmark (two concentric stroked circles with text on arcs) and the 48px knob on the comparison line.

- **Corner mounts.** Right-angle triangles in cranberry, clipped from a square and set 7px outside each corner of a picture: 26px on the game and the comparison frame (20px, 5px outside, once the card stacks), 18px on the close-up pairs.
- **Stamp.** A perforated edge cut by a mask on an 8px pitch, so stamp sizes are multiples of 8 (64 by 80, 104 by 128 on the addressed envelope, 72 by 88 and 40 by 56 on narrow screens).
- **The leaning line.** The comparison's dividing line leans 12.53 degrees, the same way as the game's centre line; the clipped picture edge follows it.
- **Outlines.** Pictures take a 1px ink outline; prints and buttons 1.5px ink; fields a 1.5px ink rule on the bottom edge only; rows a 1px hairline.

**The Square Corner Rule.** Paper has no radius. A circle is allowed only where the object is round in the post: a postmark, or a knob.

## Components

### Card leaves
The opened card. The **cover leaf** is cranberry with grain and On Cranberry text, holding the greeting, the hook, a pitch paragraph and the enclosure list pinned to its foot. The **inside leaf** is card white with grain and ink text, and holds the game plate and its controls. A fold shadow on each meets at the crease. The inside leaf sets the focus ring to cranberry.

### Plate with corner mounts
The game container: 592:320, picture white, 1px ink outline, picture shadow, with four cranberry mounts over its corners. The same mounts go on the comparison frame and on each close-up pair; they do not go on stamps, rule figures, print thumbnails or the maker's mark. The 1999 artwork renders pixelated and the 2026 artwork smooth, keyed off the container's artwork attribute. A 40px full-screen button sits 16px inside the top-right corner, ink at 80% with a white icon; with a hover-capable pointer it rests at 30% opacity until the pointer is over the game.

### Edition prints (artwork switch)
Two small prints side by side, each a radio input covering a label: a 42 by 54 thumbnail of the red kid in that artwork, the year as a numeral, and a caption. At rest: card white, 1.5px ink outline. Hover lifts 2px. The chosen one turns cranberry with grain and On Cranberry text, lifts 3px, tilts -1.6deg and takes the picked-up shadow. Keyboard focus draws the ring around the whole print.

### Plate wipe
Choosing a print covers the game with a cranberry sheet carrying the year in foil numerals. It wipes in from the left (0.26s, cubic-bezier(0.3, 0, 0.2, 1)), holds for at least 460ms and until the game is drawing the new artwork, then wipes off to the right (0.36s). With reduced motion, or when the sheet is not rendered, the artwork changes with no wipe.

### Wipe comparison
One frame of the game in both artworks at 1778:960. The 1999 picture is clipped over the 2026 one along a leaning line whose position is a percentage set by an invisible full-size range input (keyboard-operable, 0.5 steps). The line is 4px of card white; its knob is a 48px cranberry circle with a two-way chevron that grows to 1.08 on hover. Year tags sit in the top corners: 1999 on card white tilted -2deg, 2026 on cranberry tilted 2deg. Two buttons underneath play either printing. Close-up pairs follow below a hairline: the 1999 sprite beside the 2026 redraw on picture white with a hairline outline, small mounts and year captions (2026 in cranberry).

### Sheets
A piece of paper: card white with grain, ink text, the paper shadow, a width cap and a small tilt, with one headline. Links are cranberry and turn ink on hover. Variants: the rules slip (two columns, numbered steps with cranberry numerals and cropped figures, cranberry heading for the red team and blotter-green heading for the green team), the comparison sheet, the letter (slab body text and a script signature), the slip (envelope silver, tucked half under the letter, cranberry list markers) and the small print.

### Stamp and postmark
A perforated card-white stamp holding a real character sprite on a pale sky pane; no drawn or invented artwork. Beside it a 1999 postmark in ink at 80%, rotated -11deg, and wavy cancel lines. The stamp in the envelope strip is the send control: a button whose label is underlined slab text and whose stamp lifts 3px and turns 2deg on hover. Sending or copying strikes a second, cranberry postmark with today's day, month and year: it scales from 1.9 with a 3px blur to rest at 92% opacity over 0.5s, and the cancel lines fade out where it lands.

### Ruled form controls
Settings set like the blanks on a reply card. A **select** has no box: transparent, a 1.5px ink rule beneath, slab 700 value, a small chevron at the right, a grotesque label above; the rule turns cranberry on hover. A **checkbox** is a 19px square with a 1.5px ink border that fills ink with a card-white tick when checked; hover turns the border, and a checked fill, cranberry.

### Buttons
- **Shape:** square corners, 1.5px ink border, 48px minimum height, 11px 24px padding, Besley 700 at 1.0625rem.
- **Default:** transparent with ink text; hover fills ink with card-white text; pressed drops 1px.
- **Primary:** cranberry fill and border with white text; hover goes to cranberry deep. One primary per group.
- **Quiet:** a borderless card-white button (9px 18px) used on the deep-cranberry phone panel; hover goes to foil.

### FAQ rows
Native disclosure rows separated by hairlines. The question is Besley 700 at 1.125rem with a cranberry plus sign at the right made of two 14px by 2px bars; opening rotates one bar to make a minus. Hover turns the question cranberry. Answers are ink soft, capped at 66ch.

### Enclosure links
On the cover: a ruled list of slab links, each with a small down arrow that drops 3px on hover as the text turns foil. Once the card stacks, the same links appear as a centred cranberry row under the settings.

### Envelope front
The envelope turned over: envelope silver with grain, tilted -0.9deg, a large stamp and postmark in the top-right corner, a headline, a pitch, the page address underlined like a written address, and the primary and default buttons. A screen-reader status line reports the result of sending.

### Maker card
A small card-white card, tilted 0.6deg: the real Inventing Fire mark at 60px, the maker line in the title voice, a sentence, and a row of cranberry links. The legal line follows directly on the blotter, centred, in On Blotter Soft.

### The page-to-game contract
The page styles around the game but does not own it. These hooks are read or written by the game script and must survive any restyle:
- The inside leaf carries `.game-slot` and declares `--fit-reserve-h`, the unitless pixel height the page keeps for itself around a fit-to-window game: 352 on the side-by-side card, 262 once the card stacks.
- The game writes `--stage-w` on the root; the row under the plate uses it so the controls are exactly as wide as the game.
- `#artwork-select` is the game's artwork setting. It stays in the document, visually hidden; the two edition prints and the two "play this printing" buttons set its value and dispatch a change event, and the page reflects back whatever the game reports on `#game-container[data-artwork]`.
- Also required: `#game-container`, `.game-wrap`, `#difficulty-select`, `#scale-select`, `#music-checkbox`, `#mute-checkbox`, `#fullscreen-btn`, `#rotate-hint`, and the `pseudo-fs` class on the root for full screen.

## Do's and Don'ts

### Do:
- **Do** put every new block of content on its own piece of paper: card white or envelope silver with grain, the paper shadow, square corners, and a tilt of 2 degrees or less.
- **Do** keep cranberry as the single accent on paper, for the primary action, links, numerals and marks, and keep green for the desk.
- **Do** set anything pressable in Besley 700 and anything read in Hanken Grotesk; keep the script for the greeting and the signature.
- **Do** set 1999 and 2026 in Besley 900 with negative tracking wherever the years appear.
- **Do** mount pictures of the game with cranberry corner triangles and a 1px ink outline on picture white.
- **Do** point the focus ring at a colour that reads on the surface: On Blotter on green and cranberry, Cranberry on white and silver.
- **Do** keep the game in the first viewport at every size and keep the game hooks listed in the page-to-game contract intact.
- **Do** put all page behaviour in external script files; the Content-Security-Policy forbids inline script.
- **Do** use real project assets for every picture and mark: recovered 1999 sprites, the redrawn characters, the Inventing Fire mark.

### Don't:
- **Don't** round the corners of paper, buttons, fields or prints; circles are for the postmark and the comparison knob.
- **Don't** tilt the card, the game, the comparison frame or running text.
- **Don't** add scroll-triggered animation; the envelope settles once and the rest is still.
- **Don't** give paper a second shadow style to suggest importance; use overlap and tilt.
- **Don't** use green as a button or link colour, or silver as ink anywhere but on cranberry.
- **Don't** let tilted paper widen the page; bands clip horizontally.
- **Don't** draw, generate or approximate a logo or brand mark; use the real asset file or leave it out.
- **Don't** add testimonials, press quotes, play counts or any number that is not in the project's evidence.
- **Don't** rename, remove or restyle away the controls the game script reads.
