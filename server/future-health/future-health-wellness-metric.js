import { validateFutureHealthRequest } from './validate-future-health-request.js';

export default function futureHealthWellnessMetric(req, res) {
  const { errors } = validateFutureHealthRequest(req.params?.issueKey, req.body);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  return res.status(200).json({
    futureHealthMetricScore: 0,
    issueTypeSummaries: [],
  });
}
