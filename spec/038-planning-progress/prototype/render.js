/* ==========================================================================
   spec/038-planning-progress — planning-progress icicle renderer. MOCKUP CODE.

   Plain browser JavaScript. No modules, no imports, no build step, no deps.
   Loaded with <script src="render.js"></script> from a page opened over file://.

   Public API:
     window.PlanningRender.render(portfolio, rootEl, options)
     window.PlanningRender.setRamp(rootEl, 'purple'|'grey')
     window.PlanningRender.setSourceEncoding(rootEl, 'none'|'border'|'anchor'|'bracket'|'ends')
     window.PlanningRender.defaults

   `render` is idempotent: it wipes rootEl and redraws from scratch.
   The two setters are class swaps on the wrapper, so toggling ramp or source
   encoding never re-runs layout.
   ========================================================================== */
(function () {
  'use strict';

  var DAY = 86400000;
  var LEVELS = ['direction', 'increment', 'epic', 'story'];
  var RUNG_NAMES = ['Unknown', 'Refined', 'Sized', 'Scheduled'];
  /* Minimum rendered width in px, per level. A story that is one day long must
     still be clickable and countable. */
  var MIN_PX = [8, 6, 4, 3];
  /* Queued items with no estimate are drawn as a dot. A dot claims no duration,
     so it occupies its own diameter plus a gap in PIXELS, not time. */
  var DOT_PX = [18, 14, 11, 9];
  var DOT_GAP_PX = 3;
  var SOURCE_MODES = ['none', 'border', 'anchor', 'bracket', 'ends'];

  var DEFAULTS = {
    ramp: 'purple',
    sourceEncoding: 'ends',
    monthsBack: 3,
    monthsForward: 14,
    /* Fixed px per month; the page scrolls horizontally when the axis outgrows it. */
    monthWidth: 150,
  };

  /* ---------------------------------------------------------------- utils */

  function parseISO(iso) {
    if (!iso || typeof iso !== 'string') return null;
    var p = iso.split('-');
    if (p.length !== 3) return null;
    var ms = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(ms) ? null : ms;
  }

  function monthFloor(ms) {
    var d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }

  function addMonths(ms, n) {
    var d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function pct(n) {
    return (Math.round(n * 1e5) / 1e3).toFixed(3) + '%';
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isoOf(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  /* ------------------------------------------------------------- the axis */

  function buildAxis(todayMs, monthsBack, monthsForward) {
    var start = addMonths(monthFloor(todayMs), -monthsBack);
    var end = addMonths(monthFloor(todayMs), monthsForward + 1);
    var span = end - start;
    var months = [];
    var cur = start;
    var prevYear = null;
    while (cur < end) {
      var next = addMonths(cur, 1);
      var d = new Date(cur);
      var y = d.getUTCFullYear();
      months.push({
        startMs: cur,
        endMs: next,
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()],
        year: y,
        showYear: prevYear === null || y !== prevYear,
      });
      prevYear = y;
      cur = next;
    }
    return {
      startMs: start,
      endMs: end,
      spanMs: span,
      months: months,
      /* Fraction of the axis, by true elapsed time rather than equal columns. */
      frac: function (ms) {
        return clamp((ms - start) / span, 0, 1);
      },
    };
  }

  /* ---------------------------------------------- pass 1: derive per-node */

  /* Width of a queued (undated) item is its rolled-up estimate converted to
     team time. `pointsPerDayPerTrack` is points one track of team burns per day,
     so days = points / pointsPerDayPerTrack. Those team-days are laid out 1:1
     against calendar days on the axis; for a mockup that is honest enough, and
     it keeps "a wider bar is more work" true. */
  function daysForPoints(points, pointsPerDay) {
    return Math.max(points / pointsPerDay, 1);
  }

  /* Shape says what we know: box = dates + estimate, I-beam = dates only,
     hatched box = estimate only, dot = neither. `msPerPx` sizes the dots. */
  function annotate(portfolio, msPerPx) {
    var pointsPerDay = (portfolio.conversion && Number(portfolio.conversion.pointsPerDayPerTrack)) || 1;

    (function walk(siblings) {
      siblings.forEach(function (n) {
        n._startMs = parseISO(n.rollupStart);
        n._dueMs = parseISO(n.rollupDue);
        n._dated = n._startMs !== null && n._dueMs !== null && n._dueMs >= n._startMs;

        var est = isNum(n.rollupEstimate) ? n.rollupEstimate : 0;
        n._noEst = !(est > 0);
        if (!n._noEst) {
          n._natMs = daysForPoints(est, pointsPerDay) * DAY;
        } else {
          var depth = Math.max(LEVELS.indexOf(n.level), 0);
          n._natMs = (DOT_PX[depth] + DOT_GAP_PX) * msPerPx;
        }
        n._shape = n._noEst ? (n._dated ? 'ibeam' : 'dot') : 'box';

        /* The encoding has to describe the provenance of the geometry actually
           on screen. A bar placed on dates is a statement about dateSource; a
           bar queued by estimate is a statement about estimateSource. Picking
           one arbitrarily would mark bars whose marked field had no effect on
           what you see. The field that lost is surfaced by `_mixed`. */
        n._geomSource = n._dated ? n.dateSource : n.estimateSource;
        n._mixed = n.dateSource !== n.estimateSource;
        n._startSrc = n.startSource || n.dateSource;
        n._dueSrc = n.dueSource || n.dateSource;

        if (n.children && n.children.length) walk(n.children);

        /* Latest real due date anywhere in the subtree; past this node's own due it is an overrun. */
        n._deepDueMs = n._dated ? n._dueMs : null;
        (n.children || []).forEach(function (k) {
          if (k._deepDueMs !== null && (n._deepDueMs === null || k._deepDueMs > n._deepDueMs))
            n._deepDueMs = k._deepDueMs;
        });
      });
    })(portfolio.directions);
  }

  /* ---------------------------------------------------- pass 2: placement */

  /*  1. A dated item sits on its dates.
      2. Undated siblings queue to the right of the subtree frontier, in rank
         order, butted end to end. No gutter, nothing unplaceable.
      3. Queued width is the estimate converted to team time (see above).
      4. If the queue runs past a dated parent's own due date, the parent is
         EXTENDED rather than the children being squeezed — the overrun is drawn
         as a separate projected bar in the parent's lane. Squeezing would have
         broken rule 3, which is the whole point of the view.
      Post-order, so a grandparent inherits the extension too.                */
  function place(node, startMs, axis) {
    node._x0 = startMs;
    var ownEnd = node._dated ? node._dueMs : startMs + node._natMs;
    /* A dated node whose start was clamped must still occupy a day. */
    if (ownEnd <= node._x0) ownEnd = node._x0 + DAY;
    node._ownX1 = ownEnd;

    var kids = (node.children || []).slice().sort(function (a, b) {
      return (a.rank || 0) - (b.rank || 0);
    });

    var maxChildEnd = ownEnd;
    if (kids.length) {
      var dated = kids.filter(function (k) {
        return k._dated;
      });
      var undated = kids.filter(function (k) {
        return !k._dated;
      });

      /* Local frontier: how far this subtree's real commitments actually reach. */
      var frontier = node._x0;
      dated
        .slice()
        .sort(function (a, b) {
          return a._startMs - b._startMs;
        })
        .forEach(function (k) {
          place(k, Math.max(k._startMs, node._x0), axis);
          if (k._x1 > frontier) frontier = k._x1;
          if (k._x1 > maxChildEnd) maxChildEnd = k._x1;
        });

      var cursor = Math.max(node._x0, frontier);
      undated.forEach(function (k) {
        place(k, cursor, axis);
        cursor = k._x1;
        if (k._x1 > maxChildEnd) maxChildEnd = k._x1;
      });
    }

    node._x1 = maxChildEnd;
    /* Dated work underneath running past this node's OWN due is a committed conflict, drawn
       amber; a rolled due made no promise, so the conflict belongs to the child that did. */
    node._ovrTo =
      node._dated && node._dueSrc === 'own' && node._deepDueMs !== null && node._deepDueMs > ownEnd
        ? Math.min(node._deepDueMs, node._x1)
        : null;
    var committedEnd = node._ovrTo !== null ? node._ovrTo : ownEnd;
    /* Only a DATED node shows a separate extension bar; an undated node is
       already drawn as one projected block, so it just gets wider. */
    node._extFrom = node._dated && node._x1 > committedEnd ? committedEnd : null;
    return node;
  }

  function layout(portfolio, axis) {
    var directions = portfolio.directions.slice().sort(function (a, b) {
      return (a.rank || 0) - (b.rank || 0);
    });
    var dated = directions.filter(function (o) {
      return o._dated;
    });
    var undated = directions.filter(function (o) {
      return !o._dated;
    });

    var todayMs = parseISO(portfolio.today) || Date.now();

    dated.forEach(function (o) {
      place(o, o._startMs, axis);
    });

    /* Directions are the one level that does NOT queue: each gets its own band of
       lanes, so there is no shared row to butt up against. A direction with
       nothing dated anywhere simply starts at today. */
    undated.forEach(function (o) {
      place(o, todayMs, axis);
    });

    return directions;
  }

  /* ------------------------------------------------------- pass 3: draw */

  function barClasses(node, depth) {
    var c = ['pp-bar', 'pp-lv' + depth];
    if (depth > 0) c.push('pp-mute');

    if (node.exec === 'done') c.push('pp-exec-done');
    else if (node.exec === 'inprogress') c.push('pp-exec-inprogress');
    else c.push('pp-rung' + clamp(node.evidencedRung | 0, 0, 3));

    if (node._shape === 'ibeam') c.push('pp-ibeam');
    else if (node._shape === 'dot') c.push('pp-dot');
    else if (!node._dated) c.push('pp-projected');

    /* Status claims more than the fields can evidence: fill is the evidence,
       border is the claim, so the promise reads as hollow. */
    if ((node.claimedRung | 0) > (node.evidencedRung | 0)) {
      c.push('pp-contra', 'pp-claim' + clamp(node.claimedRung | 0, 0, 3));
    }
    /* Work started on something that was never planned at all. */
    if (node.exec !== 'todo' && (node.evidencedRung | 0) === 0) c.push('pp-redring');

    return c.join(' ');
  }

  /* Per-END date source for the 'ends' encoding. Leaves are skipped: their dates can only be their own. */
  function endClasses(node) {
    if (!node._dated || !(node.children && node.children.length)) return '';
    var c = '';
    if (node._startSrc === 'own') c += ' pp-own-s';
    else if (node._startSrc === 'rolled') c += ' pp-roll-s';
    if (node._dueSrc === 'own') c += ' pp-own-d';
    else if (node._dueSrc === 'rolled') c += ' pp-roll-d';
    return c;
  }

  function makeBar(node, depth, axis) {
    var joined = node._ovrTo !== null || node._extFrom !== null;
    var b = el('div', barClasses(node, depth) + endClasses(node) + (joined ? ' pp-join-r' : ''));
    var l = axis.frac(node._x0);
    var r = axis.frac(joined ? node._ownX1 : node._x1);
    b.style.left = pct(l);
    if (node._shape === 'dot') {
      b.style.width = DOT_PX[depth] + 'px';
      b._ppLeft = l;
    } else {
      b.style.width = pct(Math.max(r - l, 0));
      b.style.minWidth = MIN_PX[depth] + 'px';
    }

    b.setAttribute('data-geom-src', node._geomSource || 'none');
    b.setAttribute('data-mixed', node._mixed ? 'true' : 'false');

    var anchor = el('div', 'pp-anchor');
    var mixed = el('div', 'pp-mixed');
    b.appendChild(anchor);
    b.appendChild(mixed);

    /* Only the top level carries text. Everything below is pure shape. */
    if (depth === 0) {
      var label = el('span');
      label.textContent = node.name;
      b.appendChild(label);
    }

    b._ppNode = node;
    return b;
  }

  function makeOverrunBar(node, depth, axis) {
    var b = el(
      'div',
      'pp-bar pp-lv' +
        depth +
        (depth > 0 ? ' pp-mute' : '') +
        ' pp-overrun pp-join-l' +
        (node._extFrom !== null ? ' pp-join-r' : ''),
    );
    var l = axis.frac(node._ownX1);
    var r = axis.frac(node._ovrTo);
    b.style.left = pct(l);
    b.style.width = pct(Math.max(r - l, 0));
    b.style.minWidth = MIN_PX[depth] + 'px';
    b.setAttribute('data-geom-src', 'none');
    b.setAttribute('data-mixed', 'false');
    var weeks = Math.round((node._ovrTo - node._ownX1) / (7 * DAY));
    if (depth === 0 && weeks >= 3) {
      var label = el('span');
      label.textContent = '+' + weeks + 'w';
      b.appendChild(label);
    }
    b._ppNode = node;
    b._ppOvr = true;
    return b;
  }

  function makeExtBar(node, depth, axis) {
    /* Interlocks on the diagonal when the segment before it ends on a rolled (slanted) date. */
    var seam = node._ovrTo === null && node._dueSrc === 'rolled';
    /* An I-beam's tail has no estimate either, so it continues as a bare dotted line, not a hatched block. */
    var tail = node._shape === 'ibeam' ? ' pp-ext-line' : ' pp-projected' + (seam ? ' pp-seam' : '');
    var b = el(
      'div',
      barClasses(node, depth).replace('pp-contra', '').replace('pp-ibeam', '') + ' pp-ext pp-join-l' + tail,
    );
    var l = axis.frac(node._extFrom);
    var r = axis.frac(node._x1);
    b.style.left = pct(l);
    b.style.setProperty('--pp-w', pct(Math.max(r - l, 0)));
    b.style.minWidth = MIN_PX[depth] + 'px';
    b.setAttribute('data-geom-src', 'none');
    b.setAttribute('data-mixed', 'false');
    b._ppNode = node;
    b._ppExt = true;
    return b;
  }

  function makeBracket(node, depth, axis) {
    var kids = node.children || [];
    if (!kids.length) return null;
    var lo = Infinity;
    var hi = -Infinity;
    kids.forEach(function (k) {
      if (k._x0 < lo) lo = k._x0;
      if (k._x1 > hi) hi = k._x1;
    });
    if (!isFinite(lo) || !isFinite(hi)) return null;
    var br = el('div', 'pp-bracket');
    var l = axis.frac(lo);
    var r = axis.frac(hi);
    br.style.left = pct(l);
    br.style.width = pct(Math.max(r - l, 0));
    return br;
  }

  function drawGroup(direction, axis, todayMs) {
    var group = el('div', 'pp-group');
    var lanes = LEVELS.map(function (_, i) {
      var lane = el('div', 'pp-lane pp-lane-' + i);
      group.appendChild(lane);
      return lane;
    });

    (function walk(node, depth, parent) {
      if (depth > 3) return;
      var lane = lanes[depth];
      var bar = makeBar(node, depth, axis);
      lane.appendChild(bar);
      node._parent = parent;
      node._bars = [bar];
      if (node._ovrTo !== null) {
        var ovr = makeOverrunBar(node, depth, axis);
        lane.appendChild(ovr);
        node._bars.push(ovr);
      }
      if (node._extFrom !== null) {
        var ext = makeExtBar(node, depth, axis);
        lane.appendChild(ext);
        node._bars.push(ext);
      }

      /* A rolled-up value is a claim about what is underneath it, so the
         bracket spans the children that produced it. */
      if (node._geomSource === 'rolled') {
        var br = makeBracket(node, depth, axis);
        if (br) lane.appendChild(br);
      }

      var kids = node.children || [];
      kids.forEach(function (k) {
        walk(k, depth + 1, node);
      });
    })(direction, 0, null);

    /* Queues from overlapping parents share one lane, so their dots can land on each other.
       Colliding dots fan out like an avatar stack (half a dot apart, each haloed) rather than
       being pushed a full step, so a dense run drifts half as far from where it was queued. */
    lanes.forEach(function (lane, depth) {
      var step = (DOT_PX[depth] * 0.5) / axis.widthPx;
      var next = -Infinity;
      [].slice
        .call(lane.children)
        .filter(function (b) {
          return b._ppLeft !== undefined;
        })
        .sort(function (a, b) {
          return a._ppLeft - b._ppLeft;
        })
        .forEach(function (b, i) {
          var l = Math.max(b._ppLeft, next);
          b.style.left = pct(l);
          b.style.zIndex = 3 + i;
          next = l + step;
        });
    });

    return group;
  }

  /* ------------------------------------------------------------- tooltip */

  var tipEl = null;

  function tooltip() {
    if (tipEl && tipEl.isConnected) return tipEl;
    tipEl = el('div', 'pp-tip');
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function rung(i) {
    var v = clamp(i | 0, 0, 3);
    return v + ' ' + RUNG_NAMES[v];
  }

  function row(label, value, bad) {
    return (
      '<tr><th>' +
      label +
      '</th><td' +
      (bad ? ' class="pp-tip-bad"' : '') +
      '>' +
      String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      '</td></tr>'
    );
  }

  function tipHTML(node, isExt, isOvr) {
    var contra = (node.claimedRung | 0) > (node.evidencedRung | 0);
    var html =
      '<div class="pp-tip-title"><span class="pp-tip-key">' +
      node.key +
      '</span>' +
      String(node.name).replace(/</g, '&lt;') +
      '</div><table>';
    html += row('Level', node.level);
    html += row('Rank', '#' + node.rank);
    html += row('Status', node.status);
    html += row('Execution', node.exec);
    html += row('Claimed rung', rung(node.claimedRung), contra);
    html += row('Evidenced rung', rung(node.evidencedRung), contra);
    html += row('Estimate — own', node.ownEstimate === null ? '—' : node.ownEstimate + ' pts');
    html += row('Estimate — rollup', (node.rollupEstimate || 0) + ' pts');
    html += row('Estimate source', node.estimateSource);
    html += row('Dates — own', (node.ownStart || '—') + ' → ' + (node.ownDue || '—'));
    html += row('Dates — rollup', (node.rollupStart || '—') + ' → ' + (node.rollupDue || '—'));
    html += row(
      'Date source',
      node.dateSource + (node.startSource ? ' (start ' + node.startSource + ' · due ' + node.dueSource + ')' : ''),
    );
    if (node._ovrTo !== null && node._ovrTo !== undefined)
      html += row('Work underneath ends', isoOf(node._deepDueMs) + ' — past this due date', true);
    html += row(
      'Placement',
      node._dated
        ? 'real dates' + (node._noEst ? ' · no estimate (I-beam)' : '')
        : node._noEst
          ? 'queued · no estimate (dot, takes no time)'
          : 'queued by rank',
      !node._dated || node._noEst,
    );
    if (isOvr) html += row('This block', "dated work underneath runs past this item's due");
    if (isExt) html += row('This block', 'queued children overrunning the parent');
    html += '</table>';
    return html;
  }

  /* Hovering a block lifts its whole ancestor chain and dims the rest, so the
     hierarchy above a tiny story is readable without hunting for it. */
  function setFocus(wrap, node) {
    wrap.querySelectorAll('.pp-focus, .pp-ancestor').forEach(function (b) {
      b.classList.remove('pp-focus', 'pp-ancestor');
    });
    wrap.classList.toggle('pp-focusing', !!node);
    if (!node) return;
    (node._bars || []).forEach(function (b) {
      b.classList.add('pp-focus');
    });
    for (var p = node._parent; p; p = p._parent) {
      (p._bars || []).forEach(function (b) {
        b.classList.add('pp-ancestor');
      });
    }
  }

  function wireTooltip(wrap) {
    function show(e) {
      var bar = e.target.closest ? e.target.closest('.pp-bar') : null;
      if (!bar || !bar._ppNode || !wrap.contains(bar)) return;
      setFocus(wrap, bar._ppNode);
      var t = tooltip();
      t.innerHTML = tipHTML(bar._ppNode, !!bar._ppExt, !!bar._ppOvr);
      t.style.display = 'block';
      move(e);
    }
    function move(e) {
      if (!tipEl || tipEl.style.display !== 'block') return;
      var pad = 14;
      var r = tipEl.getBoundingClientRect();
      var x = e.clientX + pad;
      var y = e.clientY + pad;
      if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
      if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
      tipEl.style.left = Math.max(4, x) + 'px';
      tipEl.style.top = Math.max(4, y) + 'px';
    }
    function hide(e) {
      var to = e.relatedTarget;
      if (to && to.closest && to.closest('.pp-bar')) return;
      setFocus(wrap, null);
      if (tipEl) tipEl.style.display = 'none';
    }
    wrap.addEventListener('mouseover', show);
    wrap.addEventListener('mousemove', move);
    wrap.addEventListener('mouseout', hide);
    wrap.addEventListener('mouseleave', function () {
      setFocus(wrap, null);
      if (tipEl) tipEl.style.display = 'none';
    });
  }

  /* ---------------------------------------------------------------- shell */

  function errorBox(rootEl, title, detail) {
    rootEl.innerHTML = '';
    var box = el('div', 'pp-error');
    var h = el('strong');
    h.textContent = title;
    box.appendChild(h);
    box.appendChild(document.createTextNode(detail));
    rootEl.appendChild(box);
  }

  function validPortfolio(p) {
    return !!(p && p.directions && Object.prototype.toString.call(p.directions) === '[object Array]');
  }

  function render(portfolio, rootEl, options) {
    if (!rootEl) throw new Error('PlanningRender.render: rootEl is required');

    /* Called with no portfolio? Fall back to the generator, and say something
       useful instead of throwing if it was never loaded. */
    if (!portfolio)
      portfolio =
        window.PlanningData && window.PlanningData.generatePortfolio ? window.PlanningData.generatePortfolio({}) : null;

    if (!validPortfolio(portfolio)) {
      errorBox(
        rootEl,
        'No planning data to render.',
        'window.PlanningData was not found (or did not return a { directions: [...] } portfolio). ' +
          'Load the generator before render.js, or pass a portfolio object as the first argument.',
      );
      return null;
    }

    var opts = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      opts[k] = options && options[k] !== undefined ? options[k] : DEFAULTS[k];
    });

    var todayMs = parseISO(portfolio.today) || monthFloor(Date.now());
    var axis = buildAxis(todayMs, opts.monthsBack, opts.monthsForward);
    var widthPx = axis.months.length * opts.monthWidth;
    axis.widthPx = widthPx;

    annotate(portfolio, axis.spanMs / widthPx);
    var directions = layout(portfolio, axis);

    rootEl.innerHTML = '';
    var wrap = el('div', 'pp-wrap');
    wrap.style.width = widthPx + 'px';
    rootEl.appendChild(wrap);
    setRamp(rootEl, opts.ramp);
    setSourceEncoding(rootEl, opts.sourceEncoding);

    /* Month header. */
    var axisEl = el('div', 'pp-axis');
    axis.months.forEach(function (m) {
      var s = el('div', 'pp-month' + (m.showYear ? ' pp-month-year' : ''));
      s.style.left = pct(axis.frac(m.startMs));
      s.style.width = pct(axis.frac(m.endMs) - axis.frac(m.startMs));
      s.textContent = m.showYear ? m.label + ' ' + m.year : m.label;
      axisEl.appendChild(s);
    });
    wrap.appendChild(axisEl);

    var chart = el('div', 'pp-chart');
    wrap.appendChild(chart);

    var grid = el('div', 'pp-gridlines');
    axis.months.forEach(function (m) {
      var g = el('div', 'pp-gridline');
      g.style.left = pct(axis.frac(m.startMs));
      grid.appendChild(g);
    });
    var today = el('div', 'pp-today');
    today.style.left = pct(axis.frac(todayMs));
    grid.appendChild(today);
    chart.appendChild(grid);

    directions.forEach(function (o) {
      chart.appendChild(drawGroup(o, axis, todayMs));
    });

    wireTooltip(wrap);
    rootEl._ppState = { portfolio: portfolio, options: opts };
    return wrap;
  }

  function wrapOf(rootEl) {
    return (
      rootEl && (rootEl.classList && rootEl.classList.contains('pp-wrap') ? rootEl : rootEl.querySelector('.pp-wrap'))
    );
  }

  function setRamp(rootEl, ramp) {
    var w = wrapOf(rootEl);
    if (!w) return;
    w.classList.remove('pp-ramp-purple', 'pp-ramp-grey');
    w.classList.add(ramp === 'grey' ? 'pp-ramp-grey' : 'pp-ramp-purple');
    if (rootEl._ppState) rootEl._ppState.options.ramp = ramp;
  }

  function setSourceEncoding(rootEl, mode) {
    var w = wrapOf(rootEl);
    if (!w) return;
    SOURCE_MODES.forEach(function (m) {
      w.classList.remove('pp-src-' + m);
    });
    w.classList.add('pp-src-' + (SOURCE_MODES.indexOf(mode) >= 0 ? mode : 'none'));
    if (rootEl._ppState) rootEl._ppState.options.sourceEncoding = mode;
  }

  window.PlanningRender = {
    render: render,
    setRamp: setRamp,
    setSourceEncoding: setSourceEncoding,
    defaults: DEFAULTS,
  };
})();
