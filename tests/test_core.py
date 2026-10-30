"""The logic in core.js, run in the browser and compared with statsmodels and scikit-learn."""
import io
import math
import zipfile

import numpy as np
import pytest
import statsmodels.api as sm
from scipy.optimize import brentq
from sklearn.linear_model import LogisticRegression

CORE = "BirdScoreCore"


def js(page, expression, *args):
    return page.evaluate(f"(a) => {expression}", list(args))


def simulated(n=400, b0=-1.0, b1=1.6, seed=7):
    """Verdicts drawn from a known curve on the logit of the score."""
    rng = np.random.default_rng(seed)
    scores = np.round(rng.uniform(0.1, 1.0, n), 3)
    x = np.log(np.clip(scores, 1e-6, 1 - 1e-6) / (1 - np.clip(scores, 1e-6, 1 - 1e-6)))
    y = rng.random(n) < 1 / (1 + np.exp(-(b0 + b1 * x)))
    return scores, y.astype(int)


# ── Clip names ───────────────────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("name, score", [
    ("0.104_1_SITE01_20240511_193002_2361.0s_2364.0s.wav", 0.104),   # a code, then date and time
    ("0.114_4_20240511_193005_1317.0s_1320.0s.wav", 0.114),          # no code
    ("0.870_1_rec01_12.50s_15.00s.wav", 0.87),                       # BirdNET's current format
    ("1.000_7_rec_0.00s_3.00s.wav", 1.0),
    ("0.000_7_rec_0.00s_3.00s.flac", 0.0),
    ("0,104_1_rec_1.0s_4.0s.wav", 0.104),                            # a decimal comma
    (".85_clip.wav", 0.85),
    ("SITE05_0.85_clip.wav", 0.85),                                  # digits inside a code are not a number
])
def test_score_from_name(page, name, score):
    assert js(page, f"{CORE}.parseClip(a[0]).score", name) == pytest.approx(score)


@pytest.mark.parametrize("name, error", [
    ("SITE05_20240511_193002_0.0s_3.0s.wav", "no_score"),            # never take a clip time for a score
    ("rec_0.0s_3.0s.wav", "no_score"),
    ("20240511_193002.wav", "no_score"),                             # the first number has no decimals
    ("1_0.85_clip.wav", "no_score"),
    ("clip.wav", "no_score"),
    ("1.5_clip.wav", "score_range"),
    ("85.2_clip.wav", "score_range"),
])
def test_names_without_a_usable_score(page, name, error):
    assert js(page, f"{CORE}.parseClip(a[0]).error", name) == error


def test_details_from_a_name(page):
    c = js(page, f"{CORE}.parseClip(a[0])", "0.104_3_SITE01_20240511_193002_2361.0s_2364.0s.wav")
    assert c == {"score": 0.104, "segment": 3, "recording": "SITE01_20240511_193002", "site": "SITE01",
                 "date": "2024-05-11", "time": "19:30:02", "start": 2361.0, "end": 2364.0}
    c = js(page, f"{CORE}.parseClip(a[0])", "0.5_2_20241345_rec_1.0s_2.0s.wav")     # 20241345 is not a date
    assert c["date"] == "" and c["segment"] == 2 and c["recording"] == "20241345_rec"


def test_a_folder_counts_only_audio(page):
    part = js(page, f"{CORE}.readFolder(a[0])", [
        {"name": "0.5_1_r_0.0s_3.0s.wav", "webkitRelativePath": "Positive/0.5_1_r_0.0s_3.0s.wav"},
        {"name": "0.5_1_r_0.0s_3.0s.png", "webkitRelativePath": "Positive/0.5_1_r_0.0s_3.0s.png"},
        {"name": "0.7_1_r_0.0s_3.0s.WAV", "webkitRelativePath": "Positive/night/0.7_1_r_0.0s_3.0s.WAV"},
        {"name": "Thumbs.db", "webkitRelativePath": "Positive/Thumbs.db"},
        {"name": "._0.5_1_r_0.0s_3.0s.wav", "webkitRelativePath": "Positive/._0.5_1_r_0.0s_3.0s.wav"},
        {"name": "notes.wav", "webkitRelativePath": "Positive/notes.wav"},
    ])
    assert part["folder"] == "Positive"
    assert [c["score"] for c in part["clips"]] == [0.5, 0.7]
    assert part["clips"][1]["folder"] == "Positive/night"
    assert sorted(s["reason"] for s in part["skipped"]) == ["no_score", "not_audio"]


