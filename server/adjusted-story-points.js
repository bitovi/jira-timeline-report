import { estimateExtraPoints } from '../src/utils/math/confidence.js';

/**
 * POST /adjusted-story-points — inflates a median estimate by a risk buffer derived
 * from how confident the estimate is, for Jira Automation rules that write a
 * risk-adjusted point value onto an issue.
 *
 * Ported from jira-auto-scheduler, whose host is being retired. The response shape
 * and validation messages are kept verbatim so existing rules only need their URL
 * changed. Note the `{ errors: [{ message }] }` shape differs from the sibling
 * `/tag-to-dates`, which upstream gave a plain `{ errors: [string] }`; each matches
 * its own predecessor rather than each other.
 */

/** Each returns a message when `value` is unusable, or undefined when it's fine. */
const VALIDATORS = {
  storyPointsMedian(value) {
    if (value === undefined) return 'storyPointsMedian is undefined';
    if (typeof value !== 'number') return 'storyPointsMedian is not a number';
    if (value < 0) return 'storyPointsMedian is negative';
  },
  storyPointsConfidence(value) {
    if (value === undefined) return 'storyPointsConfidence is undefined';
    if (typeof value !== 'number') return 'storyPointsConfidence is not a number';
    if (value < 0) return 'storyPointsConfidence is negative';
    if (value > 100) return 'storyPointsConfidence is greater than 100';
  },
  // Optional. Upstream never checked this, so a non-numeric threshold produced NaN
  // and serialized as a body of nulls; reject it instead.
  riskThreshold(value) {
    if (value === undefined || value === 'average') return;
    if (typeof value !== 'number') return 'riskThreshold is not a number';
    if (value < 0) return 'riskThreshold is negative';
    if (value > 100) return 'riskThreshold is greater than 100';
  },
};

const DEFAULT_RISK_THRESHOLD = 80;

export default function adjustedStoryPoints(req, res) {
  const body = req.body ?? {};

  const errors = Object.entries(VALIDATORS)
    .map(([field, validate]) => validate(body[field]))
    .filter(Boolean)
    .map((message) => ({ message }));

  if (errors.length) return res.status(400).json({ errors });

  const { storyPointsMedian, storyPointsConfidence } = body;
  // `??`, not `||` as upstream had it, so an explicit 0 asks for the 0th percentile
  // rather than silently becoming the default.
  const riskThreshold = body.riskThreshold ?? DEFAULT_RISK_THRESHOLD;

  const extraStoryPoints = estimateExtraPoints(storyPointsMedian, storyPointsConfidence, riskThreshold);
  const adjustedStoryPoints = storyPointsMedian + extraStoryPoints;

  return res.status(200).json({
    adjustedStoryPoints,
    extraStoryPoints,
    roundedExtraStoryPoints: Math.round(extraStoryPoints),
    roundedAdjustedStoryPoints: Math.round(adjustedStoryPoints),
  });
}
