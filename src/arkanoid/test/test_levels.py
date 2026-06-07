"""Tests that every level file in levels/ loads correctly in the Arkanoid game.

Phase 1 – format validation (pure Python, no browser required)
  · Each .txt file in levels/ has valid tile characters.
  · Each level produces at least one tile.
  · No tile column exceeds the 10-column playfield.
  · Every destructible tile is reachable (rock tiles never make a level
    unwinnable by boxing in or walling off a destructible tile).

Phase 2 – browser loading (Playwright, requires a running server)
  · LEVEL_FILES in game.js matches the files present on disk.
  · Calling init(idx) in the live game produces the exact tile count that
    the Python parser derives from the same file (proves the file was fetched
    and not replaced by the hard-coded fallback layout).
  · Every tile has a recognised color key.
  · The HUD level indicator shows the correct level number.

Run (from the repo root):
    # start the app on port 5099 first, e.g.
    uv run --with flask==2.3.3 --with Werkzeug==2.3.7 flask --app app run --port 5099 &
    # then run the tests (override the server URL with BASE_URL if needed)
    uv run --with playwright python src/arkanoid/test/test_levels.py
"""
import glob
import os
import re
from collections import deque

from playwright.sync_api import sync_playwright

# ── paths ──────────────────────────────────────────────────────────────────────

_HERE      = os.path.dirname(__file__)
LEVELS_DIR = os.path.normpath(os.path.join(_HERE, '..', 'levels'))
GAME_JS    = os.path.normpath(os.path.join(_HERE, '..', 'game.js'))
BASE       = os.environ.get('BASE_URL', 'http://127.0.0.1:5099')

# Characters that produce tiles (mirrors TILE_COLORS keys + special tiles in game.js)
COLOR_CHARS  = set('ROYGBPWC')   # plain colored tiles (one hit)
SILVER_CHAR  = 'S'               # two hits
ROCK_CHAR    = 'X'               # indestructible
VALID_CHARS  = COLOR_CHARS | {SILVER_CHAR, ROCK_CHAR}
DESTRUCTIBLE = COLOR_CHARS | {SILVER_CHAR}   # everything the ball can clear
MAX_COLS     = 10          # playfield width in columns

# ── helpers ────────────────────────────────────────────────────────────────────

def get_level_files():
    """Return sorted list of (abs_path, basename) for each non-README .txt."""
    paths = sorted(glob.glob(os.path.join(LEVELS_DIR, '*.txt')))
    return [(p, os.path.basename(p)) for p in paths
            if os.path.basename(p).lower() != 'readme.txt']


def parse_level_text(text):
    """Parse raw level text; return (tiles, data_rows).

    Mirrors the JavaScript _parseLevelText() logic in game.js so that the
    Python result can be compared directly against the browser result.
    """
    tiles = []
    lines = [l.rstrip('\r') for l in text.split('\n')]
    rows  = [l for l in lines if not l.startswith('#') and l.strip()]
    for r, line in enumerate(rows):
        for c, ch in enumerate(line):
            ch_up = ch.upper()
            if ch_up in VALID_CHARS:
                tiles.append((r, c, ch_up))
    return tiles, rows


def unreachable_destructibles(rows):
    """Return a list of (row, col, char) destructible tiles that no ball could
    ever reach.

    Model: the ball enters from the open bottom and travels through any cell
    that is not rock (it can also chew through destructible tiles to open new
    paths). So the only hard blockers are rock (X) cells. A destructible tile
    is winnable iff it is connected — through a 4-directional path of non-rock
    cells — to the open space below the grid. Walls bound the left/right edges.
    """
    height = len(rows)
    width  = MAX_COLS

    def char_at(r, c):
        if c >= len(rows[r]):
            return '.'                      # short rows are open on the right
        return rows[r][c].upper()

    # Flood non-rock cells, seeded from a virtual open row just below the grid.
    visited = set()
    queue   = deque()
    for c in range(width):
        queue.append((height, c))           # virtual row `height` = open bottom
        visited.add((height, c))

    while queue:
        r, c = queue.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if nc < 0 or nc >= width:        # left/right walls
                continue
            if nr < 0 or nr > height:
                continue
            if (nr, nc) in visited:
                continue
            if nr < height and char_at(nr, nc) == ROCK_CHAR:
                continue                     # rock blocks the path
            visited.add((nr, nc))
            queue.append((nr, nc))

    unreachable = []
    for r in range(height):
        for c in range(len(rows[r])):
            ch = rows[r][c].upper()
            if ch in DESTRUCTIBLE and (r, c) not in visited:
                unreachable.append((r, c, ch))
    return unreachable


def level_names_from_game_js():
    """Extract the LEVEL_FILES list from game.js and return bare filenames."""
    with open(GAME_JS) as f:
        src = f.read()
    m = re.search(r'const LEVEL_FILES\s*=\s*\[(.*?)\]', src, re.DOTALL)
    assert m, 'LEVEL_FILES array not found in game.js'
    return re.findall(r"'levels/([^']+)'", m.group(1))


# ── Phase 1: format validation ─────────────────────────────────────────────────