def test_groups_from_one_folder(page):
    files = [{"name": "x.wav", "webkitRelativePath": p} for p in [
        "all/Turdus_merula/Positive/x.wav", "all/Turdus_merula/Negative/x.wav",
        "all/Parus_major/area one/Positive/x.wav", "all/Parus_major/area one/Negative/x.wav",
        "all/Parus_major/plot.png",
    ]]
    groups = js(page, f"Object.fromEntries([...{CORE}.groupsFromTree(a[0])].map(([k, g]) => [k, [g.pos.length, g.neg.length]]))", files)
    assert groups == {"Turdus merula": [1, 1], "Parus major / area one": [1, 1]}
    one = [{"name": "x.wav", "webkitRelativePath": "Turdus_merula/Positive/x.wav"}]
    assert js(page, f"[...{CORE}.groupsFromTree(a[0]).keys()]", one) == ["Turdus merula"]
    spanish = [{"name": "x.wav", "webkitRelativePath": p} for p in ["Parus_major/positivos/x.wav", "Parus_major/NEG/x.wav", "Positano/rec/x.wav"]]
    groups = js(page, f"Object.fromEntries([...{CORE}.groupsFromTree(a[0])].map(([k, g]) => [k, [g.pos.length, g.neg.length]]))", spanish)
    assert groups == {"Parus major": [1, 1]}             # a place that only starts like "pos" is not a verdict


# ── Tables ───────────────────────────────────────────────────────────────────────────────────────────────
def test_delimited_text(page):
    parse = f"{CORE}.parseDelimited(a[0])"
    assert js(page, parse, 'a,b\n1,"x,""y"""\n') == [["a", "b"], ["1", 'x,"y"']]
    assert js(page, parse, "﻿a;b\r\n0,5;x\r\n") == [["a", "b"], ["0,5", "x"]]
    assert js(page, parse, "a\tb\n1\t2") == [["a", "b"], ["1", "2"]]
    assert js(page, parse, 'sep=;\na;b\n1;"line\nbreak"\n') == [["a", "b"], ["1", "line\nbreak"]]


def test_encodings(page):
    decode = f"{CORE}.decodeText(new Uint8Array(a[0]).buffer)"
    for raw in ["especie;cód".encode("utf-8"), "especie;cód".encode("cp1252"), "especie;cód".encode("utf-16")]:
        assert js(page, decode, list(raw)) == "especie;cód"


def test_header_after_a_title_line(page):
    t = js(page, f"{CORE}.tableFrom(a[0])", [["My validation"], [], ["species", "score", ""], ["a", 0.5, ""], ["", "", ""], ["b", 0.7, ""]])
    assert t["headers"] == ["species", "score", "Column 3"] and len(t["rows"]) == 2


def test_columns_are_guessed(page):
    guess = lambda h: js(page, f"{CORE}.guessColumns(a[0])", h)
    m = guess(["Start (s)", "End (s)", "Scientific name", "Common name", "Confidence", "File", "Validation"])
    assert (m["species"], m["score"], m["result"], m["file"]) == (2, 4, 6, 5)
    m = guess(["Especie", "Confianza", "Resultado", "Fecha", "Hora", "Grabadora", "Archivo"])
    assert list(m.values()) == [0, 1, 2, 3, 4, 5, 6]
    m = guess(["species", "model", "result", "correct", "confidence_score", "date", "time", "site_or_recorder",
               "recording", "clip_start_s", "clip_end_s", "segment", "file_name", "folder"])
    assert (m["species"], m["score"], m["result"], m["date"], m["time"], m["site"], m["file"]) == (0, 4, 2, 5, 6, 7, 12)


@pytest.mark.parametrize("value, expected", [
    (1, "positive"), (0, "negative"), (True, "positive"), (False, "negative"), ("TRUE", "positive"), ("Sí", "positive"),
    ("no", "negative"), ("Positivo", "positive"), ("FP", "negative"), ("TP", "positive"), ("maybe", None), ("", None),
])
def test_result_values(page, value, expected):
    assert js(page, f"{CORE}.classifyResult(a[0])", value) == expected


@pytest.mark.parametrize("value, expected", [
    (0.5, 0.5), ("0.5", 0.5), ("0,5", 0.5), (" 1 ", 1.0), ("85%", 0.85), (0, 0.0),
])
def test_scores_in_tables(page, value, expected):
    assert js(page, f"{CORE}.toScore(a[0])", value) == pytest.approx(expected)


@pytest.mark.parametrize("value", ["", "abc", 1.5, -0.1, "85", None])
def test_bad_scores_in_tables(page, value):
    assert js(page, f"Number.isNaN({CORE}.toScore(a[0]))", value)


