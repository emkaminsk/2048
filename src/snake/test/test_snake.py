"""End-to-end UI test for the Snake game.

Covers: idle start screen, starting via keyboard, the reversal guard (a 180°
turn must not kill the snake), space-bar pause/resume, wall-collision game over,
and the Play Again restart.

Run (from the repo root):
    # start the app on port 5099 first, e.g.
    uv run --with flask==2.3.3 --with Werkzeug==2.3.7 flask --app app run --port 5099 &
    # then run the test (override the URL with BASE_URL if needed)
    uv run --with playwright python src/snake/test/test_snake.py
"""
import os

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5099")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 600, "height": 800})
    page.goto(BASE + "/src/snake/index.html")
    page.wait_for_load_state("networkidle")

    # Idle: start message visible, pause disabled.
    assert page.locator("#message").is_visible(), "start message should show on idle"
    assert page.locator("#pause").is_disabled(), "pause disabled before start"

    canvas_ready = page.evaluate(
        "() => { const c = document.querySelector('canvas'); return c.width > 0 && c.height > 0; }"
    )
    assert canvas_ready, "canvas should have a drawable size"
    print("OK: idle start screen rendered")

    # Start by pressing ArrowRight -> running, message hidden, pause enabled.
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(300)
    assert not page.locator("#message").is_visible(), "message should hide once running"
    assert not page.locator("#pause").is_disabled(), "pause enabled while running"
    print("OK: arrow key starts the game")

    # Reversal guard: heading right, pressing Left must be ignored (no instant death).
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(300)
    assert page.locator("#game-over-overlay").evaluate(
        "el => el.classList.contains('hidden')"
    ), "reversal onto the neck should not end the game"
    print("OK: reversal guard prevents self-collision")

    # Space toggles pause / resume.
    page.keyboard.press(" ")
    page.wait_for_timeout(200)
    assert page.locator("#pause").inner_text() == "Resume", "space should pause"
    page.keyboard.press(" ")
    page.wait_for_timeout(200)
    assert page.locator("#pause").inner_text() == "Pause", "space should resume"
    print("OK: space-bar pause/resume")

    # Running right into the wall ends the game within a few seconds.
    page.wait_for_function(
        "() => !document.getElementById('game-over-overlay').classList.contains('hidden')",
        timeout=5000,
    )
    print("OK: game over on wall collision, final score =", page.locator("#final-score").inner_text())

    # Play Again resets and hides the overlay.
    page.locator("#play-again").click()
    page.wait_for_timeout(300)
    assert page.locator("#game-over-overlay").evaluate(
        "el => el.classList.contains('hidden')"
    ), "Play Again should hide the overlay"
    print("OK: Play Again restarts")

    browser.close()
    print("ALL TESTS PASSED")
