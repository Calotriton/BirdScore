# 0004. A precision table for each plot
Status: Accepted (the owner's request, with the details proposed here)
Date: 2026-10-30

## Context
The owner asked for an optional table for each plot, with the true positives, false positives and precision below 0.5 of confidence score, above it and in total. The user can choose one or more other scores.

## Options considered
- **Inside the figure, or beside it on the page.** Inside, it goes with the figure into the PNG and SVG files. Beside it, it can be copied, but a downloaded figure would lose it.
- **On by default, or off.** Off, so that the figures people already make do not change.
- **A clip exactly on a score.** It could go in either range.

## Decision
- The table is drawn inside the figure, under the plot, in the style of a journal table. In a grid, each plot has its own. The numbers also go in `birdscore_precision.csv`, because a table in an image cannot be copied.
- It is off by default and changes at once, like the other plot settings.
- A range includes its lower limit, as a threshold keeps scores at or above it. The rows read "< 0.50" and "≥ 0.50".
- The first column takes the name of the X axis, so the two stay the same word in any language.
- A range with no clips shows a dash for its precision, not 0.
- In a grid with tables, every plot has its own X axis, because the table breaks the axis shared with the row below.

## Evidence
`tests/test_core.py` checks the counts, the limits and empty ranges. `tests/test_app.py` compares the page's table with counts made separately in Python. On real data checked locally, the page's table matched an independent count of the file names.

## Consequences
- Easier: one image carries the curve and the counts behind it.
- Harder: a figure with many scores or many species gets taller.
- The table has no confidence intervals, because the owner asked for counts and precision. With few clips in a range, its precision is very uncertain, and the counts beside it show that.
- The Total row depends on how clips were chosen. If the number checked per range was chosen, it does not estimate the precision across all detections. The method text and the README say so.
