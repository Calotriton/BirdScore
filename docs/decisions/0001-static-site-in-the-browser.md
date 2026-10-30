# 0001. A static site that works on the user's files in the browser
Status: Accepted (the owner's brief, with the stack proposed here)
Date: 2026-10-30

## Context
The owner asked for a website that runs in the browser and works locally, like their project Apus, published through GitHub. The owner has no server. Users are ecologists who may not code, and their recordings can be sensitive.

## Options considered
- **Plain HTML, CSS and JavaScript, no build step.** Small, nothing to maintain, and it can also run from disk.
- **Pyodide, as in Apus.** Apus needs it to run a notebook's Python unchanged. Here it would add a download of tens of megabytes for a calculation that takes a few lines.
- **A framework or a charting library.** More to keep up to date, and less control over a figure meant for papers.

## Decision
- Plain HTML, CSS and JavaScript in `app/`, published by GitHub Pages.
- Classic scripts, not modules, and no worker, so that `app/index.html` also works when opened straight from disk.
- The figure is one SVG string built by `plot.js`, so the preview and the files are the same drawing. PNG files are drawn from it and carry their resolution.
- Only file names are read, never audio. Nothing is sent anywhere, which `tests/test_app.py` checks.
- Excel files are read with SheetJS Community Edition 0.20.3 (Apache 2.0), kept in `app/vendor/` and loaded on demand. It is the only dependency. The copy on the npm registry is out of date, and the SheetJS documentation recommends keeping a copy from its own CDN. Its full build is used because the mini build does not read `.xls`.

## Evidence
The tests pass in Edge and Chrome, and in Playwright's Firefox and WebKit. Safari itself was not tried.

## Consequences
- Easier: no server, no build, no accounts, and the site can run with no internet connection.
- Harder: a very large Excel file freezes the page for a moment while it is read, because there is no worker. Moving that step to a worker is a small change if it becomes a problem.
- To reverse: nothing else depends on the choice of plain scripts. Moving to modules would only give up running from disk.