def test_records_from_a_table(page):
    table = {"headers": ["sp", "cs", "ok", "file", "note"], "rows": [
        ["Turdus merula", "0,5", "yes", "0.5_1_SITE01_20240511_193002_1.0s_4.0s.wav", "good"],
        ["Turdus merula", 0.7, "no", "other.wav", ""],
        ["Turdus merula", 0.9, "maybe", "", ""],      # an unknown result
        ["Turdus merula", "n/a", "yes", "", ""],      # no score
        ["", 0.9, "yes", "", ""],                     # no species
        ["Parus major", 0.2, "skip", "", ""],         # set to Ignore below
    ]}
    m = {"species": 0, "score": 1, "result": 2, "date": -1, "time": -1, "site": -1, "file": 3}
    r = js(page, f"(() => {{ const r = {CORE}.recordsFromTable(a[0], a[1], a[2]); return {{ ...r, values: [...r.values.entries()] }}; }})()",
           table, m, {"skip": "ignore"})
    assert r["skipped"] == {"no_species": 1, "no_score": 1, "no_result": 1, "ignored": 1}
    first = r["records"][0]
    assert (first["species"], first["result"], first["score"], first["date"], first["site"], first["extra"]) == \
           ("Turdus merula", "positive", 0.5, "2024-05-11", "SITE01", {"note": "good"})
    assert r["records"][1]["result"] == "negative"
    assert dict(r["values"])["maybe"] == {"label": "maybe", "auto": None, "count": 1}


# ── Logistic regression ──────────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("scale", ["logit", "raw"])
def test_fit_matches_statsmodels(page, scale):
    scores, y = simulated()
    x = np.log(scores / (1 - scores)) if scale == "logit" else scores
    ref = sm.GLM(y, sm.add_constant(x), family=sm.families.Binomial()).fit(tol=1e-12)
    f = js(page, f"{CORE}.fitLogistic(a[0].map((s) => {CORE}.toX(s, a[2])), a[1])", scores.tolist(), y.tolist(), scale)
    assert f["converged"]
    assert [f["b0"], f["b1"]] == pytest.approx(ref.params.tolist(), abs=1e-7)
    assert [f["v00"], f["v01"], f["v11"]] == pytest.approx(ref.cov_params()[[0, 0, 1], [0, 1, 1]].tolist(), abs=1e-7)
    assert f["logLik"] == pytest.approx(ref.llf, abs=1e-7)
    assert f["aic"] == pytest.approx(ref.aic, abs=1e-6)


def test_fit_matches_apus_method(page):
    """Apus and ChirpID fit LogisticRegression(C=np.inf) on logit(confidence), with the score clipped at 1e-6."""
    scores, y = simulated(seed=11)
    scores[:3] = [0.0, 1.0, 1.0]
    clipped = np.clip(scores, 1e-6, 1 - 1e-6)
    x = np.log(clipped / (1 - clipped)).reshape(-1, 1)
    ref = LogisticRegression(C=np.inf, max_iter=10000, tol=1e-10).fit(x, y)
    f = js(page, f"{CORE}.fitLogistic(a[0].map((s) => {CORE}.toX(s, 'logit')), a[1])", scores.tolist(), y.tolist())
    assert [f["b0"], f["b1"]] == pytest.approx([ref.intercept_[0], ref.coef_[0][0]], abs=1e-3)


def test_fit_recovers_a_known_curve(page):
    scores, y = simulated(n=20000, b0=-1.0, b1=1.6, seed=3)
    f = js(page, f"{CORE}.fitLogistic(a[0].map((s) => {CORE}.toX(s, 'logit')), a[1])", scores.tolist(), y.tolist())
    assert [f["b0"], f["b1"]] == pytest.approx([-1.0, 1.6], abs=0.08)


@pytest.mark.parametrize("scale", ["logit", "raw"])
def test_band_matches_statsmodels(page, scale):
    scores, y = simulated()
    x = np.log(scores / (1 - scores)) if scale == "logit" else scores
    ref = sm.GLM(y, sm.add_constant(x), family=sm.families.Binomial()).fit(tol=1e-12)
    probe = np.array([0.15, 0.4, 0.73, 0.95])
    xp = np.log(probe / (1 - probe)) if scale == "logit" else probe
    frame = ref.get_prediction(sm.add_constant(xp)).summary_frame(alpha=0.05)
    got = js(page, f"(() => {{ const f = {CORE}.fitLogistic(a[0].map((s) => {CORE}.toX(s, a[2])), a[1]); "
                   f"return a[3].map((s) => {CORE}.probAt(f, a[2], s)); }})()",
             scores.tolist(), y.tolist(), scale, probe.tolist())
    assert [g["p"] for g in got] == pytest.approx(frame["mean"].tolist(), abs=1e-6)
    assert [g["lo"] for g in got] == pytest.approx(frame["mean_ci_lower"].tolist(), abs=1e-6)
    assert [g["hi"] for g in got] == pytest.approx(frame["mean_ci_upper"].tolist(), abs=1e-6)


