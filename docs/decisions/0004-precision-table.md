# 0004. A precision table for each plot
Status: Accepted (the owner's request, with the details proposed here)
Date: 2026-10-30

## Context
The owner asked for an optional table for each plot, with the true positives, false positives and precision below 0.5 of confidence score, above it and in total. The user can choose one or more other scores.

## Options considered
- **Inside the figure, or on the page.** The first version drew it inside the figure. After trying it, the owner asked for it on the page, separate from the image, like the thresholds table.
- **On by default, or off.** Off, so that the page does not grow for those who do not need it.
- **A clip exactly on a score.** It could go in either range.

## Decision
- The table is an ordinary table on the page, right under each image, in the language of the site. The image and its files do not change with it. The numbers also go in `birdscore_precision.csv`.
- With one image per species, each image has its table. Under one image with all species, there is one table with a column of species.
- It is off by default and changes at once, like the other plot settings.
- A range includes its lower limit, as a threshold keeps scores at or above it. The rows read "< 0.50" and "≥ 0.50".
- A range with no clips shows a dash for its precision, not 0.

## Evidence
`tests/test_core.py` checks the counts, the limits and empty ranges. `tests/test_app.py` compares the page's table with counts made separately in Python, and checks that the image is the same with and without the table. On real data checked locally, the counts matched an independent count of the file names.

## Consequences
- Easier: the numbers can be copied into a manuscript, and the figure stays clean.
- Harder: a downloaded image does not carry the counts, so they must come from the table or the .csv.
- The table has no confidence intervals, because the owner asked for counts and precision. With few clips in a range, its precision is very uncertain, and the counts beside it show that.
- The Total row depends on how clips were chosen. If the number checked per range was chosen, it does not estimate the precision across all detections. The method text and the README say so.
