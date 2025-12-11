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

## Snowball Speed Analysis

The speed of a snowball is calculated per frame using this formula:
`Speed = 0.012 + (Strength / 100) * 0.006`

### **Player Stats**
*   **Strength Range:** 1 to 100 (controlled by how long you hold the mouse).
*   **Minimum Speed:** **0.0121** (Strength 1)
*   **Maximum Speed:** **0.0180** (Strength 100)

### **Enemy Stats**
*   **Strength Range:** 50 to 90 (randomly chosen for each throw).
*   **Minimum Speed:** **0.0150** (Strength 50)
*   **Maximum Speed:** **0.0174** (Strength 90)

### **Comparison**
1.  **Consistency:** Enemies are much more consistent. They never throw a "weak" snowball. Their slowest throw (0.015) is already at **50% of the max possible speed**.
2.  **Top Speed:** The Player has a slight advantage at maximum power. A fully charged player shot (0.018) travels slightly faster than the fastest enemy shot (0.0174).
3.  **Range:** The player has a much wider range of speeds available, allowing for short-range lobs (slow) or long-range snipes (fast). The enemies are locked into a "medium-fast" bracket.
