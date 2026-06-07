"""End-to-end UI test for the games shell (sidebar + iframe game swapping).

Covers: default 2048 load, hamburger toggle, sidebar backdrop, swapping to
Snake and back, sidebar auto-close on selection, and Escape-to-close.

Run (from the repo root):
    # start the app on port 5099 first, e.g.
    uv run --with flask==2.3.3 --with Werkzeug==2.3.7 flask --app app run --port 5099 &
    # then run the test (override the URL with BASE_URL if needed)
    uv run --with playwright python src/2048/test/test_shell.py
"""
import os

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5099")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1000, "height": 700})
    page.goto(BASE + "/")
    page.wait_for_load_state("networkidle")

    # Sidebar starts closed
    assert not page.locator("#sidebar").evaluate("el => el.classList.contains('open')"), "sidebar should start closed"

    # iframe default = 2048
    frame_src = page.locator("#game-frame").get_attribute("src")
    assert "2048" in frame_src, f"default frame should be 2048, got {frame_src}"

    # 2048 grid rendered inside iframe
    frame = page.frame_locator("#game-frame")
    cells = frame.locator(".cell")
    assert cells.count() == 16, f"expected 16 cells, got {cells.count()}"
    print("OK: 2048 loads by default with 16 cells")

    # Open sidebar via hamburger
    page.locator("#menu-toggle").click()
    page.wait_for_timeout(400)
    assert page.locator("#sidebar").evaluate("el => el.classList.contains('open')"), "sidebar should open"
    assert page.locator("#sidebar-backdrop").evaluate("el => el.classList.contains('visible')"), "backdrop visible"
    print("OK: hamburger opens sidebar")

    # Click Snake
    page.locator(".game-link", has_text="Snake").click()
    page.wait_for_timeout(500)
    frame_src = page.locator("#game-frame").get_attribute("src")
    assert "snake" in frame_src, f"frame should switch to snake, got {frame_src}"
    # sidebar closes after selection
    assert not page.locator("#sidebar").evaluate("el => el.classList.contains('open')"), "sidebar should close after pick"
    snake = page.frame_locator("#game-frame")
    assert snake.locator("h1", has_text="Snake").count() == 1, "snake placeholder heading missing"
    print("OK: Snake selection swaps iframe and closes sidebar")

    # Switch back to 2048
    page.locator("#menu-toggle").click()
    page.wait_for_timeout(300)
    page.locator(".game-link", has_text="2048").click()
    page.wait_for_timeout(500)
    assert "2048" in page.locator("#game-frame").get_attribute("src"), "should switch back to 2048"
    print("OK: switching back to 2048 works")

    # Escape closes sidebar
    page.locator("#menu-toggle").click()
    page.wait_for_timeout(300)
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    assert not page.locator("#sidebar").evaluate("el => el.classList.contains('open')"), "Escape should close sidebar"
    print("OK: Escape closes sidebar")

    browser.close()
    print("ALL TESTS PASSED")
