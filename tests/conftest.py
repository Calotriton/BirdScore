"""The tests drive the real page in the installed Edge (Playwright, no browser download).
Node is not needed: the JavaScript runs where it will run for users.
BIRDSCORE_BROWSER=chrome, firefox or webkit runs them elsewhere; the last two need `playwright install`."""
import http.server
import os
import threading
from functools import partial
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[1] / "app"


@pytest.fixture(scope="session")
def site():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(APP)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}/"
    server.shutdown()


@pytest.fixture(scope="session")
def browser():
    name = os.environ.get("BIRDSCORE_BROWSER", "msedge")
    with sync_playwright() as p:
        browser = getattr(p, name).launch() if name in ("firefox", "webkit") else p.chromium.launch(channel=name)
        yield browser
        browser.close()


@pytest.fixture
def page(browser, site):
    context = browser.new_context(accept_downloads=True, locale="en-GB", timezone_id="Europe/Madrid")
    page = context.new_page()
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" else None)
    page.goto(site)
    yield page
    context.close()
    assert not page.errors, page.errors
