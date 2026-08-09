import { roundToHalfQuarterStart, roundToHalfQuarterEnd } from '../src/utils/date/half-quarters.js';

/**
 * POST /dates-to-half-quarter-dates — snaps an issue's start and due dates out to the
 * half-quarter they fall in, for Jira Automation rules that normalise hand-entered dates.
 *
 * Ported from jira-auto-scheduler, whose host is being retired. The response shape and
 * validation messages are kept verbatim so existing rules only need their URL changed.
 * Note the `{ error: string }` shape is this endpoint's own — its two siblings each use a
 * different one, inherited the same way.
 */

/** @returns {Date | null} null when absent; Invalid Date when unparseable. */
function toDate(value) {
  // Upstream treated any falsy value — absent, null, empty string — as "not supplied",
  // and a date-only string parses as UTC midnight, so no timezone handling is needed.
  return value ? new Date(value) : null;
}

const isUnparseable = (date) => date !== null && Number.isNaN(date.getTime());

const toIsoDay = (date) => (date ? date.toISOString().split('T')[0] : null);

export default function datesToHalfQuarterDates(req, res) {
  const { startDate, dueDate } = req.body ?? {};

  const start = toDate(startDate);
  const due = toDate(dueDate);

  if (isUnparseable(start)) {
    return res.status(400).json({ error: 'Invalid startDate format. Use "YYYY-MM-DD".' });
  }
  if (isUnparseable(due)) {
    return res.status(400).json({ error: 'Invalid dueDate format. Use "YYYY-MM-DD".' });
  }

  const roundedStartDate = start && roundToHalfQuarterStart(start);
  let roundedDueDate = due && roundToHalfQuarterEnd(due);

  // Rounding the two independently can invert them — a due date early in the range rounds
  // back behind a start date that rounded forward. Give the start's own half-quarter its
  // full length instead of returning a range that ends before it begins.
  if (roundedStartDate && roundedDueDate && roundedDueDate < roundedStartDate) {
    roundedDueDate = roundToHalfQuarterEnd(roundedStartDate);
  }

  return res.status(200).json({
    roundedStartDate: toIsoDay(roundedStartDate),
    roundedDueDate: toIsoDay(roundedDueDate),
  });
}