@pytest.mark.parametrize("scale", ["logit", "raw"])
def test_threshold_and_its_interval(page, scale):
    """The threshold is where the curve reaches p, and its limits are where the band reaches p."""
    scores, y = simulated()
    x = np.log(scores / (1 - scores)) if scale == "logit" else scores
    ref = sm.GLM(y, sm.add_constant(x), family=sm.families.Binomial()).fit(tol=1e-12)
    b0, b1 = ref.params
    v = ref.cov_params()
    z = 1.959963984540054
    target = math.log(0.9 / 0.1)
    edge = lambda q, sign: b0 + b1 * q + sign * z * math.sqrt(v[0, 0] + 2 * q * v[0, 1] + q * q * v[1, 1]) - target
    span = (-3, 12) if scale == "logit" else (-1, 3)
    limits = [brentq(lambda q: edge(q, +1), *span), brentq(lambda q: edge(q, -1), *span)]
    if scale == "logit":
        limits = [1 / (1 + math.exp(-q)) for q in limits]
    r = js(page, f"(() => {{ const f = {CORE}.fitLogistic(a[0].map((s) => {CORE}.toX(s, a[2])), a[1]); "
                 f"return {CORE}.scoreAt(f, a[2], 0.9); }})()", scores.tolist(), y.tolist(), scale)
    expected = (target - b0) / b1
    expected = 1 / (1 + math.exp(-expected)) if scale == "logit" else expected
    assert r["score"] == pytest.approx(expected, abs=1e-6)
    assert r["ci"] == pytest.approx([max(limits[0], 0), min(limits[1], 1)], abs=1e-6)
    assert r["ci"][0] < r["score"] < r["ci"][1]


# ── What must be flagged ─────────────────────────────────────────────────────────────────────────────────
def clips(pos, neg, **extra):
    return [{"species": "s", "result": "positive", "score": s, **extra} for s in pos] + \
           [{"species": "s", "result": "negative", "score": s, **extra} for s in neg]


@pytest.mark.parametrize("pos, neg, status", [
    ([0.5, 0.9], [], "no_negative"),
    ([], [0.5, 0.9], "no_positive"),
    ([0.5, 0.5], [0.5], "no_spread"),
    ([0.6, 0.9], [0.1, 0.5], "separated"),
    ([0.5, 0.9], [0.1, 0.5], "separated"),     # touching at one score: still no finite fit
    ([0.1, 0.5], [0.6, 0.9], "reversed"),
    ([0.2, 0.6, 0.9], [0.1, 0.7], "ok"),
])
def test_status(page, pos, neg, status):
    a = js(page, f"{CORE}.analyse(a[0])[0]", clips(pos, neg))
    assert a["status"] == status
    assert (a["fits"]["logit"] is not None) == (status == "ok")


def note_codes(page, pos, neg, marks=()):
    return js(page, f"(() => {{ const x = {CORE}.analyse(a[0])[0]; const f = x.fits.logit; "
                    f"const m = f ? a[1].map((k) => {CORE}.readMark(f, 'logit', k, x.low, x.high)) : []; "
                    f"return {CORE}.notes(x, 'logit', m).map((n) => n.code); }})()",
              clips(pos, neg), list(marks))


def test_notes(page):
    assert note_codes(page, [0.2, 0.6, 0.9], [0.1, 0.7]) == ["few"]
    assert "slope" in note_codes(page, [0.1, 0.2, 0.3, 0.8] * 4, [0.7, 0.8, 0.9, 0.2] * 4)
    outside = note_codes(page, [0.3, 0.5, 0.6, 0.7] * 5, [0.2, 0.3, 0.4, 0.6] * 5, [{"kind": "score", "value": 0.05}])
    assert outside == ["outside"]


def test_a_threshold_the_raw_scale_cannot_reach(page):
    pos, neg = [0.2, 0.5, 0.6, 0.7, 0.8] * 5, [0.2, 0.3, 0.4, 0.5, 0.8] * 3
    m = js(page, f"(() => {{ const x = {CORE}.analyse(a[0])[0]; return {CORE}.readMark(x.fits.raw, 'raw', {{kind: 'p', value: 0.999}}, x.low, x.high); }})()", clips(pos, neg))
    assert not m["reachable"]


