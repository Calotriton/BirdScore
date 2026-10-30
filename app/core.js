// BirdScore's logic. No page code here, so the tests can run it alone in a browser.
// A classic script, not a module: the site also works when index.html is opened straight from disk.
const BirdScoreCore = (() => {
  // ── Clip names ───────────────────────────────────────────────────────────────────────────────────────
  // BirdNET writes {confidence:.3f}_{counter}_{source file}_{start}s_{end}s.wav
  const AUDIO = /\.(wav|wave|flac|mp3|ogg|oga|opus|m4a|aac|wma|aif|aiff)$/i;
  const SYSTEM_FILE = /^(\.|desktop\.ini$|thumbs\.db$)/i;
  // The first number that stands alone: not the 05 of "SITE05", nor a clip time such as "0.0s"
  const FIRST_NUMBER = /(?<![\p{L}\p{N}]|\d[.,])\d*[.,]?\d+(?![\p{L}\p{N}]|[.,]\d)/u;
  const STAMP = /(?<!\d)(\d{4})-?(\d{2})-?(\d{2})(?:[_T\- ]?(\d{2})[-:]?(\d{2})[-:]?(\d{2}))?(?!\d)/g;
  const stemOf = (name) => name.replace(/\.[a-z][a-z0-9]{1,4}$/i, '');

  function findStamp(text) {
    for (const m of text.matchAll(STAMP)) {
      const [y, mo, d] = [+m[1], +m[2], +m[3]], day = new Date(Date.UTC(y, mo - 1, d));
      if (y < 1900 || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) continue;   // not a real date
      const clock = m[4] && +m[4] < 24 && +m[5] < 60 && +m[6] < 60;
      return { index: m.index, date: `${m[1]}-${m[2]}-${m[3]}`, time: clock ? `${m[4]}:${m[5]}:${m[6]}` : '' };
    }
    return null;
  }

  // What the rest of a name says: the counter, the source recording, its date and time, and the clip's times
  function clipDetails(rest) {
    const out = { segment: null, recording: '', site: '', date: '', time: '', start: null, end: null };
    let text = rest.replace(/^[\s_-]+/, '');
    const times = text.match(/(?:^|[\s_-])(\d+(?:\.\d+)?)s[\s_-]+(\d+(?:\.\d+)?)s$/i);
    if (times) { out.start = +times[1]; out.end = +times[2]; text = text.slice(0, times.index); }
    const counter = text.match(/^(\d{1,7})(?:[\s_-]+|$)/);
    if (counter) { out.segment = +counter[1]; text = text.slice(counter[0].length); }
    out.recording = text;
    const stamp = findStamp(text);
    if (stamp) {
      out.date = stamp.date;
      out.time = stamp.time;
      out.site = text.slice(0, stamp.index).replace(/[\s_-]+$/, '');
    }
    return out;
  }

  function parseClip(name) {
    const stem = stemOf(name), found = stem.match(FIRST_NUMBER);
    if (!found || !/[.,]/.test(found[0])) return { error: 'no_score' };
    const score = Number(found[0].replace(',', '.'));
    if (score > 1) return { error: 'score_range' };
    return { score, ...clipDetails(stem.slice(found.index + found[0].length)) };
  }

  // Only names are read, never the audio. Companion files (a .png beside each .wav) must not count twice.
  function readFolder(files) {
    const part = { folder: '', clips: [], skipped: [] };
    for (const f of files) {
      const path = f.webkitRelativePath || f.name;
      part.folder ||= path.split('/')[0];
      if (SYSTEM_FILE.test(f.name)) continue;
      if (!AUDIO.test(f.name)) { part.skipped.push({ file: path, reason: 'not_audio' }); continue; }
      const clip = parseClip(f.name);
      if (clip.error) part.skipped.push({ file: path, reason: clip.error });
      else part.clips.push({ ...clip, file: f.name, folder: path.slice(0, -f.name.length - 1) });
    }
    return part;
  }

  // One picked folder that holds Positive and Negative folders at any depth: one group per pair
  const POS_FOLDER = /^(positiv|pos$)/i, NEG_FOLDER = /^(negativ|neg$)/i;
  function groupsFromTree(files) {
    const groups = new Map();
    for (const f of files) {
      const parts = (f.webkitRelativePath || f.name).split('/').slice(0, -1);
      const i = parts.findLastIndex((p) => POS_FOLDER.test(p) || NEG_FOLDER.test(p));
      if (i < 0) continue;
      const name = (parts.slice(1, i).join(' / ') || parts[0]).replace(/_/g, ' ');
      if (!groups.has(name)) groups.set(name, { pos: [], neg: [], folders: {} });
      const kind = POS_FOLDER.test(parts[i]) ? 'pos' : 'neg', group = groups.get(name);
      group[kind].push(f);
      group.folders[kind] = parts[i];
    }
    return groups;
  }

  const recordFromClip = (species, result, c) => ({
    species, result, score: c.score, date: c.date, time: c.time, site: c.site, recording: c.recording,
    start: c.start, end: c.end, segment: c.segment, file: c.file, folder: c.folder,
  });

  const recordsFromFolders = (rows) => rows.flatMap((row) => [
    ...(row.pos?.clips ?? []).map((c) => recordFromClip(row.name, 'positive', c)),
    ...(row.neg?.clips ?? []).map((c) => recordFromClip(row.name, 'negative', c)),
  ]);

  // ── Tables ───────────────────────────────────────────────────────────────────────────────────────────
  function decodeText(buffer) {
    const b = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buffer);
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buffer);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { return new TextDecoder('windows-1252').decode(buffer); }   // CSV saved by Excel on Windows
  }

  function parseDelimited(text) {
    text = text.replace(/^﻿/, '').replace(/^sep=.\r?\n/i, '');
    const head = text.slice(0, text.search(/\r?\n|$/));
    const sep = [',', ';', '\t', '|'].map((c) => [head.split(c).length, c]).sort((a, b) => b[0] - a[0])[0][1];
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c !== '"') cell += c;
        else if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else if (c === '"' && cell === '') quoted = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Excel files often open with a title line, so the header is the first row with two or more filled cells
  function tableFrom(rows) {
    const filled = (r) => r.filter((c) => String(c ?? '').trim() !== '').length;
    const start = rows.findIndex((r) => filled(r) >= 2);
    if (start < 0) return { headers: [], rows: [] };
    return {
      headers: rows[start].map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`),
      rows: rows.slice(start + 1).filter((r) => filled(r) > 0),
    };
  }

  const GUESS = {
    species: [/^species$/i, /scientific|cient[ií]fic/i, /species|especie|tax[oó]n/i, /common.?name|nombre/i],
    score: [/^confidence_score$/i, /confidence|confianza/i, /\bscore\b|puntuaci/i, /^(cs|conf)$/i, /prob/i],
    result: [/^result$/i, /result|verdict|veredicto|valid|verif|check|revis|label|etiqueta|outcome|correct|positiv|^(tp|fp)\b|^true/i],
    date: [/^date$/i, /date|fecha/i],
    time: [/^time$/i, /\btime\b|hora/i],
    site: [/site_or_recorder/i, /site|sitio|recorder|grabadora|station|estaci[oó]n|locali/i],
    file: [/^file_name$/i, /file|archivo|fichero|clip/i],
  };

  function guessColumns(headers) {
    const map = {}, taken = new Set();
    for (const [role, patterns] of Object.entries(GUESS)) {
      map[role] = -1;
      for (const pattern of patterns) {
        const i = headers.findIndex((h, k) => !taken.has(k) && pattern.test(h));
        if (i >= 0) { map[role] = i; taken.add(i); break; }
      }
    }
    return map;
  }

  const normal = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const POSITIVE = new Set(['1', '1.0', 'true', 't', 'yes', 'y', 'si', 's', 'positive', 'positivo', 'positiva', 'pos', 'p',
    'correct', 'correcto', 'correcta', 'tp', 'true positive', 'verdadero', 'verdadero positivo', 'vp', 'v', 'ok', 'acierto']);
  const NEGATIVE = new Set(['0', '0.0', 'false', 'f', 'no', 'n', 'negative', 'negativo', 'negativa', 'neg',
    'incorrect', 'incorrecto', 'incorrecta', 'wrong', 'fp', 'false positive', 'falso', 'falso positivo', 'fallo', 'error']);
  const classifyResult = (v) => { const k = normal(v); return POSITIVE.has(k) ? 'positive' : NEGATIVE.has(k) ? 'negative' : null; };

  function toScore(v) {
    if (typeof v === 'number') return v >= 0 && v <= 1 ? v : NaN;
    let s = String(v ?? '').trim().replace(',', '.');
    const percent = s.endsWith('%');
    if (percent) s = s.slice(0, -1).trim();
    if (s === '') return NaN;
    const n = Number(s) / (percent ? 100 : 1);
    return n >= 0 && n <= 1 ? n : NaN;
  }

  // Excel dates arrive as Date objects holding the sheet's clock time in UTC fields
  const pad = (n) => String(n).padStart(2, '0');
  const dateOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const timeOf = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());
  function cellText(v) {
    if (isDate(v)) return v.getUTCFullYear() < 1905 ? timeOf(v) : `${dateOf(v)}${timeOf(v) === '00:00:00' ? '' : ` ${timeOf(v)}`}`;
    return String(v ?? '').trim();
  }

  // The values of the result column, what each one means, and every row that cannot be used
  function recordsFromTable(table, map, values = {}, fixedSpecies = '') {
    const used = new Set(Object.values(map).filter((i) => i >= 0));
    const extras = table.headers.map((h, i) => [h, i]).filter(([, i]) => !used.has(i));
    const records = [], skipped = { no_species: 0, no_score: 0, no_result: 0, ignored: 0 }, seen = new Map();
    for (const row of table.rows) {
      const raw = map.result >= 0 ? row[map.result] : '';
      const key = normal(raw), auto = classifyResult(raw), result = values[key] ?? auto;
      if (key && !seen.has(key)) seen.set(key, { label: cellText(raw), auto, count: 0 });
      if (key) seen.get(key).count++;
      const species = map.species >= 0 ? cellText(row[map.species]) : fixedSpecies.trim();
      const score = map.score >= 0 ? toScore(row[map.score]) : NaN;
      if (!species) { skipped.no_species++; continue; }
      if (Number.isNaN(score)) { skipped.no_score++; continue; }
      if (result === 'ignore') { skipped.ignored++; continue; }
      if (!result) { skipped.no_result++; continue; }
      const file = map.file >= 0 ? cellText(row[map.file]) : '';
      const details = file ? (({ error, ...d }) => (error ? clipDetails(stemOf(file)) : d))(parseClip(file)) : clipDetails('');
      const dateCell = map.date >= 0 ? row[map.date] : '', timeCell = map.time >= 0 ? row[map.time] : '';
      records.push({
        species, result, score,
        date: isDate(dateCell) ? dateOf(dateCell) : cellText(dateCell) || details.date,
        time: isDate(timeCell) ? timeOf(timeCell) : cellText(timeCell) || details.time,
        site: (map.site >= 0 && cellText(row[map.site])) || details.site,
        recording: details.recording, start: details.start, end: details.end, segment: details.segment,
        file, folder: '',
        extra: Object.fromEntries(extras.map(([h, i]) => [h, cellText(row[i])])),
      });
    }
    return { records, skipped, values: seen };
  }

  // ── Logistic regression ──────────────────────────────────────────────────────────────────────────────
  const Z95 = 1.959963984540054;
  const EPS = 1e-6;     // scores of exactly 0 or 1 have no logit; the same limit as Apus and ChirpID, so results agree
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const logit = (p) => Math.log(p / (1 - p));
  const toX = (score, scale) => (scale === 'logit' ? logit(Math.min(Math.max(score, EPS), 1 - EPS)) : score);
  const fromX = (x, scale) => (scale === 'logit' ? sigmoid(x) : x);

  // Maximum likelihood by Newton's method, halving a step that would lower the likelihood
  function fitLogistic(x, y) {
    const n = x.length;
    const logLik = (b0, b1) => {
      let ll = 0;
      for (let i = 0; i < n; i++) {
        const eta = b0 + b1 * x[i];
        ll -= Math.log1p(Math.exp(y[i] ? -eta : eta));
      }
      return ll;
    };
    const mean = y.reduce((a, b) => a + b, 0) / n;
    let b0 = logit(mean), b1 = 0, ll = logLik(b0, b1), converged = false, a, b, c, iterations = 0;
    while (iterations < 200) {
      iterations++;
      let g0 = 0, g1 = 0;
      a = b = c = 0;
      for (let i = 0; i < n; i++) {
        const p = sigmoid(b0 + b1 * x[i]), w = p * (1 - p), r = y[i] - p;
        g0 += r; g1 += r * x[i];
        a += w; b += w * x[i]; c += w * x[i] * x[i];
      }
      const det = a * c - b * b;
      const d0 = (c * g0 - b * g1) / det, d1 = (a * g1 - b * g0) / det;
      let step = 1, next = logLik(b0 + d0, b1 + d1);
      while (!(next >= ll) && step > 1e-8) { step /= 2; next = logLik(b0 + step * d0, b1 + step * d1); }
      if (!(next >= ll)) { converged = true; break; }    // no step improves it: at the limit of number precision
      b0 += step * d0; b1 += step * d1;
      const done = next - ll < 1e-11 * (Math.abs(ll) + 1e-11);
      ll = next;
      if (done) { converged = true; break; }
    }
    a = b = c = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(b0 + b1 * x[i]), w = p * (1 - p);
      a += w; b += w * x[i]; c += w * x[i] * x[i];
    }
    const det = a * c - b * b;
    return { b0, b1, v00: c / det, v01: -b / det, v11: a / det, logLik: ll, aic: 4 - 2 * ll, iterations, converged };
  }

  // The probability at a score, with its 95% Wald band on the logit scale
  function probAt(fit, scale, score) {
    const x = toX(score, scale), eta = fit.b0 + fit.b1 * x;
    const se = Math.sqrt(fit.v00 + 2 * x * fit.v01 + x * x * fit.v11);
    return { p: sigmoid(eta), lo: sigmoid(eta - Z95 * se), hi: sigmoid(eta + Z95 * se) };
  }

  // The score where the curve reaches p. Its interval is where the same 95% band reaches p (Fieller's theorem)
  function scoreAt(fit, scale, p) {
    const target = logit(p), x = (target - fit.b0) / fit.b1, score = fromX(x, scale);
    const reachable = scale === 'logit' ? score >= EPS && score <= 1 - EPS : score >= 0 && score <= 1;
    const d = fit.b0 - target, z2 = Z95 * Z95;
    const A = fit.b1 * fit.b1 - z2 * fit.v11, B = 2 * (fit.b1 * d - z2 * fit.v01), C = d * d - z2 * fit.v00;
    const disc = B * B - 4 * A * C;
    if (A <= 0 || disc < 0) return { score, reachable, ci: null };     // the slope is too uncertain to bound it
    const bound = (v) => Math.min(Math.max(fromX(v, scale), 0), 1);
    return { score, reachable, ci: [bound((-B - Math.sqrt(disc)) / (2 * A)), bound((-B + Math.sqrt(disc)) / (2 * A))] };
  }

  // A mark on the plot: a target probability, or a confidence score to read the probability at
  function readMark(fit, scale, mark, low, high) {
    if (mark.kind === 'score') {
      const r = probAt(fit, scale, mark.value);
      return { ...mark, score: mark.value, p: r.p, ci: [r.lo, r.hi], reachable: true, inRange: mark.value >= low && mark.value <= high };
    }
    const r = scoreAt(fit, scale, mark.value);
    return { ...mark, p: mark.value, score: r.score, ci: r.ci, reachable: r.reachable, inRange: r.score >= low && r.score <= high };
  }

  // Only across the scores that were checked: no extrapolation
  function curve(fit, scale, low, high, steps = 240) {
    return Array.from({ length: steps + 1 }, (_, i) => low + ((high - low) * i) / steps)
      .map((score) => ({ score, ...probAt(fit, scale, score) }));
  }

  const minOf = (values) => values.reduce((a, b) => (b < a ? b : a), Infinity);
  const maxOf = (values) => values.reduce((a, b) => (b > a ? b : a), -Infinity);

  // Share of correct clips per 0.1 band of score, to compare with the curve
  function observedBands(clips) {
    const bands = new Map();
    for (const c of clips) {
      const k = Math.min(Math.floor(c.score * 10), 9);
      if (!bands.has(k)) bands.set(k, { sum: 0, correct: 0, n: 0 });
      const b = bands.get(k);
      b.sum += c.score; b.n++; if (c.result === 'positive') b.correct++;
    }
    return [...bands.values()].map((b) => ({ score: b.sum / b.n, share: b.correct / b.n, n: b.n }));
  }

  // True and false positives per range of score. A range includes its lower limit, as a threshold keeps scores at or above it.
  function precisionTable(clips, cuts) {
    const row = (lo, hi, total = false) => {
      const inside = clips.filter((c) => (lo === null || c.score >= lo) && (hi === null || c.score < hi));
      const tp = inside.filter((c) => c.result === 'positive').length;
      return { lo, hi, tp, fp: inside.length - tp, precision: inside.length ? tp / inside.length : null, total };
    };
    const limits = [...new Set(cuts)].sort((a, b) => a - b), lows = [null, ...limits];
    const ranges = limits.length ? [...limits, null].map((hi, i) => row(lows[i], hi)) : [];
    return [...ranges, row(null, null, true)];
  }

  // A warning, not a test: most positives and most negatives come from different years or recorders
  function confounding(pos, neg) {
    const year = (c) => String(c.date ?? '').match(/\b(?:19|20)\d{2}\b/)?.[0];
    const out = [];
    for (const [field, read] of [['year', year], ['site', (c) => c.site]]) {
      const tally = (clips) => {
        const counts = new Map();
        let total = 0;
        for (const c of clips) { const v = read(c); if (v) { counts.set(v, (counts.get(v) || 0) + 1); total++; } }
        const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
        return { counts, total, top };
      };
      const a = tally(pos), b = tally(neg);
      if (a.total < 5 || b.total < 5) continue;
      let overlap = 0;
      for (const [v, n] of a.counts) overlap += Math.min(n / a.total, (b.counts.get(v) || 0) / b.total);
      if (overlap < 0.2) out.push({ field, pos: a.top, neg: b.top });
    }
    return out;
  }

  function analyseSpecies(species, clips) {
    const pos = clips.filter((c) => c.result === 'positive'), neg = clips.filter((c) => c.result === 'negative');
    const scores = clips.map((c) => c.score), posScores = pos.map((c) => c.score), negScores = neg.map((c) => c.score);
    const low = minOf(scores), high = maxOf(scores);
    let status = 'ok';
    if (!neg.length) status = 'no_negative';
    else if (!pos.length) status = 'no_positive';
    else if (low === high) status = 'no_spread';
    else if (minOf(posScores) >= maxOf(negScores)) status = 'separated';    // no finite fit exists
    else if (maxOf(posScores) <= minOf(negScores)) status = 'reversed';
    const y = clips.map((c) => (c.result === 'positive' ? 1 : 0));
    const fitOn = (scale) => (status === 'ok' ? fitLogistic(scores.map((s) => toX(s, scale)), y) : null);
    const recordings = new Set(clips.map((c) => c.recording).filter(Boolean)).size;
    return {
      species, clips, nPos: pos.length, nNeg: neg.length, low, high, recordings, status,
      lowestPos: minOf(posScores), highestNeg: maxOf(negScores),
      fits: { logit: fitOn('logit'), raw: fitOn('raw') },
      confounded: confounding(pos, neg),
      bands: observedBands(clips),
    };
  }

  function analyse(records) {
    const bySpecies = new Map();
    for (const r of records) {
      if (!bySpecies.has(r.species)) bySpecies.set(r.species, []);
      bySpecies.get(r.species).push(r);
    }
    return [...bySpecies].map(([species, clips]) => analyseSpecies(species, clips));
  }

  // What a reader must know about one species' result, as codes the page translates
  function notes(a, scale, marks) {
    const out = [];
    if (a.status !== 'ok') out.push({ code: a.status, lo: a.highestNeg, hi: a.lowestPos });
    const small = Math.min(a.nPos, a.nNeg);
    if (small > 0 && small < 10) out.push({ code: 'few', n: small, kind: a.nNeg <= a.nPos ? 'negative' : 'positive' });
    if (a.fits[scale] && a.fits[scale].b1 <= 0) out.push({ code: 'slope' });
    for (const m of marks) {
      if (!m.reachable) out.push({ code: 'unreached', p: m.value });
      else if (!m.inRange) out.push({ code: 'outside', kind: m.kind, value: m.value, low: a.low, high: a.high });
    }
    for (const c of a.confounded) out.push({ code: `confounded_${c.field}`, pos: c.pos, neg: c.neg });
    return out;
  }

  // ── Files ────────────────────────────────────────────────────────────────────────────────────────────
  const DATA_COLUMNS = ['species', 'model', 'result', 'correct', 'confidence_score', 'date', 'time', 'site_or_recorder',
    'recording', 'clip_start_s', 'clip_end_s', 'segment', 'file_name', 'folder'];

  function toCsv(header, rows, format = 'comma') {
    const sep = format === 'semicolon' ? ';' : ',';
    const cell = (v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return format === 'semicolon' ? String(v).replace('.', ',') : String(v);
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;                     // a text that a spreadsheet would run as a formula
      return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header, ...rows].map((r) => r.map(cell).join(sep));
    // Excel needs the mark to read accents; base R's read.csv would take it into the first column's name
    return (format === 'semicolon' ? '﻿' : '') + lines.join('\r\n') + '\r\n';
  }

  function dataCsv(records, model, format) {
    const extras = Object.keys(records[0]?.extra ?? {});
    const header = [...DATA_COLUMNS, ...extras.map((h) => (DATA_COLUMNS.includes(h) ? `source_${h}` : h))];
    const rows = records.map((r) => [
      r.species, model, r.result, r.result === 'positive' ? 1 : 0, r.score, r.date, r.time, r.site, r.recording,
      r.start, r.end, r.segment, r.file, r.folder, ...extras.map((h) => r.extra[h]),
    ]);
    return toCsv(header, rows, format);
  }

  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes) {
    let c = ~0;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return ~c >>> 0;
  }

  // A PNG says nothing about its resolution unless told, and journals check it
  function pngWithDpi(png, dpi) {
    const ppm = Math.round(dpi / 0.0254), chunk = new Uint8Array(21), v = new DataView(chunk.buffer);
    v.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4);                         // "pHYs"
    v.setUint32(8, ppm); v.setUint32(12, ppm); chunk[16] = 1;
    v.setUint32(17, crc32(chunk.subarray(4, 17)));
    const out = new Uint8Array(png.length + 21);                    // right after the signature and the header chunk
    out.set(png.subarray(0, 33)); out.set(chunk, 33); out.set(png.subarray(33), 54);
    return out;
  }

  // A ZIP without compression: PNGs are compressed already
  function zipStore(files) {
    const enc = new TextEncoder(), bytes = (fields) => {
      const out = new Uint8Array(fields.reduce((n, [, size]) => n + size, 0)), v = new DataView(out.buffer);
      let at = 0;
      for (const [value, size] of fields) { size === 2 ? v.setUint16(at, value, true) : v.setUint32(at, value, true); at += size; }
      return out;
    };
    const parts = [], central = [];
    let offset = 0;
    for (const { name, data } of files) {
      const n = enc.encode(name), crc = crc32(data);
      const common = [[0x0800, 2], [0, 2], [0, 2], [0x21, 2], [crc, 4], [data.length, 4], [data.length, 4], [n.length, 2], [0, 2]];
      parts.push(bytes([[0x04034b50, 4], [20, 2], ...common]), n, data);
      central.push(bytes([[0x02014b50, 4], [20, 2], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]), n);
      offset += 30 + n.length + data.length;
    }
    const size = central.reduce((a, c) => a + c.length, 0);
    const end = bytes([[0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [size, 4], [offset, 4], [0, 2]]);
    const out = new Uint8Array(offset + size + end.length);
    let at = 0;
    for (const p of [...parts, ...central, end]) { out.set(p, at); at += p.length; }
    return out;
  }

  return {
    AUDIO, parseClip, clipDetails, readFolder, groupsFromTree, recordsFromFolders,
    decodeText, parseDelimited, tableFrom, guessColumns, classifyResult, toScore, cellText, recordsFromTable, normal,
    sigmoid, logit, toX, fitLogistic, probAt, scoreAt, readMark, curve, analyse, notes, minOf, maxOf, precisionTable,
    toCsv, dataCsv, DATA_COLUMNS, crc32, pngWithDpi, zipStore,
  };
})();
