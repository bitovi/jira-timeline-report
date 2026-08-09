import { tagsToDate } from '../src/utils/date/half-quarters.js';

/**
 * POST /tag-to-dates — turns a half-quarter planning tag into a date, for Jira
 * Automation rules that write an issue's Start date or Due date from a label.
 *
 * Send exactly one of `startTag` or `endTag`. Either accepts a single tag, a
 * comma-separated list, or an array; with a list, `startTag` resolves to the
 * earliest start and `endTag` to the latest end.
 */
export default function tagToDates(req, res) {
  const { startTag, endTag } = req.body ?? {};

  const hasStart = startTag !== undefined && startTag !== null;
  const hasEnd = endTag !== undefined && endTag !== null;

  if (hasStart && hasEnd) {
    return res.status(400).json({ errors: ['Provide startTag or endTag, not both.'] });
  }
  if (!hasStart && !hasEnd) {
    return res.status(400).json({ errors: ['Provide startTag or endTag.'] });
  }

  const isEndDate = hasEnd;
  const date = tagsToDate(isEndDate ? endTag : startTag, { isEndDate });

  if (!date) {
    return res.status(400).json({
      errors: [`No valid half-quarter tag found in ${isEndDate ? 'endTag' : 'startTag'}.`],
    });
  }

  const isoDate = date.toISOString();

  return res.status(200).json({ isoDate, isoDay: isoDate.split('T')[0] });
}
