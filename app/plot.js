// The figure, built as one SVG string: what the page shows is exactly what the files hold.
// It is always drawn on white, because it is a figure for a report, whatever the page's theme.
const BirdScorePlot = (() => {
  const C = {
    ink: '#13201d', ink2: '#4f5d59', tick: '#5d6b67', grid: '#e7ecea', axis: '#a7b2af', surface: '#ffffff',
    pos: '#0d9488', neg: '#c2410c', curve: '#115e59', mark: '#5d6b67',
  };
  const FONT = "'Segoe UI Variable Text','Segoe UI',system-ui,-apple-system,Roboto,'Helvetica Neue',Arial,sans-serif";
  const YMIN = -0.08, YMAX = 1.08, JITTER = 0.06, TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const MAX_POINTS = 5000;   // per group; beyond this an SVG gets too heavy to draw, and the fit still uses every clip
  const BIG = { w: 660, h: 380, left: 64, gap: 0, right: 28, title: 21, sub: 14, counts: 12.5, tick: 12.5, axis: 13.5, mark: 12, r: 2.7, legend: 12.5 };
  const SMALL = { w: 330, h: 220, left: 54, gap: 30, right: 20, title: 14.5, sub: 11.5, counts: 11, tick: 11, axis: 12, mark: 10.5, r: 2.1, legend: 12 };

  const r1 = (v) => Math.round(v * 10) / 10;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ctx = document.createElement('canvas').getContext('2d');
  const widthOf = (s, size, weight = 400, italic = false) => {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
    return ctx.measureText(s).width;
  };

  // A long title shrinks a little, then is cut, rather than running off the figure
  function fitText(s, maxWidth, size, weight, italic) {
    let text = s, at = size;
    while (widthOf(text, at, weight, italic) > maxWidth && at > size * 0.75) at -= 0.5;
    if (widthOf(text, at, weight, italic) > maxWidth) {
      while (text.length > 1 && widthOf(`${text}…`, at, weight, italic) > maxWidth) text = text.slice(0, -1);
      text += '…';
    }
    return { text, size: at };
  }

  function text(x, y, s, { size = 12, weight = 400, fill = C.ink2, anchor = 'start', italic = false, rotate = null, halo = false } = {}) {
    const attrs = `x="${r1(x)}" y="${r1(y)}" font-size="${size}"${weight !== 400 ? ` font-weight="${weight}"` : ''}`
      + `${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${italic ? ' font-style="italic"' : ''}`
      + `${rotate != null ? ` transform="rotate(${rotate} ${r1(x)} ${r1(y)})"` : ''}`;
    // A halo keeps a label legible over lines; a second text, not paint-order, so that every SVG editor shows it
    const under = halo ? `<text ${attrs} fill="none" stroke="${C.surface}" stroke-width="3" stroke-linejoin="round">${esc(s)}</text>` : '';
    return `${under}<text ${attrs} fill="${fill}">${esc(s)}</text>`;
  }

  // The same points every time, so that the file matches the preview and a run can be repeated
  function seeded(label) {
    let a = 2166136261;
    for (const ch of String(label)) a = Math.imul(a ^ ch.codePointAt(0), 16777619);
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const line = (points, X, Y, key = 'p') => points.map((q, i) => `${i ? 'L' : 'M'}${r1(X(q.score))} ${r1(Y(q[key]))}`).join('');

  function panel(p, x0, y0, s, o, flags) {
    const X = (v) => x0 + v * s.w, Y = (v) => y0 + ((YMAX - v) / (YMAX - YMIN)) * s.h;
    const number = (v, digits, most = digits) => v.toLocaleString(o.locale, { minimumFractionDigits: digits, maximumFractionDigits: most });
    let out = '';

    for (const t of TICKS) {
      out += `<path d="M${r1(x0)} ${r1(Y(t))}H${r1(x0 + s.w)}" stroke="${C.grid}"/>`;
      if (flags.yTicks) out += text(x0 - 9, Y(t) + s.tick * 0.35, number(t, 1), { size: s.tick, fill: C.tick, anchor: 'end' });
    }
    const bottom = y0 + s.h;
    out += `<path d="M${r1(x0)} ${r1(bottom)}H${r1(x0 + s.w)}" stroke="${C.axis}"/>`;
    for (const t of TICKS) {
      out += `<path d="M${r1(X(t))} ${r1(bottom)}v4" stroke="${C.axis}"/>`;
      if (flags.xTicks) out += text(X(t), bottom + 18, number(t, 1), { size: s.tick, fill: C.tick, anchor: 'middle' });
    }
    if (flags.yTitle && o.yLabel) {
      const t = fitText(o.yLabel, s.h, s.axis, 400, false);
      out += text(x0 - s.left + 15, Y(0.5), t.text, { size: t.size, fill: C.ink2, anchor: 'middle', rotate: -90 });
    }
    if (flags.xTicks && o.xLabel) {
      const t = fitText(o.xLabel, s.w, s.axis, 400, false);
      out += text(x0 + s.w / 2, bottom + 40, t.text, { size: t.size, fill: C.ink2, anchor: 'middle' });
    }

    const inside = p.curve ? p.curve.filter((q) => q.score >= p.low && q.score <= p.high) : [];
    if (p.curve && o.band && inside.length > 1) {
      out += `<path d="${line(inside, X, Y, 'lo')}${[...inside].reverse().map((q) => `L${r1(X(q.score))} ${r1(Y(q.hi))}`).join('')}Z" fill="${C.curve}" fill-opacity="0.14"/>`;
    }

    // The points: position gives the verdict, colour repeats it, and the jitter never touches a score
    const rand = seeded(p.seed), dots = [];
    const draw = (clips, level, colour) => {
      const stride = Math.max(1, clips.length / MAX_POINTS);
      let marks = '';
      for (let i = 0; i < clips.length; i += stride) {
        const c = clips[Math.floor(i)], cx = X(c.score), cy = Y(level + (2 * rand() - 1) * o.jitter * JITTER);
        marks += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${s.r}"/>`;
        dots.push({ x: cx, y: cy, clip: c });
      }
      return `<g fill="${colour}" fill-opacity="0.5">${marks}</g>`;
    };
    out += draw(p.clips.filter((c) => c.result === 'negative'), 0, C.neg);
    out += draw(p.clips.filter((c) => c.result === 'positive'), 1, C.pos);

    if (p.curve) {
      for (const part of [p.curve.filter((q) => q.score <= p.low), p.curve.filter((q) => q.score >= p.high)]) {
        if (part.length > 1) out += `<path d="${line(part, X, Y)}" fill="none" stroke="${C.curve}" stroke-opacity="0.35" stroke-width="1.75"/>`;
      }
      out += `<path d="${line(inside, X, Y)}" fill="none" stroke="${C.curve}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    } else {
      out += text(x0 + s.w / 2, Y(0.5), o.labels.noCurve, { size: s.tick, fill: C.tick, anchor: 'middle' });
    }

    if (o.showBands && p.bands) {
      for (const b of p.bands) {
        const radius = Math.min(2.5 + Math.sqrt(b.n) * 0.35, 7);
        out += `<circle cx="${r1(X(b.score))}" cy="${r1(Y(b.share))}" r="${r1(radius)}" fill="${C.surface}" stroke="${C.ink}" stroke-width="1.25"/>`;
      }
    }

    // Thresholds: dashed lines from both axes to the curve, with the two values where the lines meet the axes
    const marks = (p.marks || []).filter((m) => m.reachable).sort((a, b) => a.score - b.score);
    let labels = '', lastRight = -Infinity, level = 0, lastY = Infinity, lastYRight = 0;
    for (const m of marks) {
      const xx = X(m.score), yy = Y(m.p);
      out += `<path d="M${r1(x0)} ${r1(yy)}H${r1(xx)}V${r1(bottom)}" fill="none" stroke="${C.mark}" stroke-dasharray="4 3"/>`;
      labels += `<circle cx="${r1(xx)}" cy="${r1(yy)}" r="4" fill="${C.curve}" stroke="${C.surface}" stroke-width="2"/>`;
      const xText = m.kind === 'score' ? number(m.score, 2, 3) : number(m.score, 2);
      const yText = m.kind === 'p' ? number(m.p, 2, 3) : number(m.p, 2);
      const w = widthOf(xText, s.mark, 600), flip = xx + 4 + w > x0 + s.w;
      level = !flip && xx + 4 < lastRight + 3 ? level + 1 : 0;
      labels += text(flip ? xx - 4 : xx + 4, Y(0.085) - level * (s.mark + 2), xText, { size: s.mark, weight: 600, fill: C.ink, anchor: flip ? 'end' : 'start', halo: true });
      lastRight = flip ? xx : xx + 4 + w;
      const yw = widthOf(yText, s.mark, 600), close = Math.abs(yy - lastY) < s.mark + 1;
      const yx = close ? lastYRight + 6 : x0 + 4;
      labels += text(yx, yy - 3.5, yText, { size: s.mark, weight: 600, fill: C.ink, halo: true });
      lastY = yy;
      lastYRight = yx + yw;
    }
    return { svg: out + labels, info: { x: x0, y: y0, w: s.w, h: s.h, dots, panel: p, X, Y } };
  }

  function legend(items, x, y, maxWidth, size) {
    let out = '', at = x, row = 0;
    const rowH = size * 1.6, gap = 14;
    for (const it of items) {
      const key = it.kind === 'dot' || it.kind === 'open' ? 9 : 18, w = key + 6 + widthOf(it.label, size) + gap;
      if (at > x && at + w - gap > x + maxWidth) { at = x; row++; }
      const cy = y + row * rowH - size * 0.32;
      if (it.kind === 'dot') out += `<circle cx="${r1(at + key / 2)}" cy="${r1(cy)}" r="4" fill="${it.colour}" fill-opacity="0.6"/>`;
      if (it.kind === 'line') out += `<path d="M${r1(at)} ${r1(cy)}h${key}" stroke="${C.curve}" stroke-width="2"/>`;
      if (it.kind === 'faded') out += `<path d="M${r1(at)} ${r1(cy)}h${key}" stroke="${C.curve}" stroke-opacity="0.35" stroke-width="1.75"/>`;
      if (it.kind === 'band') out += `<rect x="${r1(at)}" y="${r1(cy - 5)}" width="${key}" height="10" fill="${C.curve}" fill-opacity="0.14"/>`;
      if (it.kind === 'dash') out += `<path d="M${r1(at)} ${r1(cy)}h${key}" stroke="${C.mark}" stroke-dasharray="4 3"/>`;
      if (it.kind === 'open') out += `<circle cx="${r1(at + key / 2)}" cy="${r1(cy)}" r="4" fill="${C.surface}" stroke="${C.ink}" stroke-width="1.25"/>`;
      out += text(at + key + 6, y + row * rowH, it.label, { size, fill: C.ink2 });
      at += w;
    }
    return { svg: out, height: (row + 1) * rowH };
  }

  /* panels: [{ title, subtitle, counts, seed, clips, low, high, curve, marks, bands }]
     o: { labels, locale, italic, xLabel, yLabel, jitter (0 to 1), band, showBands, cols, rows, figureTitle, figureSubtitle } */
  function figure(panels, o) {
    const big = panels.length === 1, s = big ? BIG : SMALL;
    const cols = big ? 1 : Math.max(1, o.cols);
    const rows = big ? 1 : Math.max(o.rows || 1, Math.ceil(panels.length / cols));
    const W = s.left + cols * s.w + (cols - 1) * s.gap + s.right, inner = W - 32;
    const hasSub = panels.some((p) => p.subtitle);
    const L = o.labels;

    const hasFit = panels.some((p) => p.curve);
    const items = [
      { kind: 'dot', colour: C.pos, label: L.positive }, { kind: 'dot', colour: C.neg, label: L.negative },
      hasFit && { kind: 'line', label: L.curve },
      hasFit && o.band && { kind: 'band', label: L.band },
      panels.some((p) => p.curve && (p.low > 0 || p.high < 1)) && { kind: 'faded', label: L.outside },
      panels.some((p) => (p.marks || []).some((m) => m.reachable)) && { kind: 'dash', label: L.threshold },
      o.showBands && { kind: 'open', label: L.observed },
    ].filter(Boolean);

    const head = (p, x, y, width, sizes) => {
      let out = '', yy = y;
      const t = fitText(p.title, width, sizes.title, 600, o.italic);
      yy += sizes.title * 1.2;
      out += text(x, yy, t.text, { size: t.size, weight: 600, fill: C.ink, italic: o.italic });
      if (hasSub) {
        yy += sizes.sub * 1.45;
        if (p.subtitle) {
          const u = fitText(p.subtitle, width, sizes.sub, 400, false);
          out += text(x, yy, u.text, { size: u.size, fill: C.ink2 });
        }
      }
      yy += sizes.counts * 1.5;
      out += text(x, yy, p.counts, { size: sizes.counts, fill: C.tick });
      return { svg: out, bottom: yy };
    };

    let body = '', y = 0;
    const info = [];
    if (big) {
      const h1 = head(panels[0], 16, 12, inner, s);
      const lg = legend(items, 16, h1.bottom + 24, inner, s.legend);
      y = h1.bottom + 24 + lg.height + 2;
      body += h1.svg + lg.svg;
      const d = panel(panels[0], s.left, y, s, o, { yTicks: true, yTitle: true, xTicks: true });
      body += d.svg;
      info.push(d.info);
      y += s.h + 54;
    } else {
      if (o.figureTitle) { y += 30; const t = fitText(o.figureTitle, inner, 20, 600, false); body += text(16, y, t.text, { size: t.size, weight: 600, fill: C.ink }); }
      if (o.figureSubtitle) { y += 20; const t = fitText(o.figureSubtitle, inner, 13.5, 400, false); body += text(16, y, t.text, { size: t.size, fill: C.ink2 }); }
      const lg = legend(items, 16, y + 22, inner, s.legend);
      body += lg.svg;
      y += 22 + lg.height + 6;
      const headH = s.title * 1.2 + (hasSub ? s.sub * 1.45 : 0) + s.counts * 1.5 + 8;
      const pitch = headH + s.h + 26;
      panels.forEach((p, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        const x0 = s.left + col * (s.w + s.gap), top = y + row * pitch;
        body += head(p, x0, top, s.w, s).svg;
        const d = panel(p, x0, top + headH, s, o, { yTicks: col === 0, yTitle: col === 0, xTicks: i + cols >= panels.length });
        body += d.svg;
        info.push(d.info);
      });
      y += rows * pitch - 26 + 54;
    }
    const H = Math.ceil(y);
    const name = big ? panels[0].title : o.figureTitle || L.figureName;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}" role="img">`
      + `<title>${esc(name)}</title><desc>${esc(panels.map((p) => `${p.title}: ${p.counts}.`).join(' '))}</desc>`
      + `<rect width="${W}" height="${H}" fill="${C.surface}"/>${body}</svg>`;
    return { svg, width: W, height: H, panels: info };
  }

  return { figure, COLOURS: C, MAX_POINTS };
})();
