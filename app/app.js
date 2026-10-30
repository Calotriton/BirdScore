// The page: what the user picks and what BirdScore shows. The logic is in core.js, the drawing in plot.js.
(() => {
  const { t, tn, tIn, num, numIn, getLang, setLang, applyLang } = I18n;
  const Core = BirdScoreCore, Plot = BirdScorePlot;
  const $ = (id) => document.getElementById(id);
  const h = (tag, props = {}, ...kids) => { const el = Object.assign(document.createElement(tag), props); el.append(...kids); return el; };
  const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const parseDecimal = (s) => { const v = String(s).trim().replace(',', '.'); return v === '' ? NaN : Number(v); };

  const PRESET_TARGETS = [0.85, 0.9, 0.95, 0.99];
  const settings = {
    source: 'folders', model: '', targets: [0.9], scores: [], layout: 'separate', rows: '', cols: '',
    figureTitle: '', figureSubtitle: '', titles: {}, italic: true, titleAlign: 'left',
    showCounts: true, legendPoints: true, legendCurve: true, legendBand: true, legendThreshold: true, legendObserved: true,
    xLabel: 'Confidence score', yLabel: 'True positive rate',       // English by default in every language, by the owner's choice
    jitter: true, jitterAmount: 0.6, colourBlind: false, plotLang: getLang(), scale: 'logit', band: true, observed: false,
    format: 'png', dpi: 300, csvFormat: 'comma',
    ...load('birdscore.settings', {}),
  };
  const state = {
    species: [], table: null, tableResult: null, restored: null,   // the data being prepared
    records: null, analyses: null, view: [], figures: [], stale: false,   // the last result
    pick: null,
  };
  const saveSettings = () => save('birdscore.settings', settings);
  let nextId = 1;
  const newRow = (name = '', pos = null, neg = null) => ({ id: nextId++, name, pos, neg });
  const hasContent = (r) => r.name || r.pos || r.neg;

  // ── Theme and language ───────────────────────────────────────────────────────────────────────────────
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => document.documentElement.dataset.theme === 'dark' || (systemDark.matches && document.documentElement.dataset.theme !== 'light');
  function labelTheme() {
    const label = isDark() ? t('Day mode') : t('Night mode');
    $('theme').setAttribute('aria-label', label);
    $('theme').title = label;
  }
  $('theme').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark', differs = (next === 'dark') !== systemDark.matches;
    if (differs) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
    try { if (differs) localStorage.setItem('birdscore.theme', next); else localStorage.removeItem('birdscore.theme'); } catch { /* storage blocked */ }
    labelTheme();
  });
  systemDark.addEventListener('change', labelTheme);

  $('lang').addEventListener('change', (e) => {
    setLang(e.target.value);
    settings.plotLang = getLang();       // this menu changes the site and the plot; the plot's own menu can differ
    $('plot-lang').value = settings.plotLang;
    saveSettings();
    labelTheme();
    renderChips(); renderSpecies(); renderTableSetup(); renderTitles(); updateGenerate(); drawResults();
  });

  // ── Folders ──────────────────────────────────────────────────────────────────────────────────────────
  const REASON = { no_score: 'no score at the start of the name', score_range: 'the first number is above 1', not_audio: 'not an audio file' };
  const looksSwapped = (kind, folder) => (kind === 'pos' ? /neg|false|falso|^fp$/i : /pos|true|verdad|^tp$/i).test(folder);

  function fillSlot(box, part, kind) {
    box.replaceChildren();
    if (!part) { box.append(h('p', { className: 'hint', textContent: t('No folder yet') })); return; }
    if (part.clips.length) {
      const scores = part.clips.map((c) => c.score);
      box.append(h('p', { className: 'slot-count', textContent: tn(part.clips.length, '{n} clip, score {lo}', '{n} clips, scores {lo} to {hi}', { lo: num(Core.minOf(scores), 3), hi: num(Core.maxOf(scores), 3) }) }));
    } else box.append(h('p', { className: 'warn', textContent: t('No clips with a score in this folder.') }));
    box.append(h('p', { className: 'hint', textContent: part.folder }));
    if (looksSwapped(kind, part.folder)) {
      box.append(h('p', { className: 'warn', textContent: t('Check this one: the folder is called “{folder}”.', { folder: part.folder }) }));
    }
    if (part.skipped.length) {
      const list = h('ul', {}, ...part.skipped.slice(0, 200).map((s) => h('li', { textContent: `${s.file}: ${t(REASON[s.reason])}` })));
      box.append(h('details', { className: 'issue' }, h('summary', { textContent: tn(part.skipped.length, '{n} file not used', '{n} files not used') }), list));
    }
  }

  function rowElement(row) {
    const el = $('species-template').content.firstElementChild.cloneNode(true);
    el.dataset.id = row.id;
    applyLang(el);
    const name = el.querySelector('.species-name');
    name.value = row.name;
    name.addEventListener('input', () => {
      row.name = name.value.trim();
      name.removeAttribute('aria-invalid');
      el.querySelector('.name-error').hidden = true;
      dataChanged();
    });
    el.querySelector('.remove').hidden = state.species.length === 1 && !hasContent(row);
    el.querySelector('.remove').addEventListener('click', () => {
      state.species = state.species.filter((r) => r !== row);
      if (!state.species.length) state.species.push(newRow());
      renderSpecies();
      dataChanged();
      $('add-species').focus();
    });
    for (const slot of el.querySelectorAll('.slot')) {
      const kind = slot.dataset.part;
      slot.querySelector('.browse').addEventListener('click', () => { state.pick = { row, kind }; $('folder-input').click(); });
      fillSlot(slot.querySelector('.slot-state'), row[kind], kind);
    }
    return el;
  }
  const renderSpecies = () => $('species-list').replaceChildren(...state.species.map(rowElement));

  $('folder-input').addEventListener('change', (e) => {
    const { row, kind } = state.pick ?? {};
    if (row && e.target.files.length) {
      row[kind] = Core.readFolder([...e.target.files]);
      renderSpecies();
      dataChanged();
      document.querySelector(`.species-row[data-id="${row.id}"] .slot[data-part="${kind}"] .browse`)?.focus();
    }
    e.target.value = '';
  });
  $('add-species').addEventListener('click', () => {
    const row = newRow();
    state.species.push(row);
    renderSpecies();
    document.querySelector(`.species-row[data-id="${row.id}"] .species-name`)?.focus();
  });
  $('add-tree').addEventListener('click', () => $('tree-input').click());
  $('tree-input').addEventListener('change', (e) => {
    const groups = Core.groupsFromTree([...e.target.files]);
    $('tree-error').hidden = groups.size > 0;
    $('tree-error').textContent = groups.size ? '' : t('No folders named Positive or Negative were found inside that folder.');
    if (groups.size) {
      state.species = state.species.filter(hasContent);
      for (const [name, g] of groups) {
        const row = state.species.find((r) => r.name === name) ?? state.species[state.species.push(newRow(name)) - 1];
        for (const kind of ['pos', 'neg']) {
          if (g[kind].length) row[kind] = { ...Core.readFolder(g[kind]), folder: g.folders[kind] };
        }
      }
      renderSpecies();
      dataChanged();
    }
    e.target.value = '';
  });

  // ── Excel and CSV ────────────────────────────────────────────────────────────────────────────────────
  const loadExcelReader = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(); return; }
    document.head.append(h('script', { src: 'vendor/xlsx.full.min.js', onload: resolve, onerror: reject }));
  });
  const showTableError = (message) => { $('table-error').hidden = !message; $('table-error').textContent = message; };

  async function openTable(file) {
    showTableError('');
    $('table-name').textContent = t('Reading {file}…', { file: file.name });
    try {
      const buffer = await file.arrayBuffer();
      let sheets;
      if (/\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(file.name)) {
        await loadExcelReader();
        // shortcut: read on the main thread, so a very large workbook freezes the page for a moment; use a worker if that hurts
        const book = XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
        sheets = book.SheetNames.map((name) => ({
          name, table: Core.tableFrom(XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: true, defval: '', UTC: true })),
        }));
      } else {
        sheets = [{ name: '', table: Core.tableFrom(Core.parseDelimited(Core.decodeText(buffer))) }];
      }
      const first = sheets.findIndex((s) => s.table.rows.length);
      if (first < 0) throw new Error('empty');
      state.table = { file: file.name, sheets, sheet: first, map: Core.guessColumns(sheets[first].table.headers), values: {}, fixedSpecies: '' };
      state.restored = null;
    } catch {
      state.table = null;
      showTableError(t('{file} could not be read as a table. Save it as .xlsx or .csv, with column names in the first row, and try again.', { file: file.name }));
    }
    renderTableSetup();
    renderTitles();
    dataChanged();
  }

  function renderTableSetup() {
    const table = state.table;
    $('table-setup').hidden = !table;
    $('table-hint').hidden = !!table;
    $('table-name').textContent = table ? table.file : state.restored?.file ? t('{file} (last used)', { file: state.restored.file }) : '';
    if (!table) { state.tableResult = null; return; }
    const sheet = table.sheets[table.sheet], headers = sheet.table.headers;
    $('sheet-field').hidden = table.sheets.length < 2;
    $('sheet').replaceChildren(...table.sheets.map((s, i) => h('option', { value: i, textContent: s.name })));
    $('sheet').value = table.sheet;
    const preview = sheet.table.rows.slice(0, 5);
    $('table-preview').replaceChildren(
      h('thead', {}, h('tr', {}, ...headers.map((name) => h('th', { scope: 'col', textContent: name, title: name })))),
      h('tbody', {}, ...preview.map((row) => h('tr', {}, ...headers.map((_, i) => h('td', { textContent: Core.cellText(row[i]), title: Core.cellText(row[i]) }))))),
    );
    for (const select of $('columns').querySelectorAll('select')) {
      const role = select.dataset.role;
      const none = role === 'species' ? t('All rows are one species') : role === 'score' || role === 'result' ? t('Choose a column') : t('Not in this file');
      select.replaceChildren(h('option', { value: -1, textContent: none }), ...headers.map((name, i) => h('option', { value: i, textContent: name })));
      select.value = table.map[role];
    }
    $('fixed-species').value = table.fixedSpecies;
    $('fixed-species-field').hidden = table.map.species >= 0;
    readTable();
    renderValues();
    tableStatus();
  }

  const readTable = () => {
    const table = state.table;
    state.tableResult = Core.recordsFromTable(table.sheets[table.sheet].table, table.map, table.values, table.fixedSpecies);
  };

  function renderValues() {
    const seen = [...state.tableResult.values.entries()], table = state.table;
    $('values').hidden = !seen.length;
    if (seen.length > 12) {
      $('value-list').replaceChildren(h('li', { className: 'warn', textContent: t('This column has {n} different values. Check that it is the one that says positive or negative.', { n: num(seen.length) }) }));
      return;
    }
    $('value-list').replaceChildren(...seen.map(([key, v]) => {
      const select = h('select', { ariaLabel: t('Meaning of {value}', { value: v.label }) },
        ...['positive', 'negative', 'ignore'].map((value) => h('option', { value, textContent: t({ positive: 'Positive', negative: 'Negative', ignore: 'Ignore' }[value]) })));
      select.value = table.values[key] ?? v.auto ?? 'ignore';
      select.addEventListener('change', () => { table.values[key] = select.value; readTable(); tableStatus(); renderTitles(); dataChanged(); });
      return h('li', {}, h('span', { className: 'value' }, v.label, h('small', { textContent: tn(v.count, '{n} row', '{n} rows') })), select);
    }));
  }

  function tableStatus() {
    const { records, skipped } = state.tableResult;
    const pos = records.filter((r) => r.result === 'positive').length, neg = records.length - pos;
    const unused = skipped.no_species + skipped.no_score + skipped.no_result + skipped.ignored;
    $('table-status').replaceChildren(tn(records.length, '{n} detection: {pos} positive, {neg} negative.', '{n} detections: {pos} positive, {neg} negative.', { pos: num(pos), neg: num(neg) }));
    if (unused) {
      const why = { a: num(skipped.no_species), b: num(skipped.no_score), c: num(skipped.no_result), d: num(skipped.ignored) };
      $('table-status').append(h('small', { textContent: tn(unused, '{n} row not used: {a} without a species, {b} without a score from 0 to 1, {c} without a result, {d} set to Ignore.', '{n} rows not used: {a} without a species, {b} without a score from 0 to 1, {c} without a result, {d} set to Ignore.', why) }));
    }
  }

  $('choose-table').addEventListener('click', () => $('table-input').click());
  $('table-input').addEventListener('change', (e) => { if (e.target.files[0]) openTable(e.target.files[0]); e.target.value = ''; });
  $('sheet').addEventListener('change', (e) => {
    const table = state.table;
    table.sheet = +e.target.value;
    table.map = Core.guessColumns(table.sheets[table.sheet].table.headers);
    table.values = {};
    renderTableSetup(); renderTitles(); dataChanged();
  });
  $('columns').addEventListener('change', (e) => {
    if (e.target.tagName !== 'SELECT') return;
    const role = e.target.dataset.role;
    state.table.map[role] = +e.target.value;
    if (role === 'result') state.table.values = {};
    $('fixed-species-field').hidden = state.table.map.species >= 0;
    readTable(); renderValues(); tableStatus(); renderTitles(); dataChanged();
  });
  $('fixed-species').addEventListener('input', (e) => {
    state.table.fixedSpecies = e.target.value;
    readTable(); tableStatus(); renderTitles(); dataChanged();
  });

  // ── Source of the data ───────────────────────────────────────────────────────────────────────────────
  function setSource(source) {
    settings.source = source;
    $('from-folders').hidden = source !== 'folders';
    $('from-table').hidden = source !== 'table';
    document.querySelector(`input[name="source"][value="${source}"]`).checked = true;
    saveSettings();
  }
  document.querySelectorAll('input[name="source"]').forEach((input) => input.addEventListener('change', () => {
    setSource(input.value); renderTitles(); dataChanged();
  }));

  const pendingRecords = () => {
    if (settings.source === 'folders') return Core.recordsFromFolders(state.species.filter((r) => r.pos?.clips.length || r.neg?.clips.length));
    return state.tableResult?.records ?? state.restored?.records ?? [];
  };
  const pendingNames = () => {
    if (settings.source === 'folders') return [...new Set(state.species.map((r) => r.name).filter(Boolean))];
    return [...new Set((state.tableResult?.records ?? state.restored?.records ?? []).map((r) => r.species))];
  };
  function updateGenerate() {
    const usable = pendingRecords().length > 0;
    $('generate').disabled = !usable;
    $('generate-hint').textContent = usable ? '' : settings.source === 'folders' ? t('Add the Positive and Negative folders of at least one species.') : t('Choose a file and its columns first.');
    $('start-over').hidden = !state.species.some(hasContent) && !state.table && !state.restored && !state.analyses;
  }
  function dataChanged() {
    if (state.analyses) {
      state.stale = true;
      $('stale').hidden = false;
      $('results').classList.add('is-stale');
    }
    updateGenerate();
    renderTitles();
    saveProject();
  }

  // ── Settings ─────────────────────────────────────────────────────────────────────────────────────────
  let drawQueued = false;
  function settingsChanged() {
    saveSettings();
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; drawResults(); });
  }
  const bind = (id, key, read = (el) => el.value) => {
    const el = $(id);
    if (el.type === 'checkbox') el.checked = settings[key]; else el.value = settings[key];
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => { settings[key] = read(el); settingsChanged(); });
  };
  const checked = (el) => el.checked;

  function chip(value, pressed, onClick) {
    const b = h('button', { type: 'button', className: 'chip', textContent: num(value, 2, 3) });
    b.dataset.value = value;
    b.setAttribute('aria-pressed', pressed);
    b.addEventListener('click', onClick);
    return b;
  }
  function renderChips() {
    const toggle = (list, v) => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); };
    const box = $('target-chips'), scoreBox = $('score-chips');
    const targets = [...new Set([...PRESET_TARGETS, ...settings.targets])].sort((a, b) => a - b);
    box.replaceChildren(...targets.map((v) => chip(v, settings.targets.includes(v), () => {
      toggle(settings.targets, v);
      settingsChanged(); renderChips();
      (box.querySelector(`[data-value="${v}"]`) ?? $('target-new')).focus();
    })));
    scoreBox.replaceChildren(...[...settings.scores].sort((a, b) => a - b).map((v) => chip(v, true, () => {
      toggle(settings.scores, v);
      settingsChanged(); renderChips();
      $('score-new').focus();
    })));
  }
  function addValue(inputId, errorId, list, valid, message) {
    const input = $(inputId), error = $(errorId), v = parseDecimal(input.value);
    const ok = valid(v);
    error.hidden = ok;
    error.textContent = ok ? '' : t(message);
    input.setAttribute('aria-invalid', String(!ok));
    if (!ok) return;
    if (!list.includes(v)) list.push(v);
    input.value = '';
    settingsChanged(); renderChips();
  }
  const addTarget = () => addValue('target-new', 'target-error', settings.targets, (v) => v > 0 && v < 1, 'Write a probability above 0 and below 1, for example 0.97.');
  const addScore = () => addValue('score-new', 'score-error', settings.scores, (v) => v >= 0 && v <= 1, 'Write a score from 0 to 1, for example 0.50.');
  $('target-add').addEventListener('click', addTarget);
  $('score-add').addEventListener('click', addScore);
  $('target-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTarget(); });
  $('score-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') addScore(); });

  const speciesLabel = (name) => name.replace(/_/g, ' ');
  const titleOf = (name) => settings.titles[name]?.title || speciesLabel(name);
  const subtitleOf = (name) => settings.titles[name]?.subtitle || '';

  function renderTitles() {
    const names = pendingNames();
    $('title-empty').hidden = names.length > 0;
    $('figure-titles').hidden = settings.layout !== 'grid';
    const field = (labelKey, value, placeholder, onInput) => {
      const input = h('input', { type: 'text', autocomplete: 'off', value, placeholder });
      input.addEventListener('input', () => onInput(input.value));
      return h('label', { className: 'field' }, h('span', { className: 'label', textContent: t(labelKey) }), input);
    };
    const set = (name, key, value) => { settings.titles[name] = { ...settings.titles[name], [key]: value }; settingsChanged(); };
    $('title-list').replaceChildren(...names.map((name) => h('li', {},
      field('Title', settings.titles[name]?.title ?? '', speciesLabel(name), (v) => set(name, 'title', v)),
      field('Subtitle', settings.titles[name]?.subtitle ?? '', t('Optional'), (v) => set(name, 'subtitle', v)),
    )));
    const n = Math.max(names.length, 1), size = gridSize(n);
    $('rows').placeholder = Math.ceil(n / size.auto);
    $('cols').placeholder = size.auto;
  }

  function gridSize(n) {
    const wantCols = +settings.cols || 0, wantRows = +settings.rows || 0;
    const auto = n <= 3 ? n : n === 4 ? 2 : 3;
    const cols = wantCols || (wantRows ? Math.ceil(n / wantRows) : auto);
    return { cols, rows: Math.max(wantRows, Math.ceil(n / cols)), auto, tooSmall: wantRows > 0 && wantRows < Math.ceil(n / cols) };
  }

  // ── Generate ─────────────────────────────────────────────────────────────────────────────────────────
  function namesAreValid() {
    let first = null;
    const seen = new Set();
    for (const row of state.species) {
      if (!row.pos && !row.neg) continue;
      const el = document.querySelector(`.species-row[data-id="${row.id}"]`);
      const message = !row.name ? t('Write the species name.') : seen.has(row.name) ? t('Another row already has this name.') : '';
      seen.add(row.name);
      const error = el.querySelector('.name-error'), input = el.querySelector('.species-name');
      error.hidden = !message;
      error.textContent = message;
      input.setAttribute('aria-invalid', String(!!message));
      if (message) first ??= input;
    }
    first?.focus();
    return !first;
  }

  function generate({ quiet = false } = {}) {
    if (settings.source === 'folders' && !namesAreValid()) return;
    const records = pendingRecords();
    if (!records.length) return;
    state.records = records;
    state.analyses = Core.analyse(records);
    state.stale = false;
    $('stale').hidden = true;
    $('results').classList.remove('is-stale');
    $('placeholder').hidden = true;
    $('results').hidden = false;
    drawResults();
    saveProject();
    updateGenerate();
    if (quiet) return;
    $('announce').textContent = tn(state.analyses.length, 'Plots ready: one species, {m} clips.', 'Plots ready: {n} species, {m} clips.', { m: num(records.length) });
    $('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    $('results').focus({ preventScroll: true });
  }
  $('generate').addEventListener('click', () => generate());

  const activeMarks = () => [
    ...[...settings.targets].sort((a, b) => a - b).map((value) => ({ kind: 'p', value })),
    ...[...settings.scores].sort((a, b) => a - b).map((value) => ({ kind: 'score', value })),
  ];

  const paletteName = () => (settings.colourBlind ? 'colourblind' : 'standard');
  function plotOptions() {
    const lang = settings.plotLang, T = (key) => tIn(lang, key);
    return {
      locale: I18n.localeOf(lang),
      labels: {
        positive: T('Positive'), negative: T('Negative'), curve: T('Logistic regression'), band: T('95% confidence band'),
        threshold: T('Threshold'), observed: T('Observed share of positives'),
        noCurve: T('No curve can be fitted'), figureName: T('Logistic regressions'),
      },
      palette: paletteName(), align: settings.titleAlign,
      show: {
        counts: settings.showCounts, points: settings.legendPoints, curve: settings.legendCurve,
        band: settings.legendBand, threshold: settings.legendThreshold, observed: settings.legendObserved,
      },
      italic: settings.italic, xLabel: settings.xLabel, yLabel: settings.yLabel,
      jitter: settings.jitter ? settings.jitterAmount : 0, band: settings.band, showBands: settings.observed,
      figureTitle: settings.figureTitle, figureSubtitle: settings.figureSubtitle,
    };
  }

  function drawResults() {
    if (!state.analyses) return;
    const scale = settings.scale, marks = activeMarks(), lang = settings.plotLang;
    state.view = state.analyses.map((a) => {
      const fit = a.fits[scale];
      const read = fit && fit.b1 > 0 ? marks.map((m) => Core.readMark(fit, scale, m, a.low, a.high)) : [];
      return {
        a, read,
        panel: {
          species: a.species, title: titleOf(a.species), subtitle: subtitleOf(a.species), seed: a.species,
          counts: [[a.nPos, '1 positive', '{n} positive'], [a.nNeg, '1 negative', '{n} negative']]
            .map(([n, one, other]) => (n === 1 ? tIn(lang, one) : tIn(lang, other, { n: numIn(lang, n) }))).join(' · '),
          clips: a.clips, low: a.low, high: a.high, marks: read, bands: a.bands, fit,
          curve: fit ? Core.curve(fit, scale, a.low, a.high) : null,
        },
      };
    });
    const panels = state.view.map((v) => v.panel), o = plotOptions();
    const grid = settings.layout === 'grid' && panels.length > 1, size = gridSize(panels.length);
    $('grid-size').hidden = settings.layout !== 'grid';
    $('grid-note').hidden = !(grid && size.tooSmall);
    $('grid-note').textContent = grid && size.tooSmall ? t('{n} plots do not fit there, so the image has {rows} rows.', { n: num(panels.length), rows: num(size.rows) }) : '';
    const taken = new Set();
    const unique = (base) => { let name = base, k = 2; while (taken.has(name)) name = `${base}_${k++}`; taken.add(name); return name; };
    const slug = (s) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
    state.figures = grid
      ? [{ name: 'birdscore_all_species', label: t('All species'), ...Plot.figure(panels, { ...o, cols: size.cols, rows: size.rows }) }]
      : panels.map((p) => ({ name: unique(`birdscore_${slug(p.species)}`), label: p.title, ...Plot.figure([p], o) }));
    $('figures').replaceChildren(...state.figures.map(figureElement));
    $('results-summary').textContent = tn(state.analyses.length, 'One species, {m} clips', '{n} species, {m} clips', { m: num(state.records.length) });
    $('download-plots-text').textContent = state.figures.length > 1 ? t('Download all (.zip)') : t('Download plot');
    $('dpi-field').hidden = settings.format !== 'png';
    renderResultsTable(marks);
    renderMethods();
  }

  function figureElement(fig) {
    const canvas = h('div', { className: 'plot-canvas' });
    canvas.innerHTML = fig.svg;       // built by plot.js, which escapes every text
    const button = (format, label) => {
      const b = h('button', { type: 'button', className: 'button small', ariaLabel: t('Download {name} as {format}', { name: fig.label, format: label }) },
        label);
      b.addEventListener('click', () => downloadOne(fig, format));
      return b;
    };
    attachHover(canvas, fig);
    if (state.figures.length === 1) return h('figure', { className: 'plot' }, canvas);     // the download above is the same one
    return h('figure', { className: 'plot' }, canvas,
      h('figcaption', {}, h('span', { className: 'sp', textContent: fig.label }), h('div', { className: 'row-actions' }, button('png', 'PNG'), button('svg', 'SVG'))));
  }

  // The hover layer: a crosshair reads the curve, and a point names its clip. The table holds the same values.
  function attachHover(canvas, fig) {
    const svg = canvas.querySelector('svg'), tip = $('tip'), NS = 'http://www.w3.org/2000/svg';
    const guide = document.createElementNS(NS, 'path'), dot = document.createElementNS(NS, 'circle');
    guide.setAttribute('stroke', Plot.COLOURS.ink); guide.setAttribute('stroke-opacity', '0.45');
    dot.setAttribute('r', '4.5'); dot.setAttribute('fill', Plot.PALETTES[paletteName()].curve); dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '2');
    const layer = document.createElementNS(NS, 'g');
    layer.style.pointerEvents = 'none';
    layer.append(guide, dot);
    layer.setAttribute('visibility', 'hidden');
    svg.append(layer);
    const hide = () => { tip.hidden = true; layer.setAttribute('visibility', 'hidden'); };
    const show = (e, strong, ...lines) => {
      tip.replaceChildren(h('strong', { textContent: strong }), ...lines.map((text) => h('div', { textContent: text })));
      tip.hidden = false;
      const x = e.clientX + 14 + tip.offsetWidth > innerWidth ? e.clientX - tip.offsetWidth - 14 : e.clientX + 14;
      const y = e.clientY + 14 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 14 : e.clientY + 14;
      tip.style.left = `${Math.max(4, x)}px`;
      tip.style.top = `${Math.max(4, y)}px`;
    };
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointermove', (e) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
      const q = fig.panels.find((i) => at.x >= i.x - 6 && at.x <= i.x + i.w + 6 && at.y >= i.y && at.y <= i.y + i.h);
      if (!q) { hide(); return; }
      let near = null, best = 49;       // within 7 units: the pointer only has to be closest, not dead on
      for (const d of q.dots) {
        const dist = (d.x - at.x) ** 2 + (d.y - at.y) ** 2;
        if (dist < best) { best = dist; near = d; }
      }
      if (near) {
        const c = near.clip;
        layer.setAttribute('visibility', 'hidden');
        show(e, num(c.score, 3), t(c.result === 'positive' ? 'Positive' : 'Negative'), ...(c.file ? [c.file] : []));
        return;
      }
      const fit = q.panel.fit, score = (at.x - q.x) / q.w;
      if (!fit || score < q.panel.low || score > q.panel.high) { hide(); return; }     // the curve is only read where it was checked
      const r = Core.probAt(fit, settings.scale, score);
      guide.setAttribute('d', `M${q.X(score)} ${q.y}V${q.y + q.h}`);
      dot.setAttribute('cx', q.X(score)); dot.setAttribute('cy', q.Y(r.p));
      layer.setAttribute('visibility', 'visible');
      show(e, `p = ${num(r.p, 2)}`, t('95% CI {lo} to {hi}', { lo: num(r.lo, 2), hi: num(r.hi, 2) }), t('Score {score}', { score: num(score, 2) }));
    });
  }

  // ── Table, notes, method ─────────────────────────────────────────────────────────────────────────────
  function noteText(n) {
    const d3 = (v) => num(v, 3);
    switch (n.code) {
      case 'no_negative': return t('There are no negative clips, so no curve can be fitted.');
      case 'no_positive': return t('There are no positive clips, so no curve can be fitted.');
      case 'no_spread': return t('All clips have the same score, so no curve can be fitted.');
      case 'separated': return t('Positive and negative clips do not overlap, so no curve can be fitted: every negative scores {lo} or less and every positive {hi} or more.', { lo: d3(n.lo), hi: d3(n.hi) });
      case 'reversed': return t('Every negative clip scores higher than every positive clip, so no curve can be fitted. Check that the folders or values are not swapped.');
      case 'few': return n.kind === 'negative'
        ? tn(n.n, 'Only {n} negative clip: the curve is very uncertain.', 'Only {n} negative clips: the curve is very uncertain.')
        : tn(n.n, 'Only {n} positive clip: the curve is very uncertain.', 'Only {n} positive clips: the curve is very uncertain.');
      case 'slope': return t('Higher scores are not more often correct here, so no threshold is given. Check that the folders or values are not swapped.');
      case 'unreached': return t('A probability of {p} is not reached at any score from 0 to 1.', { p: num(n.p, 2, 3) });
      case 'outside': return n.kind === 'p'
        ? t('The threshold for a probability of {value} lies outside the scores you checked ({low} to {high}), so it is an extrapolation and is not drawn.', { value: num(n.value, 2, 3), low: d3(n.low), high: d3(n.high) })
        : t('The score {value} lies outside the scores you checked ({low} to {high}), so its probability is an extrapolation and it is not drawn.', { value: num(n.value, 2, 3), low: d3(n.low), high: d3(n.high) });
      case 'confounded_year': return t('Most positive clips are from {pos} and most negative clips from {neg}, so the curve cannot separate the effect of the score from that of the year.', n);
      case 'confounded_site': return t('Most positive clips are from {pos} and most negative clips from {neg}, so the curve cannot separate the effect of the score from that of the site or recorder.', n);
      case 'sampled': return t('The plot shows a sample of {n} points per group. The regression uses every clip.', { n: num(Plot.MAX_POINTS) });
      default: return n.code;
    }
  }
  function viewNotes(v) {
    const list = Core.notes(v.a, settings.scale, v.read);
    if (Math.max(v.a.nPos, v.a.nNeg) > Plot.MAX_POINTS) list.push({ code: 'sampled' });
    return list;
  }

  const markHead = (m) => (m.kind === 'p' ? t('Score for p = {v}', { v: num(m.value, 2, 3) }) : t('p at score {v}', { v: num(m.value, 2, 3) }));
  function markCell(m) {
    if (!m.reachable) return t('not reached');
    const main = num(m.kind === 'p' ? m.score : m.p, 2);
    return m.ci ? `${main} (${num(m.ci[0], 2)}–${num(m.ci[1], 2)})` : `${main} (${t('no limit')})`;
  }

  function renderResultsTable(marks) {
    const heads = [t('Species'), t('Positive'), t('Negative'), t('Recordings'), ...marks.map(markHead)];
    $('results-table').replaceChildren(
      h('thead', {}, h('tr', {}, ...heads.map((text) => h('th', { scope: 'col', textContent: text })))),
      h('tbody', {}, ...state.view.map((v) => h('tr', {},
        h('td', { textContent: speciesLabel(v.a.species) }),
        h('td', { textContent: num(v.a.nPos) }), h('td', { textContent: num(v.a.nNeg) }),
        h('td', { textContent: v.a.recordings ? num(v.a.recordings) : '–' }),
        ...marks.map((_, i) => h('td', { textContent: v.read[i] ? markCell(v.read[i]) : '–' })),
      ))),
    );
    const blocks = [];
    if (marks.length) blocks.push(h('p', { className: 'hint', textContent: t('In brackets, the 95% confidence interval.') }));
    for (const v of state.view) {
      const list = viewNotes(v);
      if (!list.length) continue;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<use href="#i-warn"/>';
      blocks.push(h('div', { className: 'note' }, icon, h('div', {},
        h('span', { className: 'sp', textContent: speciesLabel(v.a.species) }),
        h('ul', {}, ...list.map((n) => h('li', { textContent: noteText(n) }))))));
    }
    $('notes').replaceChildren(...blocks);
  }

  function renderMethods() {
    const box = $('methods');
    box.replaceChildren(...[
      settings.scale === 'logit'
        ? t('BirdScore fits one logistic regression per species by maximum likelihood, with no penalty: p = 1 / (1 + exp(−(b0 + b1 · x))), where p is the probability that a detection is correct and x is the logit of the confidence score, log(s / (1 − s)), as in Wood and Kahl (2024). Scores of exactly 0 or 1 count as 0.000001 and 0.999999.')
        : t('BirdScore fits one logistic regression per species by maximum likelihood, with no penalty: p = 1 / (1 + exp(−(b0 + b1 · x))), where p is the probability that a detection is correct and x is the confidence score itself.'),
      t('The band is the 95% Wald interval, computed on the logit scale. A threshold is the score at which the curve reaches the chosen probability, and its interval runs between the scores at which the band reaches it. Both treat clips as independent. Clips from one recording or night often are not, so the real uncertainty can be larger.'),
      t('The curve describes the detections you checked: this species, this model and these recordings. It is drawn only across the scores you checked. It estimates how often a detection at a given score is correct, which is a kind of precision. It says nothing about the calls the model missed (recall), which statisticians usually call the true positive rate.'),
    ].map((text) => h('p', { className: 'prose', textContent: text })));
    const link = h('a', { href: 'https://doi.org/10.1007/s10336-024-02144-5', textContent: 'doi:10.1007/s10336-024-02144-5' });
    box.append(h('p', { className: 'prose hint' }, 'Wood CM, Kahl S (2024). Guidelines for appropriate use of BirdNET scores and other detector outputs. Journal of Ornithology. ', link));
  }

  // ── Downloads ────────────────────────────────────────────────────────────────────────────────────────
  function saveFile(parts, type, name) {
    const url = URL.createObjectURL(new Blob(parts, { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function figureBytes(fig, format) {
    if (format === 'svg') return new TextEncoder().encode(fig.svg);
    const dpi = +settings.dpi, zoom = dpi / 96;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fig.svg)}`;
    await image.decode();
    const canvas = h('canvas', { width: Math.round(fig.width * zoom), height: Math.round(fig.height * zoom) });
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('too large');
    return Core.pngWithDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  }
  const MIME = { png: 'image/png', svg: 'image/svg+xml' };
  async function downloadOne(fig, format) {
    const status = $('download-status');
    try {
      status.textContent = t('Preparing the image…');
      saveFile([await figureBytes(fig, format)], MIME[format], `${fig.name}.${format}`);
      status.textContent = '';
    } catch {
      status.textContent = t('The image is too large at this resolution. Choose a lower one.');
    }
  }
  $('download-plots').addEventListener('click', async () => {
    const format = settings.format, status = $('download-status');
    if (state.figures.length === 1) { downloadOne(state.figures[0], format); return; }
    try {
      status.textContent = t('Preparing the images…');
      const files = [];
      for (const fig of state.figures) files.push({ name: `${fig.name}.${format}`, data: await figureBytes(fig, format) });
      saveFile([Core.zipStore(files)], 'application/zip', 'birdscore_plots.zip');
      status.textContent = '';
    } catch {
      status.textContent = t('The image is too large at this resolution. Choose a lower one.');
    }
  });
  $('download-data').addEventListener('click', () => {
    saveFile([Core.dataCsv(state.records, settings.model, settings.csvFormat)], 'text/csv;charset=utf-8', 'birdscore_detections.csv');
  });

  function resultsCsv() {
    const marks = activeMarks(), label = (m) => (m.kind === 'p' ? `score_at_p_${m.value}` : `p_at_score_${m.value}`);
    const round = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
    const header = ['species', 'model', 'score_scale', 'clips', 'positive', 'negative', 'recordings', 'lowest_score', 'highest_score',
      'intercept', 'slope', 'aic_logit', 'aic_raw', ...marks.flatMap((m) => [label(m), `${label(m)}_ci_low`, `${label(m)}_ci_high`]), 'notes'];
    const rows = state.view.map((v) => {
      const a = v.a, fit = a.fits[settings.scale];
      return [a.species, settings.model, settings.scale, a.clips.length, a.nPos, a.nNeg, a.recordings || null, round(a.low), round(a.high),
        round(fit?.b0), round(fit?.b1), round(a.fits.logit?.aic), round(a.fits.raw?.aic),
        ...marks.flatMap((_, i) => {
          const m = v.read[i];
          if (!m || !m.reachable) return [null, null, null];
          return [round(m.kind === 'p' ? m.score : m.p), round(m.ci?.[0]), round(m.ci?.[1])];
        }),
        viewNotes(v).map(noteText).join(' | ')];
    });
    return Core.toCsv(header, rows, settings.csvFormat);
  }
  $('download-results').addEventListener('click', () => {
    saveFile([resultsCsv()], 'text/csv;charset=utf-8', 'birdscore_thresholds.csv');
  });

  // ── Saving the project, so the last plots are there next time ────────────────────────────────────────
  function saveProject() {
    const forget = () => { try { localStorage.removeItem('birdscore.project'); } catch { /* storage blocked */ } };
    if (pendingRecords().length > 25000) { forget(); return; }     // far beyond what the browser's small store can hold
    const generated = !!state.analyses && !state.stale;
    const project = settings.source === 'folders'
      ? { species: state.species.filter(hasContent).map(({ name, pos, neg }) => ({ name, pos, neg })), generated }
      : { file: state.table?.file ?? state.restored?.file, records: state.tableResult?.records ?? state.restored?.records ?? [], generated };
    if (!save('birdscore.project', project)) forget();
  }
  function restoreProject() {
    const project = load('birdscore.project', null);
    if (!project) return false;
    if (project.species) state.species = project.species.map((r) => newRow(r.name, r.pos, r.neg));
    if (project.records?.length) state.restored = { file: project.file, records: project.records };
    return !!project.generated;
  }

  const ask = $('ask');
  $('start-over').addEventListener('click', () => ask.showModal());
  $('ask-keep').addEventListener('click', () => ask.close());
  $('ask-remove').addEventListener('click', () => {
    ask.close();
    Object.assign(state, { species: [newRow()], table: null, tableResult: null, restored: null, records: null, analyses: null, view: [], figures: [], stale: false });
    $('results').hidden = true;
    $('results').classList.remove('is-stale');
    $('stale').hidden = true;
    $('placeholder').hidden = false;
    $('figures').replaceChildren();
    showTableError('');
    renderSpecies(); renderTableSetup(); renderTitles(); updateGenerate(); saveProject();
    $('add-species').focus();
  });

  // ── Start ────────────────────────────────────────────────────────────────────────────────────────────
  applyLang();
  $('lang').value = getLang();
  labelTheme();
  bind('model', 'model');
  bind('rows', 'rows');
  bind('cols', 'cols');
  bind('figure-title', 'figureTitle');
  bind('figure-subtitle', 'figureSubtitle');
  bind('italic', 'italic', checked);
  bind('show-counts', 'showCounts', checked);
  bind('legend-points', 'legendPoints', checked);
  bind('legend-curve', 'legendCurve', checked);
  bind('legend-band', 'legendBand', checked);
  bind('legend-threshold', 'legendThreshold', checked);
  bind('legend-observed', 'legendObserved', checked);
  bind('colour-blind', 'colourBlind', checked);
  bind('x-label', 'xLabel');
  bind('y-label', 'yLabel');
  bind('jitter', 'jitter', checked);
  bind('jitter-amount', 'jitterAmount', (el) => +el.value);
  bind('plot-lang', 'plotLang');
  bind('scale', 'scale');
  bind('band', 'band', checked);
  bind('observed', 'observed', checked);
  bind('format', 'format');
  bind('dpi', 'dpi', (el) => +el.value);
  bind('csv-format', 'csvFormat');
  $('jitter').addEventListener('change', () => { $('jitter-field').hidden = !settings.jitter; });
  $('jitter-field').hidden = !settings.jitter;
  const syncLegendSwitches = () => {           // no switch for a legend entry whose mark is not drawn
    $('legend-band-field').hidden = !settings.band;
    $('legend-observed-field').hidden = !settings.observed;
  };
  $('band').addEventListener('change', syncLegendSwitches);
  $('observed').addEventListener('change', syncLegendSwitches);
  syncLegendSwitches();
  document.querySelectorAll('input[name="title-align"]').forEach((input) => {
    input.checked = input.value === settings.titleAlign;
    input.addEventListener('change', () => { settings.titleAlign = input.value; settingsChanged(); });
  });
  document.querySelectorAll('input[name="layout"]').forEach((input) => {
    input.checked = input.value === settings.layout;
    input.addEventListener('change', () => { settings.layout = input.value; renderTitles(); $('grid-size').hidden = settings.layout !== 'grid'; settingsChanged(); });
  });
  $('grid-size').hidden = settings.layout !== 'grid';

  let generated = false;
  try { generated = restoreProject(); } catch { try { localStorage.removeItem('birdscore.project'); } catch { /* storage blocked */ } }
  if (!state.species.length) state.species.push(newRow());
  setSource(settings.source);
  renderChips();
  renderSpecies();
  renderTableSetup();
  renderTitles();
  updateGenerate();
  if (generated) generate({ quiet: true });
})();
