ARKANOID LEVEL FORMAT
=====================

Each level is a plain text file. The file name determines the level order
(they are loaded alphabetically: level1.txt, level2.txt, …).

GRID NOTATION
-------------
Each non-comment line is one row of tiles.
Each character is one column.  Up to 10 columns fit the playfield.

  Character → tile color
  ─────────────────────
  R  Red
  O  Orange
  Y  Yellow
  G  Green
  B  Blue
  P  Purple
  W  White
  C  Cyan

  Special tiles
  ─────────────
  S  Silver  → takes TWO hits to destroy (worth 20 points total)
  X  Rock     → indestructible; the ball only bounces off it

  .  (dot)  → empty cell (no tile)
  (space)   → empty cell (no tile)

Lines that begin with # are comments and are ignored.
Blank lines are also ignored.

EXAMPLE
-------
# My custom level
RRRRRRRRRR
OOOOOOOOOO
..YYYY....
..YYYY....
GGGGGGGGGG

TIPS
----
- The playfield is 360 px wide; each tile is 32 px + 3 px gap = 35 px per column.
- Rows can be different lengths; shorter rows are simply left-aligned.
- You can have up to ~25 rows before tiles overlap the paddle area.
- Add as many level files as you like; the game cycles through them in order.
- A level is cleared when every destructible tile is gone; rock (X) tiles are
  ignored by the clear check. Never box a destructible tile in completely with
  rock, and never lay a full-width rock row that has destructible tiles above
  it with no open column to reach them, or the level becomes unwinnable.
