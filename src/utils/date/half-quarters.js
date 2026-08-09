// HALF QUARTER
// Boundary dates that a half-quarter starts on, in [month, day] form, ordered
// Q1.T1, Q1.T2, Q2.T1, ... Q4.T2. Shared with `round.js`, which rounds arbitrary
// dates to the nearest of these, so both agree on where a half-quarter falls.
export const HALF_QUARTERS = [
  [1, 1], // Jan 1
  [2, 15], // Feb 15
  [4, 1], // Apr 1
  [5, 15], // May 15
  [7, 1], // Jul 1
  [8, 15], // Aug 15
  [10, 1], // Oct 1
  [11, 15], // Nov 15
];

/**
 * Matches a tag *ending* in a half-quarter, so prefixes come along for free:
 * `2026.Q1.T1`, `FY26.Q1`, `my-tag-25.Q2.T1`.
 */
const HALF_QUARTER_TAG = /(\d{4}|\d{2})\.Q([1-4])(?:\.?T?(\d))?$/;

/**
 * @param {unknown} text
 * @returns {{ year: number, quarter: number, half: 1 | 2 | null } | null}
 *   `half` is null for a whole-quarter tag. Any half other than T1/T2 is also
 *   reported as null, so it falls back to whole-quarter bounds.
 */
export function parseHalfQuarterTag(text) {
  const match = typeof text === 'string' ? text.match(HALF_QUARTER_TAG) : null;
  if (!match) return null;

  const [, yearText, quarterText, halfText] = match;

  return {
    year: yearText.length === 4 ? Number(yearText) : 2000 + Number(yearText),
    quarter: Number(quarterText),
    half: halfText === '1' || halfText === '2' ? Number(halfText) : null,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Nth half-quarter boundary counting forward from Q1.T1 of `year`. An index past
 * the end of the table rolls into the following year, so Q4's end can reach Jan 1.
 *
 * @returns {number} epoch ms at UTC midnight
 */
function boundaryTime(year, index) {
  const [month, day] = HALF_QUARTERS[index % HALF_QUARTERS.length];
  return Date.UTC(year + Math.floor(index / HALF_QUARTERS.length), month - 1, day);
}

/**
 * @param {unknown} text
 * @param {{ isEndDate?: boolean }} [options]
 * @returns {Date | null} UTC midnight on the boundary, or null if `text` isn't a tag.
 */
export function halfQuarterTagToDate(text, { isEndDate = false } = {}) {
  const parsed = parseHalfQuarterTag(text);
  if (!parsed) return null;

  const { year, quarter, half } = parsed;
  const start = (quarter - 1) * 2 + (half === 2 ? 1 : 0);

  if (!isEndDate) return new Date(boundaryTime(year, start));

  // A period ends the day before the next one starts. A whole-quarter tag spans
  // two half-quarters, so its end is two boundaries along rather than one.
  return new Date(boundaryTime(year, start + (half === null ? 2 : 1)) - MS_PER_DAY);
}

/**
 * Every half-quarter boundary in the years surrounding `date`, as epoch ms at UTC
 * midnight. Spanning the neighbouring years means the nearest boundary to a date in
 * late December or early January is found without a special case.
 *
 * @param {Date} date
 * @returns {number[]} ascending
 */
function surroundingBoundaries(date) {
  const year = date.getUTCFullYear();

  return [year - 1, year, year + 1].flatMap((candidateYear) =>
    HALF_QUARTERS.map(([month, day]) => Date.UTC(candidateYear, month - 1, day)),
  );
}

/**
 * Rounds to the nearest half-quarter start.
 *
 * The equivalent in `round.js` builds its candidates in local time, which is right for
 * the browser but makes a server's answer depend on its timezone; this one is UTC
 * throughout. Both read the same `HALF_QUARTERS` table, so they cannot disagree about
 * where a boundary falls.
 *
 * @param {Date} date
 * @returns {Date} UTC midnight on the nearest boundary
 */
export function roundToHalfQuarterStart(date) {
  const time = date.getTime();

  const nearest = surroundingBoundaries(date).reduce((best, candidate) =>
    Math.abs(candidate - time) < Math.abs(best - time) ? candidate : best,
  );

  return new Date(nearest);
}

/**
 * Rounds to the nearest half-quarter end — the day before a boundary — that is not
 * before `date`.
 *
 * Unlike the upstream implementation this ports, the candidate list always reaches into
 * the following year. Upstream only did so for a date in December, so a date between
 * Nov 15 and Nov 30 had no candidate at or after it and rounded to null.
 *
 * @param {Date} date
 * @returns {Date} UTC midnight on the nearest boundary end
 */
export function roundToHalfQuarterEnd(date) {
  const time = date.getTime();

  const nearest = surroundingBoundaries(date)
    .map((boundary) => boundary - MS_PER_DAY)
    .filter((end) => end >= time)
    .reduce((best, end) => (end - time < best - time ? end : best));

  return new Date(nearest);
}

/**
 * Splits input into candidate tags. Jira Automation renders `{{issue.labels}}`
 * into a request body as comma-separated text, so a caller may hand us one tag,
 * a list of them, or an array of either.
 *
 * @param {unknown} input
 * @returns {string[]}
 */
function toCandidates(input) {
  const entries = Array.isArray(input) ? input : [input];

  return entries
    .filter((entry) => typeof entry === 'string')
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Resolves one or more tags to a single date: the earliest start, or the latest
 * end. Entries that aren't tags are ignored.
 *
 * @param {unknown} input a tag, a comma-separated list, or an array of either
 * @param {{ isEndDate?: boolean }} [options]
 * @returns {Date | null} null when nothing parses; never throws
 */
export function tagsToDate(input, { isEndDate = false } = {}) {
  const times = toCandidates(input)
    .map((candidate) => halfQuarterTagToDate(candidate, { isEndDate }))
    .filter(Boolean)
    .map((date) => date.getTime());

  if (!times.length) return null;

  return new Date(isEndDate ? Math.max(...times) : Math.min(...times));
}
