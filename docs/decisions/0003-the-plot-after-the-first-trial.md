# 0003. The plot after the owner's first trial
Status: Accepted (the owner's requests, with the details proposed here)
Date: 2026-10-30

## Context
After trying the first version, the owner asked for a cleaner plot, for colours adapted to colour blindness, and for Catalan.

## Options considered
- **Colour blindness:** new colours by default, or a switch. The owner chose a switch, so the standard colours stay as they were.
- **Thresholds:** dashed lines to both axes, or one vertical line. The owner chose the vertical line, because a plot usually carries one threshold and its meaning belongs in the figure's caption.
- **A threshold beyond the scores checked:** a line where no curve is drawn, or no line. No line, with the value and a note in the table.

## Decision
- A switch gives colour-blind readers Okabe and Ito's blue (#0072B2) and vermilion (#D55E00), with solid points and a thin white ring.
- The curve and the band are drawn only across the scores checked. There is no extrapolated part, and hovering reads the curve only there.
- A threshold is one full-height vertical dashed line with its score beside the axis. The horizontal line, the probability label and the dot on the curve are gone.
- The title and subtitle can sit on the left, in the centre or on the right. The totals and the legend follow them.
- The totals and each legend entry can be turned off. An entry going away leaves its mark on the plot.
- Catalan joins English and Spanish. The header's button became a menu, and the axis names stay in English by default in every language, as the owner asked for Spanish.

## Evidence
- The dataviz validator, on white, for the switch's colours as drawn: colour-blind separation ΔE 21.9 (protanopia, the worst case; the target is at least 8), normal vision ΔE 31.2, and contrast above 3:1 for both.
- The same for the standard colours as drawn, at 50% opacity: ΔE 8.2, and contrast of 1.87:1 and 2.2:1, below the 3:1 of WCAG 2.2 for chart marks.
- Edge's vision simulator: the switch's colours stay clearly distinct with deuteranopia, protanopia and tritanopia. No colour-blind reader has checked them.

## Consequences
- Easier: a plot with one threshold is clean, and a figure can carry only what its caption does not explain.
- Harder: a reader of the plot alone cannot see which probability the line stands for, so the caption must say it. The table and `birdscore_thresholds.csv` hold the numbers.
- The standard points stay below 3:1 on white. To reverse that, make the switch's solid points the default, or draw the standard colours solid.
