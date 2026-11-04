export function validateFutureHealthRequest(issueKey, body) {
  const errors = [];
  const safeBody = body ?? {};

  if (!issueKey) {
    errors.push({ message: 'issueKey path param is required' });
  }

  if (!Array.isArray(safeBody.issues)) {
    errors.push({ message: 'issues must be an array' });
  }

  if (!safeBody.model || typeof safeBody.model !== 'object' || Array.isArray(safeBody.model)) {
    errors.push({ message: 'model must be an object' });
  }

  if (safeBody.debug !== undefined && typeof safeBody.debug !== 'boolean') {
    errors.push({ message: 'debug must be a boolean when provided' });
  }

  return {
    errors,
    normalizedRequest: errors.length
      ? null
      : {
          issueKey,
          issues: safeBody.issues,
          model: safeBody.model,
          debug: safeBody.debug ?? false,
        },
  };
}