print('=== Phase 1: Level file format validation ===\n')

level_files = get_level_files()
assert level_files, f'No level .txt files found in {LEVELS_DIR}'
print(f'Found {len(level_files)} level file(s): {[n for _, n in level_files]}\n')

for path, name in level_files:
    with open(path) as f:
        raw = f.read()

    tiles, rows = parse_level_text(raw)

    # Must produce at least one tile
    assert tiles, f'{name}: no tiles found (file is empty or all-comment)'

    # No tile should exceed the playfield width
    over_width = [(r, c, ch) for r, c, ch in tiles if c >= MAX_COLS]
    assert not over_width, \
        f'{name}: tiles beyond column {MAX_COLS - 1}: {over_width}'

    # Every non-empty, non-comment character must be recognised
    for r_idx, line in enumerate(rows):
        for c_idx, ch in enumerate(line):
            ch_up = ch.upper()
            assert ch_up in VALID_CHARS | {'.', ' '}, (
                f'{name} line {r_idx + 1} col {c_idx + 1}: '
                f'unknown character {ch!r} (valid tile chars: {sorted(VALID_CHARS)})'
            )

    # At least one destructible tile, else the level can never be cleared
    destructible = [t for t in tiles if t[2] in DESTRUCTIBLE]
    assert destructible, f'{name}: no destructible tiles (only rock?) — unwinnable'

    # Rock tiles must never wall off a destructible tile from the ball
    blocked = unreachable_destructibles(rows)
    assert not blocked, (
        f'{name}: {len(blocked)} destructible tile(s) are unreachable behind '
        f'rock and can never be cleared: {blocked}'
    )

    print(f'OK  {name:<22} {len(tiles):>3} tiles ({len(destructible)} destructible), '
          f'{len(rows)} data rows')

print('\nAll level files pass format validation.\n')

# ── Phase 2: browser level loading ─────────────────────────────────────────────

print('=== Phase 2: Browser level loading (Playwright) ===\n')

game_level_names = level_names_from_game_js()
print(f'LEVEL_FILES in game.js ({len(game_level_names)}): {game_level_names}\n')

# Cross-check: every file on disk must appear in game.js and vice-versa
disk_names = {n for _, n in level_files}
js_names   = set(game_level_names)

missing_from_js   = disk_names - js_names
missing_from_disk = js_names   - disk_names

assert not missing_from_js, (
    f'Level files on disk not listed in LEVEL_FILES in game.js: {missing_from_js}'
)
assert not missing_from_disk, (
    f'LEVEL_FILES in game.js references missing files: {missing_from_disk}'
)
print('OK  LEVEL_FILES in game.js matches files on disk\n')

# JS array literal for valid chars (single-quoted Python list repr is valid JS)
VALID_CHARS_JS = repr(sorted(VALID_CHARS))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page    = browser.new_page(viewport={'width': 600, 'height': 900})

    page.goto(BASE + '/src/arkanoid/index.html')
    page.wait_for_load_state('networkidle')

    # Wait until the async init() has finished populating tiles
    page.wait_for_function(
        'window._arkanoid && Array.isArray(window._arkanoid.tiles) && window._arkanoid.tiles.length > 0',
        timeout=5000,
    )

    canvas_ok = page.evaluate(
        '() => { const c = document.querySelector("canvas"); return c.width > 0 && c.height > 0; }'
    )
    assert canvas_ok, 'Canvas has no drawable dimensions'
    print('OK  game page loads, canvas is ready\n')

    for idx, level_name in enumerate(game_level_names):
        level_path = os.path.join(LEVELS_DIR, level_name)

        # Ground-truth tile count from the Python parser
        with open(level_path) as f:
            raw = f.read()
        expected_tiles, _ = parse_level_text(raw)
        expected_count = len(expected_tiles)

        # Load the level inside the running game and capture state
        result = page.evaluate(f"""
            async () => {{
                await window._arkanoid.init({idx});
                const valid = new Set({VALID_CHARS_JS});
                return {{
                    tileCount:  window._arkanoid.tiles.length,
                    allValid:   window._arkanoid.tiles.every(t => valid.has(t.color)),
                    levelInHUD: document.getElementById('level-display').textContent.trim(),
                }};
            }}
        """)

        tc  = result['tileCount']
        av  = result['allValid']
        hud = result['levelInHUD']

        # Tile count must match the file exactly (mismatch → fallback was used)
        assert tc == expected_count, (
            f'Level {idx + 1} ({level_name}): '
            f'expected {expected_count} tiles from file, game produced {tc} '
            f'(likely fetched the fallback layout instead of the file)'
        )
        assert av, (
            f'Level {idx + 1} ({level_name}): '
            f'some tiles have unrecognised color keys'
        )
        assert hud == str(idx + 1), (
            f'Level {idx + 1} ({level_name}): '
            f"HUD shows '{hud}' instead of '{idx + 1}'"
        )

        print(f'OK  level{idx + 1} ({level_name:<20}) {tc:>3} tiles  HUD={hud}')

    browser.close()

print('\nAll browser level-loading tests passed.')
print('\nALL TESTS PASSED')
