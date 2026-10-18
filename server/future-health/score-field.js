function readIssueField(issue, fieldKey) {
  return issue?.fields?.[fieldKey] ?? issue?.[fieldKey];
}

import { scoreRichTextSections } from './score-rich-text-sections.js';
import { scoreRollup } from './score-rollup.js';

const DEFAULT_HEADINGS = ['Problem', 'Opportunity', 'Measure of Success', 'Solution', 'Out of Scope', 'Investment', 'Rationale'];

export function scoreField({ fieldKey, config, issue, descendants, now }) {
  if (typeof config === 'number') {
    return scoreRollup({ fieldKey, weight: config, issue, descendants, now });
  }

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

  if (config.type === 'unique-increment' || config.type === 'unique-workstream') {
    const summary = scoreRichTextSections({ html: readIssueField(issue, fieldKey) ?? '', headings: DEFAULT_HEADINGS });
    const completedValue = summary.count > 0 ? (config.options.completed ?? 100) : (config.options.incomplete ?? 0);
    const maxScore = 100 * config.weight;

    return {
      fieldKey,
      fieldType: config.type,
      score: completedValue * config.weight,
      maxScore,
      passed: summary.count > 0,
      reasons: summary.count === summary.total ? undefined : [`Missing template sections: ${summary.missing.join(', ')}`],
    };
  }

  throw new Error(`Unsupported field type: ${config.type}`);
}
