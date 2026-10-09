/*
 * generator.js — mock portfolio generator for the "planning progress" report mockup.
 *
 * Plain browser script. No modules, no build step, no dependencies.
 * Load with <script src="generator.js"></script> and read window.PlanningData.
 *
 * ---------------------------------------------------------------------------
 * THE CORRELATION MODEL (why this isn't just Math.random())
 * ---------------------------------------------------------------------------
 * Every item sits on two INDEPENDENT axes:
 *
 *   planning rung  0 Unknown -> 1 Refined -> 2 Sized -> 3 Scheduled
 *   execution      todo | inprogress | done      (Jira statusCategory)
 *
 * The generator funnels almost every decision through a single scalar,
 * `p` = "planning pressure" in [0,1] — how likely this item is to be well
 * planned. `p` is built multiplicatively from four correlated inputs:
 *
 *   p = archetypeBase * rankDecay(rank) * parentFactor(parentRung) * timeFactor(start)
 *
 *   1. archetypeBase  — each DIRECTION is sampled an archetype (healthy /
 *      thinning / unplanned / overplanned) which sets the base level and the
 *      steepness of the rank decay for everything beneath it.
 *   2. rankDecay      — rank 1-2 siblings are far more planned than rank 5-6.
 *      `thinning` directions decay hard (good first increment, then nothing).
 *   3. parentFactor   — a child of a rung-0 parent is heavily (but NEVER
 *      absolutely) discouraged from reaching rung 3. This is a probability
 *      skew on purpose: the contradictions it leaks through are the signal the
 *      report is supposed to surface.
 *   4. timeFactor     — work starting soon is planned; work 9 months out is
 *      not. `overplanned` directions ignore this (that's what makes them waste).
 *
 * `p` then drives: the rung, whether the item is broken down at all, how many
 * children it gets, and (via its time window) its execution state.
 *
 * Time is modelled as integer DAY OFFSETS from `today` (2026-10-01), and every
 * node is allocated a window nested inside its parent's window, with rank
 * controlling the offset inside that window. The exception is OVERRUN_P, which
 * lets children run past a parent's own due date on purpose.
 *
 * `own` vs `rolled`: separately from the rung, parents frequently carry NO
 * fields of their own (increments ~65%, directions ~80%) and derive everything
 * from children. That is the single biggest source of realistic
 * `claimedRung > evidencedRung` contradictions.
 */

