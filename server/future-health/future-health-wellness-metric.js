import { scoreFutureHealth } from './score-future-health.js';
import { validateFutureHealthRequest } from './validate-future-health-request.js';

export default function futureHealthWellnessMetric(req, res) {
  const { errors, normalizedRequest } = validateFutureHealthRequest(req.params?.issueKey, req.body);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  try {
    return res.status(200).json(scoreFutureHealth(normalizedRequest));
  } catch (error) {
    return res.status(400).json({ errors: [{ message: error.message }] });
  }
}
