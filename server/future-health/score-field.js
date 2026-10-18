function readIssueField(issue, fieldKey) {
  return issue?.fields?.[fieldKey] ?? issue?.[fieldKey];
}

export function scoreField({ fieldKey, config, issue }) {
  if (config.type === 'presence') {
    const hasValue = Boolean(readIssueField(issue, fieldKey));
    const maxScore = 100 * config.weight;

    return {
      fieldKey,
      fieldType: 'presence',
      score: hasValue ? maxScore : 0,
      maxScore,
      passed: hasValue,
      reasons: hasValue ? undefined : [`${fieldKey} has no value`],
    };
  }

  if (config.type === 'dropdown') {
    const rawValue = readIssueField(issue, fieldKey);
    const optionValue = config.options?.[rawValue] ?? 0;
    const maxScore = 100 * config.weight;

    return {
      fieldKey,
      fieldType: 'dropdown',
      score: optionValue * config.weight,
      maxScore,
      passed: optionValue > 0,
      reasons: optionValue > 0 ? undefined : [`${fieldKey} did not match a configured option`],
    };
  }

  throw new Error(`Unsupported field type: ${config.type}`);
}