(function (root, factory) {
  var api = factory();
  root.PlanningData = api;
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // =========================================================================
  // Constants / domain vocabulary
  // =========================================================================

  var TODAY_ISO = '2026-10-01';
  var TODAY_MS = Date.UTC(2026, 9, 1);
  var DAY_MS = 86400000;

  /** Rough team-throughput conversion used by the renderer: points -> days. */
  var POINTS_PER_DAY_PER_TRACK = 1.4;

  var RUNG_LABELS = { 0: 'Unknown', 1: 'Refined', 2: 'Sized', 3: 'Scheduled' };

  var RUNG_STATUSES = {
    0: ['Funnel', 'New', 'Idea'],
    1: ['Defining', 'Discovery', 'Refining'],
    2: ['Estimating', 'Sized'],
    3: ['Ready', 'Planned', 'Scheduled'],
  };

  var INPROGRESS_STATUSES = ['In Progress', 'In Review'];
  var DONE_STATUSES = ['Done', 'Closed'];

  /** status name (lowercased) -> claimed rung. Execution statuses claim 3. */
  var STATUS_TO_RUNG = (function () {
    var map = {};
    [0, 1, 2, 3].forEach(function (rung) {
      RUNG_STATUSES[rung].forEach(function (name) {
        map[name.toLowerCase()] = rung;
      });
    });
    INPROGRESS_STATUSES.concat(DONE_STATUSES).forEach(function (name) {
      map[name.toLowerCase()] = 3;
    });
    return map;
  })();

  // --- tuning knobs ---------------------------------------------------------

  /** P(parent defers entirely to its children) given it HAS children. */
  var ROLLED_PREFERENCE = { direction: 0.86, increment: 0.93, epic: 0.68, story: 0 };

  /** P(a parent that rolls up its estimate still sets its own dates) — roadmap dates on increments. */
  var DATED_ROLLUP_P = { direction: 0.3, increment: 0.45, epic: 0.35, story: 0 };

  /** P(a parent with own dates set only ONE of them, leaving the other end to its children). */
  var PARTIAL_DATES_P = 0.2;

  /** P(a dated parent's children may run past its own due date), and by how many days. */
  var OVERRUN_P = 0.3;
  var OVERRUN_DAYS = { direction: [20, 70], increment: [10, 40], epic: [4, 14], story: [0, 0] };

  /** P(status over-claims relative to the fields actually present). */
  var OVERCLAIM_P = 0.15;

  /** P(an unplanned item got started anyway) — the "work with no plan" signal. */
  var WILD_START_P = 0.03;

  /** How much a parent's rung skews its children's. Index = parent rung. */
  var PARENT_FACTOR = [0.35, 0.62, 0.85, 1.0];

  var ARCHETYPE_BASE = { healthy: 0.86, thinning: 0.82, unplanned: 0.2, overplanned: 0.94 };
  var ARCHETYPE_RANK_DECAY = { healthy: 0.84, thinning: 0.46, unplanned: 0.62, overplanned: 0.96 };

  /** How willing each archetype is to break work down at all. */
  var ARCHETYPE_BREAKDOWN = { healthy: 1, thinning: 0.95, unplanned: 0.52, overplanned: 1 };

  /** Increments nearly always have at least one epic; epics vary far more. */
  var LEVEL_BREAKDOWN = { increment: 1.1, epic: 0.9 };

  /**
   * Day-offset window each archetype's work tends to live in. Healthy work is
   * near-term; overplanned work is scheduled absurdly far out.
   */
  var ARCHETYPE_WINDOW = {
    healthy: [-90, 130],
    thinning: [-85, 240],
    unplanned: [-60, 330],
    overplanned: [-20, 430],
  };

  var SPAN_DAYS = {
    direction: [60, 260],
    increment: [30, 120],
    epic: [10, 45],
    story: [2, 14],
  };

  var POINT_POOLS = {
    direction: [89, 144, 144, 233],
    increment: [21, 34, 34, 55, 89],
    epic: [5, 8, 8, 13, 13, 21, 21, 34, 55],
    story: [1, 1, 2, 2, 2, 3, 3, 3, 5, 5, 8, 13],
  };

  var LEVELS = ['direction', 'increment', 'epic', 'story'];

  var PROJECTS = [
    {
      prefix: 'ECOM',
      directions: [
        'Grow self-serve revenue',
        'Cut checkout abandonment in half',
        'Make the storefront fast on mobile',
        'Expand into EU marketplaces',
        'Raise repeat-purchase rate',
        'Reduce fulfilment cost per order',
      ],
      increments: [
        'Unified payments platform',
        'Headless storefront migration',
        'Personalised merchandising',
        'Subscription commerce',
        'Returns self-service',
        'Multi-currency pricing',
        'Loyalty and rewards',
        'Inventory accuracy programme',
      ],
      epicVerbs: ['Rewrite', 'Migrate', 'Redesign', 'Instrument', 'Harden', 'Consolidate', 'Replace', 'Optimise'],
      epicNouns: [
        'cart service',
        'checkout flow',
        'product search',
        'promo engine',
        'tax calculation',
        'order history',
        'address book',
        'shipping rate API',
        'catalogue importer',
        'wishlist sync',
      ],
      storyVerbs: ['Add', 'Fix', 'Wire up', 'Validate', 'Cache', 'Paginate', 'Expose', 'Track', 'Backfill', 'Retire'],
      storyNouns: [
        'Apple Pay button',
        'address autocomplete',
        'coupon validation',
        'guest checkout',
        'saved cards',
        'stock badge',
        'size guide modal',
        'abandoned-cart email',
        'gift message field',
        'order confirmation page',
        'PDP image gallery',
        'facet counts',
      ],
    },
    {
      prefix: 'POS',
      directions: [
        'Open 40 new restaurant locations',
        'Cut table turn time by 15%',
        'Make offline service bulletproof',
        'Launch the kitchen display product',
        'Reduce support tickets per store',
        'Unify franchise reporting',
      ],
      increments: [
        'Offline-first order capture',
        'Kitchen display system',
        'Tableside payments',
        'Menu management overhaul',
        'Franchise analytics',
        'Hardware fleet management',
        'Tip and payroll integration',
        'Multi-location menu sync',
      ],
      epicVerbs: ['Rebuild', 'Port', 'Simplify', 'Stabilise', 'Instrument', 'Automate', 'Extract', 'Upgrade'],
      epicNouns: [
        'order sync queue',
        'terminal pairing',
        'receipt printer driver',
        'menu versioning',
        'split-check logic',
        'shift close-out',
        'card reader firmware',
        'table layout editor',
        'course firing rules',
        'offline cache',
      ],
      storyVerbs: ['Add', 'Fix', 'Handle', 'Retry', 'Log', 'Surface', 'Queue', 'Verify', 'Migrate', 'Throttle'],
      storyNouns: [
        'split-by-seat flow',
        'printer offline toast',
        'modifier pricing',
        'void-with-reason prompt',
        'shift handover report',
        'happy-hour schedule',
        'allergen tags',
        'cash drawer reconcile',
        'tip pooling rules',
        'table merge gesture',
        'order replay on reconnect',
        'kitchen ticket layout',
      ],
    },
    {
      prefix: 'CLM',
      directions: [
        'Settle simple claims in under 48 hours',
        'Remove manual re-keying from intake',
        'Lower fraud leakage by 20%',
        'Meet the 2027 regulatory deadline',
        'Improve adjuster capacity',
        'Raise first-contact resolution',
      ],
      increments: [
        'Straight-through processing',
        'Document intake automation',
        'Fraud scoring platform',
        'Adjuster workbench redesign',
        'Regulatory reporting refresh',
        'Claimant self-service portal',
        'Vendor payment rails',
        'Legacy policy-system decoupling',
      ],
      epicVerbs: ['Automate', 'Decommission', 'Rewrite', 'Integrate', 'Validate', 'Re-platform', 'Audit', 'Normalise'],
      epicNouns: [
        'FNOL intake form',
        'document OCR pipeline',
        'coverage check service',
        'reserve calculation',
        'payment disbursement',
        'adjuster queue routing',
        'subrogation workflow',
        'policy lookup API',
        'fraud rules engine',
        'correspondence templates',
      ],
      storyVerbs: ['Add', 'Fix', 'Capture', 'Redact', 'Route', 'Flag', 'Reconcile', 'Export', 'Version', 'Notify'],
      storyNouns: [
        'duplicate-claim check',
        'photo upload limits',
        'adjuster assignment rules',
        'reserve change audit trail',
        'claimant SMS updates',
        'EOB PDF generation',
        'bank detail validation',
        'state-specific disclosures',
        'ICD code lookup',
        'bulk status export',
        'litigation hold flag',
        'payment reversal flow',
      ],
    },
    {
      prefix: 'PAY',
      directions: [
        'Reach 99.99% authorisation uptime',
        'Add three new payout corridors',
        'Pass PCI re-certification early',
        'Lower cost per transaction',
        'Shorten merchant onboarding to a day',
        'Eliminate manual reconciliation',
      ],
      increments: [
        'Ledger re-architecture',
        'Global payouts network',
        'Risk and sanctions screening',
        'Merchant onboarding automation',
        'Dispute management suite',
        'Reconciliation engine',
        'Token vault migration',
        'Fee schedule modernisation',
      ],
      epicVerbs: ['Shard', 'Rewrite', 'Isolate', 'Benchmark', 'Formalise', 'Replace', 'Instrument', 'Harden'],
      epicNouns: [
        'double-entry ledger',
        'settlement batcher',
        'KYC document service',
        'chargeback ingestion',
        'payout scheduler',
        'FX rate cache',
        'webhook delivery',
        'idempotency layer',
        'tokenisation vault',
        'fee calculation',
      ],
      storyVerbs: ['Add', 'Fix', 'Emit', 'Replay', 'Sign', 'Rate-limit', 'Reconcile', 'Alert on', 'Backfill', 'Expose'],
      storyNouns: [
        'webhook retry backoff',
        'ledger drift alert',
        'sanctions list refresh',
        'payout failure reasons',
        'merchant balance endpoint',
        'dispute evidence upload',
        '3DS step-up flow',
        'settlement file parser',
        'refund partial amounts',
        'idempotency key TTL',
        'FX quote expiry',
        'statement descriptor rules',
      ],
    },
    {
      prefix: 'MOBI',
      directions: [
        'Double weekly active users',
        'Ship the tablet experience',
        'Cut crash-free sessions below 0.2%',
        'Make onboarding feel instant',
        'Support offline use end to end',
        'Unify iOS and Android release trains',
      ],
      increments: [
        'Design system adoption',
        'Offline sync engine',
        'Push notification platform',
        'Release automation',
        'Accessibility compliance',
        'Tablet and foldable support',
        'Crash and performance observability',
        'Cross-platform core module',
      ],
      epicVerbs: ['Adopt', 'Rebuild', 'Extract', 'Profile', 'Modernise', 'Unify', 'Instrument', 'Replace'],
      epicNouns: [
        'navigation stack',
        'auth session handling',
        'image pipeline',
        'local database layer',
        'push token registry',
        'feature flag client',
        'deep link router',
        'theming tokens',
        'background sync worker',
        'crash reporting hooks',
      ],
      storyVerbs: ['Add', 'Fix', 'Animate', 'Preload', 'Persist', 'Localise', 'Measure', 'Debounce', 'Migrate', 'Gate'],
      storyNouns: [
        'biometric unlock',
        'pull-to-refresh',
        'empty-state illustrations',
        'dark mode tokens',
        'deep link from email',
        'offline banner',
        'skeleton loaders',
        'VoiceOver labels',
        'app-size budget check',
        'session restore',
        'notification permission prompt',
        'tablet split view',
      ],
    },
  ];

  // =========================================================================
  // Seeded PRNG (mulberry32) — Math.random() is never used
  // =========================================================================

  function createRandom(seed) {
    var state = seed >>> 0;
    function rnd() {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      rnd: rnd,
      /** Inclusive integer in [min, max]. */
      int: function (min, max) {
        if (max <= min) return min;
        return min + Math.floor(rnd() * (max - min + 1));
      },
      chance: function (p) {
        return rnd() < p;
      },
      pick: function (arr) {
        return arr[Math.floor(rnd() * arr.length)];
      },
      /** pairs: [[value, weight], ...] */
      weighted: function (pairs) {
        var total = 0;
        var i;
        for (i = 0; i < pairs.length; i++) total += pairs[i][1];
        var r = rnd() * total;
        for (i = 0; i < pairs.length; i++) {
          r -= pairs[i][1];
          if (r <= 0) return pairs[i][0];
        }
        return pairs[pairs.length - 1][0];
      },
    };
  }

  // =========================================================================
  // Small helpers
  // =========================================================================

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function offsetToISO(dayOffset) {
    return new Date(TODAY_MS + dayOffset * DAY_MS).toISOString().slice(0, 10);
  }

  /** Windows are inclusive day-offset ranges with at least one day of span. */
  function makeWindow(start, end) {
    var s = Math.round(start);
    var e = Math.round(end);
    if (e <= s) e = s + 1;
    return { start: s, end: e };
  }

  /**
   * Carve a child window out of a parent window. Rank drives the offset, so
   * rank 1 starts earliest. Windows deliberately overlap and are always
   * contained by the parent, which is what makes rollup dates bracket cleanly.
   */
  function allocateWindow(R, parentWin, rank, count, spread) {
    var span = parentWin.end - parentWin.start;
    var slot = span / Math.max(count, 1);
    var jitter = slot * 0.35 * (R.rnd() * 2 - 1);
    var rawStart = parentWin.start + slot * (rank - 1) * spread + jitter;
    var start = clamp(Math.round(rawStart), parentWin.start, parentWin.end - 1);
    var length = Math.max(1, Math.round(slot * (0.9 + 0.9 * R.rnd())));
    var end = clamp(start + length, start + 1, parentWin.end);
    return { start: start, end: end };
  }

  // =========================================================================
  // Names and keys
  // =========================================================================

  function createNamer(R) {
    var used = {};
    function unique(name) {
      if (!used[name]) {
        used[name] = 1;
        return name;
      }
      used[name] += 1;
      return name + ' (phase ' + used[name] + ')';
    }
    return {
      direction: function (proj) {
        return unique(R.pick(proj.directions));
      },
      increment: function (proj) {
        return unique(R.pick(proj.increments));
      },
      epic: function (proj) {
        return unique(R.pick(proj.epicVerbs) + ' ' + R.pick(proj.epicNouns));
      },
      story: function (proj) {
        return unique(R.pick(proj.storyVerbs) + ' ' + R.pick(proj.storyNouns));
      },
    };
  }

  function createKeyer(R) {
    var counters = {};
    return function (prefix) {
      counters[prefix] = (counters[prefix] || 0) + 1 + R.int(0, 4);
      return prefix + '-' + counters[prefix];
    };
  }

  // =========================================================================
  // The correlation model
  // =========================================================================

  function sampleArchetype(R, rank) {
    var healthyBoost = Math.max(0.25, 1.45 - 0.3 * (rank - 1));
    var unplannedBoost = 1 + 0.06 * (rank - 1);
    return R.weighted([
      ['healthy', 0.34 * healthyBoost],
      ['thinning', 0.3],
      ['unplanned', 0.22 * unplannedBoost],
      ['overplanned', 0.15],
    ]);
  }

  function timeFactor(archetype, startOffset) {
    if (archetype === 'overplanned') return 1;
    if (startOffset < 45) return 1;
    if (startOffset < 120) return 0.9;
    if (startOffset < 240) return 0.7;
    return 0.5;
  }

  /**
   * The single scalar every other decision hangs off. See header comment.
   */
  function planningPressure(archetype, level, rank, parentRung, startOffset) {
    var p = ARCHETYPE_BASE[archetype];
    p *= Math.pow(ARCHETYPE_RANK_DECAY[archetype], rank - 1);
    if (parentRung !== null) p *= PARENT_FACTOR[parentRung];
    p *= timeFactor(archetype, startOffset);
    // Stories that exist at all have usually had *some* thought put in.
    if (level === 'story') p = p * 0.85 + 0.15;
    return clamp(p, 0.02, 0.98);
  }

  /** Turn planning pressure into an intended rung. */
  function sampleRung(R, p) {
    var w0 = Math.pow(1 - p, 2.0) * 1.6 + 0.02;
    var w1 = (1 - p) * p * 2.2 + 0.15;
    var w2 = Math.pow(p, 1.5) * 0.9 + 0.08;
    var w3 = Math.pow(p, 2.6) * 2.0 + 0.01;
    return R.weighted([
      [0, w0],
      [1, w1],
      [2, w2],
      [3, w3],
    ]);
  }

  function sampleChildCount(R, level, archetype, p, startOffset) {
    if (level === 'story') return 0;
    if (level === 'direction') {
      // A direction always has at least one increment under it.
      return R.weighted([
        [1, 0.1],
        [2, 0.2],
        [3, 0.25],
        [4, 0.2],
        [5, 0.15],
        [6, 0.1],
      ]);
    }

    // Decays with rank (via p) and with distance into the future, but the time
    // penalty is softened so that mid-horizon work still breaks down. Failing
    // this roll is what produces "0 epics" / "0 stories" items.
    var breakdown = clamp(
      (0.64 + 0.36 * p) *
        (0.7 + 0.3 * timeFactor(archetype, startOffset)) *
        ARCHETYPE_BREAKDOWN[archetype] *
        LEVEL_BREAKDOWN[level],
      0,
      0.94,
    );
    if (!R.chance(breakdown)) return 0;

    if (level === 'increment') {
      return R.weighted([
        [1, 0.14],
        [2, 0.22],
        [3, 0.24],
        [4, 0.18],
        [5, 0.13],
        [6, 0.09],
      ]);
    }
    // Epic -> stories. Mostly 3-8, a long tail of monsters.
    var bucket = R.weighted([
      ['small', 0.62],
      ['medium', 0.24],
      ['huge', 0.14],
    ]);
    if (bucket === 'small') return R.int(3, 8);
    if (bucket === 'medium') return R.int(9, 14);
    return R.int(15, 20);
  }

  function sampleExec(R, startOffset, endOffset, rungTarget) {
    var exec;
    if (endOffset < -7) {
      exec = R.chance(0.88) ? 'done' : 'inprogress';
    } else if (startOffset > 45) {
      exec = R.chance(0.94) ? 'todo' : 'inprogress';
    } else {
      // Straddling "now": this is where an epic gets its done/doing/todo mix.
      var r = R.rnd();
      exec = r < 0.5 ? 'inprogress' : r < 0.74 ? 'done' : 'todo';
    }
    // Barely-planned work is normally untouched — but not always. The
    // survivors here are the "work started with no plan" contradiction.
    if (rungTarget <= 1 && exec !== 'todo') {
      exec = R.chance(WILD_START_P) ? 'inprogress' : 'todo';
    }
    return exec;
  }

  function pickStatus(R, exec, fieldsRung, rungTarget) {
    if (exec === 'inprogress') return R.pick(INPROGRESS_STATUSES);
    if (exec === 'done') return R.pick(DONE_STATUSES);

    var statusRung = fieldsRung > 0 ? fieldsRung : rungTarget >= 1 ? 1 : 0;
    if (R.chance(OVERCLAIM_P)) {
      statusRung = Math.min(3, statusRung + (statusRung === 0 || R.chance(0.35) ? 2 : 1));
    }
    return R.pick(RUNG_STATUSES[statusRung]);
  }

  /**
   * Evidence comes from the ROLLED-UP values, not just the item's own fields.
   * An increment with no dates of its own whose epics are all scheduled really is
   * scheduled — the plan exists, it just lives one level down. Provenance (own vs
   * inherited) is carried separately by `estimateSource` / `dateSource`.
   * Must run after rollUp().
   */
  function evidenceRung(node) {
    if (node.rollupStart !== null) return 3;
    if (node.rollupEstimate > 0) return 2;
    return STATUS_TO_RUNG[node.status.toLowerCase()] === 1 ? 1 : 0;
  }

  // =========================================================================
  // Node construction
  // =========================================================================

  function buildNode(R, ctx) {
    var level = ctx.level;
    var archetype = ctx.archetype;
    var win = ctx.win;

    var p = planningPressure(archetype, level, ctx.rank, ctx.parentRung, win.start);
    var rungTarget = sampleRung(R, p);
    var childCount = sampleChildCount(R, level, archetype, p, win.start);

    // --- own vs rolled ----------------------------------------------------
    var rolled = childCount > 0 && R.chance(ROLLED_PREFERENCE[level]);

    var ownEstimate = null;
    var ownStartOffset = null;
    var ownDueOffset = null;

    if (!rolled) {
      if (rungTarget >= 2 && (rungTarget < 3 || R.chance(0.85))) {
        ownEstimate = R.pick(POINT_POOLS[level]);
      }
      if (rungTarget >= 3) {
        var span = SPAN_DAYS[level];
        var available = win.end - win.start;
        var length = Math.max(1, Math.min(R.int(span[0], span[1]), available));
        ownStartOffset = win.start + R.int(0, Math.max(0, available - length));
        ownDueOffset = ownStartOffset + length;
      }
    } else if (rungTarget >= 2 && R.chance(DATED_ROLLUP_P[level])) {
      var spanR = SPAN_DAYS[level];
      var availableR = win.end - win.start;
      var lengthR = Math.max(1, Math.min(R.int(spanR[0], spanR[1]), availableR));
      ownStartOffset = win.start + R.int(0, Math.max(0, availableR - lengthR));
      ownDueOffset = ownStartOffset + lengthR;
    }

    // --- execution --------------------------------------------------------
    var execStart = ownStartOffset === null ? win.start : ownStartOffset;
    var execEnd = ownDueOffset === null ? win.end : ownDueOffset;
    var exec = sampleExec(R, execStart, execEnd, rungTarget);

    // Something being worked on usually acquired dates at some point — unless
    // it is a pure rollup parent, or was never planned at all.
    if (exec !== 'todo' && ownStartOffset === null && !rolled && rungTarget >= 2 && R.chance(0.8)) {
      var span2 = SPAN_DAYS[level];
      var available2 = win.end - win.start;
      var length2 = Math.max(1, Math.min(R.int(span2[0], span2[1]), available2));
      ownStartOffset = win.start + R.int(0, Math.max(0, available2 - length2));
      ownDueOffset = ownStartOffset + length2;
    }

    var hasOwnDates = ownStartOffset !== null;
    var hasOwnEstimate = ownEstimate !== null;
    var fieldsRung = hasOwnDates ? 3 : hasOwnEstimate ? 2 : 0;

    var status = pickStatus(R, exec, fieldsRung, rungTarget);

    // Only a parent can leave an end blank: the missing end rolls up from its children.
    var keep = 'both';
    if (hasOwnDates && childCount > 0 && R.chance(PARTIAL_DATES_P)) keep = R.chance(0.5) ? 'start' : 'due';

    var node = {
      key: ctx.nextKey(ctx.project.prefix),
      name: ctx.namer[level](ctx.project),
      level: level,
      rank: ctx.rank,
      status: status,
      claimedRung: STATUS_TO_RUNG[status.toLowerCase()],
      evidencedRung: 0, // filled in by rollUp(), which needs the children first
      exec: exec,
      ownEstimate: ownEstimate,
      ownStart: hasOwnDates && keep !== 'due' ? offsetToISO(ownStartOffset) : null,
      ownDue: hasOwnDates && keep !== 'start' ? offsetToISO(ownDueOffset) : null,
      rollupEstimate: 0,
      rollupStart: null,
      rollupDue: null,
      estimateSource: 'none',
      dateSource: 'none',
      startSource: 'none',
      dueSource: 'none',
      children: [],
    };
    if (level === 'direction') node.archetype = archetype;

    // --- children ---------------------------------------------------------
    // Children live inside this node's OWN dates when it has them, otherwise
    // inside its tentative window. The one deliberate leak: OVERRUN lets them
    // run past the parent's own due, which is the date conflict the view shows.
    if (childCount > 0) {
      var childWin = win;
      if (keep === 'start') childWin = makeWindow(ownStartOffset, win.end);
      else if (keep === 'due') childWin = makeWindow(win.start, ownDueOffset);
      else if (hasOwnDates) {
        var od = OVERRUN_DAYS[level];
        var overrun = R.chance(OVERRUN_P) ? R.int(od[0], od[1]) : 0;
        childWin = makeWindow(ownStartOffset, ownDueOffset + overrun);
      }
      var childLevel = LEVELS[LEVELS.indexOf(level) + 1];
      var spread = archetype === 'overplanned' ? 0.95 : 0.8;
      for (var i = 0; i < childCount; i++) {
        node.children.push(
          buildNode(R, {
            level: childLevel,
            rank: i + 1,
            archetype: archetype,
            parentRung: rungTarget,
            win: allocateWindow(R, childWin, i + 1, childCount, spread),
            project: ctx.project,
            namer: ctx.namer,
            nextKey: ctx.nextKey,
          }),
        );
      }
    }

    rollUp(node);
    return node;
  }

  /** Bottom-up: run only after children exist. */
  function rollUp(node) {
    if (node.ownEstimate !== null) {
      node.rollupEstimate = node.ownEstimate;
      node.estimateSource = 'own';
    } else {
      var sum = 0;
      for (var i = 0; i < node.children.length; i++) sum += node.children[i].rollupEstimate;
      node.rollupEstimate = sum;
      node.estimateSource = sum > 0 ? 'rolled' : 'none';
    }

    // parentFirstThenChildren, per END: each end is own if set, else rolled from children.
    var min = null;
    var max = null;
    for (var j = 0; j < node.children.length; j++) {
      var c = node.children[j];
      if (c.rollupStart !== null && (min === null || c.rollupStart < min)) min = c.rollupStart;
      if (c.rollupDue !== null && (max === null || c.rollupDue > max)) max = c.rollupDue;
    }
    node.rollupStart = node.ownStart !== null ? node.ownStart : min;
    node.rollupDue = node.ownDue !== null ? node.ownDue : max;
    node.startSource = node.ownStart !== null ? 'own' : min !== null ? 'rolled' : 'none';
    node.dueSource = node.ownDue !== null ? 'own' : max !== null ? 'rolled' : 'none';
    node.dateSource =
      node.startSource === 'none' || node.dueSource === 'none'
        ? 'none'
        : node.startSource === node.dueSource
          ? node.startSource
          : 'mixed';

    node.evidencedRung = evidenceRung(node);
  }

  // =========================================================================
  // Public API
  // =========================================================================

  function generatePortfolio(opts) {
    opts = opts || {};
    var seed = typeof opts.seed === 'number' && isFinite(opts.seed) ? opts.seed >>> 0 : (Date.now() ^ 0x9e3779b9) >>> 0;
    var directionCount = typeof opts.directionCount === 'number' ? Math.max(1, opts.directionCount | 0) : 4;

    var R = createRandom(seed);
    var namer = createNamer(R);
    var nextKey = createKeyer(R);

    var directions = [];
    for (var i = 0; i < directionCount; i++) {
      var rank = i + 1;
      var archetype = sampleArchetype(R, rank);
      var base = ARCHETYPE_WINDOW[archetype];
      // Lower-ranked directions start a little later than higher-ranked ones.
      var shift = (rank - 1) * 12;
      var win = makeWindow(clamp(base[0] + shift, -90, 400), clamp(base[1] + shift, -89, 430));

      directions.push(
        buildNode(R, {
          level: 'direction',
          rank: rank,
          archetype: archetype,
          parentRung: null,
          win: win,
          project: PROJECTS[i % PROJECTS.length],
          namer: namer,
          nextKey: nextKey,
        }),
      );
    }

    return {
      seed: seed,
      today: TODAY_ISO,
      conversion: { pointsPerDayPerTrack: POINTS_PER_DAY_PER_TRACK },
      directions: directions,
    };
  }

  return {
    generatePortfolio: generatePortfolio,
    RUNG_LABELS: RUNG_LABELS,
    STATUS_TO_RUNG: STATUS_TO_RUNG,
  };
});
