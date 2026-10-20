function monthsBetween(now, dueDate) {
  return (dueDate.getUTCFullYear() - now.getUTCFullYear()) * 12 + dueDate.getUTCMonth() - now.getUTCMonth();
}

function latestDueDate(descendants) {
  const dueDates = descendants
    .map((issue) => issue?.fields?.duedate)
    .filter(Boolean)
    .map((value) => new Date(value));

  return dueDates.length ? dueDates.sort((left, right) => right - left)[0] : null;
}

function allDescendantsHaveStoryPoints(descendants) {
  return descendants.every(
    (child) => child?.fields?.['Story points'] !== undefined && child?.fields?.['Story points'] !== null,
  );
}

function scoreTimelineWeighting(weighting, visibilityMonths) {
  const months = weighting?.months ?? 0;
  const weight = weighting?.weight ?? 0;
  const ratio = months > 0 ? Math.max(0, Math.min(visibilityMonths / months, 1)) : 0;

  return {
    months,
    weight,
    ratio,
    scorePortion: ratio * weight,
    visibilityMonths,
  };
}

function scoreLegacyRollup({ fieldKey, weight, descendants, now }) {
  const maxScore = 100 * weight;
  const dueDate = latestDueDate(descendants);
  const monthDistance = dueDate ? monthsBetween(now, dueDate) : Number.NEGATIVE_INFINITY;
  const hasStoryPoints = allDescendantsHaveStoryPoints(descendants);

  if (fieldKey === 'defined') {
    const passed = monthDistance >= 6;
    return {
      fieldKey,
      fieldType: 'roll-up',
      score: passed ? maxScore : 0,
      maxScore,
      passed,
      reasons: passed ? undefined : ['Roll-up completion date is less than 6 months out'],
    };
  }

  if (fieldKey === 'refined') {
    const passed = monthDistance >= 3 && hasStoryPoints;
    return {
      fieldKey,
      fieldType: 'roll-up',
      score: passed ? maxScore : 0,
      maxScore,
      passed,
      reasons: passed ? undefined : ['Roll-up completion date is less than 3 months out or story points are missing'],
    };
  }

  if (fieldKey === 'roll-up') {
    const passed = monthDistance >= 6;
    return {
      fieldKey,
      fieldType: 'roll-up',
      score: passed ? maxScore : 0,
      maxScore,
      passed,
      reasons: passed ? undefined : ['Roll-up completion date is less than 6 months out'],
    };
  }

  throw new Error(`Unsupported roll-up field key: ${fieldKey}`);
}

export function scoreRollup({ fieldKey = 'roll-up', config, weight, descendants, now }) {
  if (config && typeof config === 'object' && config.defined && config.refined) {
    const dueDate = latestDueDate(descendants);
    const visibilityMonths = dueDate ? Math.max(0, monthsBetween(now, dueDate)) : 0;
    const defined = scoreTimelineWeighting(config.defined, visibilityMonths);
    const refined = scoreTimelineWeighting(config.refined, visibilityMonths);
    const totalStatusWeight = defined.weight + refined.weight;
    const progress = totalStatusWeight > 0 ? (defined.scorePortion + refined.scorePortion) / totalStatusWeight : 0;
    const maxScore = 100 * (config.weight ?? 0) * totalStatusWeight;

    return {
      fieldKey,
      fieldType: 'roll-up',
      score: maxScore * progress,
      maxScore,
      passed: visibilityMonths > 0,
      breakdown: { defined, refined },
      reasons: visibilityMonths > 0 ? undefined : ['Roll-up completion date is not in the future'],
    };
  }

  if (typeof weight === 'number') {
    return scoreLegacyRollup({ fieldKey, weight, descendants, now });
  }

  throw new Error('Unsupported roll-up configuration');
}
