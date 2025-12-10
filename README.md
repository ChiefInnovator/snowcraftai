# Snowcraft Reforged

A modern, web-based recreation of the classic 1998 snowball fighting game.

## Project Overview

This version uses **Phaser 3** to replicate the original gameplay while introducing "2.5D" physics (snowballs have height and gravity) and a modern AI that scales in difficulty.

## How to Play

1. Open `index.html` in a web browser (use a local server for best results)
2. Players walk onto the field at the start of each level
3. Click and hold on a red team player to charge a throw
4. Release to throw a snowball at the green team
5. Defeat all green team players to advance to the next level
6. Watch out - the green team throws back!

## Controls

- **Click & Hold** on a player to charge throw power
- **Release** to throw a snowball
- Power meter shows throw strength (longer hold = further throw)

## Game Features

- 5 progressive levels with increasing difficulty
- Hit animations with stunned states
- Snowball arc trajectories with shadows
- Player selection highlighting
- Win/lose conditions with replay option

## Development Tools

- `index.html` - Main game
- `sprites.html` - Sprite viewer showing all animation frames

## Technical Details

- **Engine**: Phaser 3.60
- **Canvas**: 600x320 pixels
- **Assets**: Original sprite sheets from 1998 Snowcraft