def precision_rows(page, pos, neg, cuts):
    return js(page, f"{CORE}.precisionTable(a[0], a[1])", clips(pos, neg), cuts)


def test_precision_table_by_default(page):
    rows = precision_rows(page, [0.2, 0.5, 0.9, 0.95], [0.1, 0.49, 0.5], [0.5])
    assert [(r["lo"], r["hi"], r["tp"], r["fp"], r["total"]) for r in rows] == [
        (None, 0.5, 1, 2, False),      # a clip exactly on 0.5 goes in the range above
        (0.5, None, 3, 1, False),
        (None, None, 4, 3, True),
    ]
    assert [r["precision"] for r in rows] == pytest.approx([1 / 3, 3 / 4, 4 / 7])


def test_precision_table_with_several_scores(page):
    rows = precision_rows(page, [0.2, 0.4, 0.6, 0.9], [0.1, 0.35, 0.7], [0.8, 0.3, 0.5, 0.3])    # unsorted, and one repeated
    assert [(r["lo"], r["hi"]) for r in rows] == [(None, 0.3), (0.3, 0.5), (0.5, 0.8), (0.8, None), (None, None)]
    assert [(r["tp"], r["fp"]) for r in rows] == [(1, 1), (1, 1), (1, 1), (1, 0), (4, 3)]
    ranges, total = rows[:-1], rows[-1]
    assert sum(r["tp"] for r in ranges) == total["tp"] and sum(r["fp"] for r in ranges) == total["fp"]


def test_precision_table_with_an_empty_range_or_no_score(page):
    rows = precision_rows(page, [0.6, 0.9], [0.7], [0.5])
    assert (rows[0]["tp"], rows[0]["fp"], rows[0]["precision"]) == (0, 0, None)      # no clips, so no precision, rather than 0
    rows = precision_rows(page, [0.6, 0.9], [0.7], [])
    assert len(rows) == 1 and rows[0]["total"] and rows[0]["precision"] == pytest.approx(2 / 3)


def test_precision_table_with_no_negatives(page):
    rows = precision_rows(page, [0.2, 0.9], [], [0.5])
    assert [r["precision"] for r in rows] == [1, 1, 1]


def test_confounding_with_year_and_recorder(page):
    before = [{"species": "s", "result": "positive", "score": 0.3 + i / 100, "date": "2022-05-01", "site": "A"} for i in range(30)]
    after = [{"species": "s", "result": "negative", "score": 0.2 + i / 100, "date": "2025-04-01", "site": "B"} for i in range(30)]
    a = js(page, f"{CORE}.analyse(a[0])[0]", before + after)
    assert a["confounded"] == [{"field": "year", "pos": "2022", "neg": "2025"}, {"field": "site", "pos": "A", "neg": "B"}]
    mixed = before + after + [{**c, "date": "2025-04-01", "site": "B"} for c in before]
    assert js(page, f"{CORE}.analyse(a[0])[0].confounded", mixed) == []


# ── Files ────────────────────────────────────────────────────────────────────────────────────────────────
def test_data_csv(page):
    records = [{"species": 'a "b"', "result": "positive", "score": 0.5, "date": "2024-05-11", "time": "", "site": "", "recording": "",
                "start": 1.5, "end": None, "segment": None, "file": "=cmd.wav", "folder": "", "extra": {"date": "x", "note": "a,b"}}]
    text = js(page, f"{CORE}.dataCsv(a[0], 'BirdNET', 'comma')", records)
    head, row = text.strip().split("\r\n")
    assert head.endswith("file_name,folder,source_date,note")
    assert row == "\"a \"\"b\"\"\",BirdNET,positive,1,0.5,2024-05-11,,,,1.5,,,'=cmd.wav,,x,\"a,b\""
    excel = js(page, f"{CORE}.dataCsv(a[0], 'BirdNET', 'semicolon')", records)
    assert excel.startswith("﻿species;") and ";0,5;" in excel and ";1,5;" in excel


def test_zip_opens(page):
    data = js(page, f"Array.from({CORE}.zipStore(a[0].map((f) => ({{ name: f[0], data: new TextEncoder().encode(f[1]) }}))))",
              [["uno.csv", "a,b"], ["cód é.svg", "<svg/>"]])
    z = zipfile.ZipFile(io.BytesIO(bytes(data)))
    assert z.testzip() is None
    assert z.read("uno.csv") == b"a,b" and z.read("cód é.svg") == b"<svg/>"
