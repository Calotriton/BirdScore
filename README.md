# BirdScore

BirdScore turns the detections you checked into a logistic regression plot. The X axis is the confidence score of BirdNET or any other bird identifier. The Y axis is the probability that an identification is correct. From the curve you read the score to use as a threshold.

It runs in your browser. There is nothing to install and your files never leave your computer. BirdScore reads file names, not audio.

Open it at https://calotriton.github.io/BirdScore/. You can also download this repository and open `app/index.html` directly, with no internet connection.

## What you give it

Either of these, for one species or for many:

- **Folders of clips.** A Positive folder and a Negative folder for each species. The score is the first number in each file name, for example `0.104` in `0.104_1_recording_12.0s_15.0s.wav`, which is how BirdNET names its clips. The date, time, site or recorder and clip times are read from the rest of the name when they are there. One folder that holds Positive and Negative folders at any depth also works.
- **An Excel or CSV file.** Choose the columns for the species, the confidence score and the result, and say what each result value means. Date, time, site and file name columns are optional. Every other column is kept.

## What you choose

- The thresholds to mark: a target probability shows the score that reaches it, and a score shows its probability.
- The title and subtitle of each plot. The title starts as the species name.
- One image per species, or one image with all species in a grid such as 2 × 3.
- The names of the axes, which start as "Confidence score" and "True positive rate" in both languages.
- Jitter for the points, which never changes their scores.
- English or Spanish, for the site and for the plot.

## What you get

- The plots, as PNG at 150, 300 or 600 dpi, or as SVG.
- `birdscore_detections.csv`, with one row per detection and everything read from the files.
- `birdscore_thresholds.csv`, with the thresholds and their intervals, the fitted coefficients and the notes for each species.

## The method

BirdScore fits one logistic regression per species by maximum likelihood, with no penalty, on the logit of the score. This is the approach of [Wood and Kahl (2024)](https://doi.org/10.1007/s10336-024-02144-5). The score itself can be used instead, under Advanced.

The band is the 95% Wald interval on the logit scale. A threshold is the score where the curve reaches the chosen probability, and its interval runs between the scores where the band reaches it.

## What to keep in mind

- The curve describes the detections you checked: that species, that model and those recordings. Check before using it elsewhere.
- It estimates how often a detection at a given score is correct, which is a kind of precision. It says nothing about the calls the model missed. In statistics "true positive rate" usually means that other quantity, recall, so you may want to rename the Y axis in a paper.
- The band and the intervals treat clips as independent. Clips from one recording or night often are not, so the real uncertainty can be larger.
- The curve holds only across the scores you checked. Beyond them it is drawn faded.
- If you chose clips by their result rather than by their score, the curve and the thresholds shift.

BirdScore warns about what it can see: too few clips of one kind, no overlap between positives and negatives, a curve that falls, thresholds outside the scores checked, and positives and negatives that come mostly from different years or recorders.

## For developers

The site is plain HTML, CSS and JavaScript in `app/`, with no build step. `core.js` holds the logic, `plot.js` draws the figure as one SVG, `i18n.js` holds the Spanish texts and `app.js` runs the page. GitHub Pages publishes `app/` on every push that changes it. Decisions are in `docs/decisions/`.

The tests drive the real page in Edge and compare the results with statsmodels and scikit-learn. They need Python, but not Node:

```
py -m venv .venv
.venv\Scripts\pip install -r tests\requirements.txt
.venv\Scripts\python -m pytest tests
```

Excel files are read with [SheetJS Community Edition](https://sheetjs.com) 0.20.3, Apache 2.0, kept in `app/vendor/` and loaded only when an Excel file is opened.
