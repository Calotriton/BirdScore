"""Contrast of every colour pair that must contrast (WCAG 2.2: text 4.5:1, controls and chart marks 3:1), by day and
by night, computed from the tokens in app/style.css and the plot's colours in app/plot.js. After Apus's check."""
import re
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1] / "app"
CSS = (APP / "style.css").read_text(encoding="utf-8")
TOKENS = dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", CSS))
PLOT = dict(re.findall(r"(\w+): '(#[0-9a-fA-F]{6})'", (APP / "plot.js").read_text(encoding="utf-8")))
SURFACES = ["bg", "surface", "surface-2", "hover", "accent-soft"]


def luminance(hex_):
    c = [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


TEXT = [("ink", s) for s in SURFACES] + [("ink-2", s) for s in SURFACES] + [("accent", s) for s in ["bg", "surface", "surface-2", "accent-soft"]] \
    + [("on-accent", "accent"), ("on-accent", "accent-hover"), ("on-danger", "danger-solid"), ("danger", "surface"), ("danger", "surface-2"), ("warn", "warn-soft"), ("warn", "surface-2")]
MARKS = [("field-line", s) for s in ["surface", "surface-2", "bg"]] + [(m, s) for m in ["pos", "neg", "accent"] for s in ["surface", "surface-2"]]


@pytest.mark.parametrize("theme", ["l", "d"])
@pytest.mark.parametrize("pairs, need", [(TEXT, 4.5), (MARKS, 3.0)], ids=["text", "marks"])
def test_page_contrast(theme, pairs, need):
    bad = [(a, b, round(ratio(TOKENS[f"{a}-{theme}"], TOKENS[f"{b}-{theme}"]), 2)) for a, b in pairs
           if ratio(TOKENS[f"{a}-{theme}"], TOKENS[f"{b}-{theme}"]) < need]
    assert not bad, bad


def test_plot_contrast():
    white = PLOT["surface"]
    assert all(ratio(PLOT[k], white) >= 4.5 for k in ["ink", "ink2", "tick", "mark"])
    assert all(ratio(PLOT[k], white) >= 3 for k in ["pos", "neg", "curve"])
