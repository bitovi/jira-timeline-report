import { scoreField } from './score-field.js';

function getIssueType(issue) {
  return issue?.fields?.issuetype?.name ?? issue?.issuetype?.name ?? null;
}

function getParentKey(issue) {
  return issue?.fields?.parent?.key ?? issue?.parent?.key ?? null;
}

function flattenLevels(model, levels = []) {
  levels.push(model);

  if (model.child) {
    flattenLevels(model.child, levels);
  }

  return levels;
}

function collectKnownIssueTypes(model, types = new Set()) {
  types.add(model.issueType);

  if (model.child) {
    collectKnownIssueTypes(model.child, types);
  }

  return types;
}

function findIssuesForLevel(parentIssue, issues, level) {
  if (!level) {
    return [];
  }

  return issues.filter((issue) => getIssueType(issue) === level.issueType && getParentKey(issue) === parentIssue.key);
}

function collectDescendants(issue, level, allIssues) {
  if (!level?.child) {
    return [];
  }

  const childIssues = findIssuesForLevel(issue, allIssues, level.child);

  return childIssues.flatMap((childIssue) => [childIssue, ...collectDescendants(childIssue, level.child, allIssues)]);
}

function scoreLevel(issue, level, allIssues, now) {
  const fieldEntries = Object.entries(level.fields ?? {}).filter(([, value]) => value !== undefined);
  const descendants = collectDescendants(issue, level, allIssues);
  const fieldResults = fieldEntries.map(([fieldKey, config]) =>
    scoreField({ fieldKey, config, issue, descendants, now }),
  );
  const issueScore = fieldResults.reduce((total, field) => total + field.score, 0);
  const childIssues = level.child ? findIssuesForLevel(issue, allIssues, level.child) : [];

  if (level.child && childIssues.length === 0) {
    throw new Error(`Expected at least one ${level.child.issueType} child for ${issue.key}`);
  }

  const childResults = childIssues.flatMap((childIssue) => scoreLevel(childIssue, level.child, allIssues, now));

  return [
    { issueKey: issue.key, issueType: level.issueType, score: issueScore, fields: fieldResults },
    ...childResults,
  ];
}

export function scoreFutureHealth({ issueKey, issues, model, debug, now = new Date() }) {
  const rootIssue = issues.find((issue) => issue.key === issueKey);

  if (!rootIssue) {
    throw new Error(`Top-level issue ${issueKey} was not found in issues`);
  }

  if (getIssueType(rootIssue) !== model.issueType) {
    throw new Error(`Top-level issue ${issueKey} does not match root model issueType ${model.issueType}`);
  }

  const knownIssueTypes = collectKnownIssueTypes(model);
  const issueResults = scoreLevel(rootIssue, model, issues, now);
  const groupedResults = new Map();

  for (const result of issueResults) {
    const group = groupedResults.get(result.issueType) ?? [];
    group.push(result);
    groupedResults.set(result.issueType, group);
  }

  const ignoredIssues = issues
    .filter((issue) => !knownIssueTypes.has(getIssueType(issue)))
    .map((issue) => ({
      issueKey: issue.key,
      issueType: getIssueType(issue),
      reason: 'Issue type is not part of the provided model hierarchy',
    }));

  const issueTypeSummaries = flattenLevels(model).map((level) => {
    const issuesForType = groupedResults.get(level.issueType) ?? [];
    const rawScore = issuesForType.length
      ? issuesForType.reduce((sum, issueResult) => sum + issueResult.score, 0) / issuesForType.length
      : 0;

    const summary = {
      issueType: level.issueType,
      issueCount: issuesForType.length,
      rawScore,
      weightedScore: rawScore * level.weight,
      weight: level.weight,
    };

    if (debug) {
      summary.issues = issuesForType;
    }

    return summary;
  });

  const futureHealthMetricScore = issueTypeSummaries.reduce((sum, summary) => sum + summary.weightedScore, 0);

  if (debug) {
    return { futureHealthMetricScore, issueTypeSummaries, ignoredIssues };
  }

  return { futureHealthMetricScore, issueTypeSummaries };
}
