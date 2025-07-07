import { mostCommonElement } from '../../utils/array/array-helpers';

/**
 *
 * @param {Array<import("../../../jira/normalized/normalize.js").NormalizedIssue>} normalizedIssues
 * @returns {Array<{type: string, hierarchyLevel: number}>}
 */
export function issueHierarchyFromNormalizedIssues(normalizedIssues) {
  if (!normalizedIssues || normalizedIssues.length === 0) {
    return [];
  }
  // hierarchyLevel could be -1 for subtasks. We need to support those.

  let minLevel = Infinity;
  let maxLevel = -Infinity;

  const levelsToNames = {};
  for (let issue of normalizedIssues) {
    if (!levelsToNames[issue.hierarchyLevel]) {
      minLevel = Math.min(minLevel, issue.hierarchyLevel);
      maxLevel = Math.max(maxLevel, issue.hierarchyLevel);
      levelsToNames[issue.hierarchyLevel] = [];
    }
    levelsToNames[issue.hierarchyLevel].push(issue.type);
  }
  const hierarchy = [];
  for (let i = minLevel; i <= maxLevel; i++) {
    if (levelsToNames[i]) {
      hierarchy.push({ name: mostCommonElement(levelsToNames[i]), hierarchyLevel: i });
    }
  }
  return hierarchy.reverse();
}

export function toSelectedParts(value) {
  if (value) {
    if (value.startsWith('Release-')) {
      return { primary: 'Release', secondary: value.substring('Release-'.length) };
    } else {
      return { primary: value };
    }
  } else {
    return undefined;
  }
}

export function makeAsyncFromObservableButStillSettableProperty(promiseProperty) {
  return {
    value({ resolve, listenTo, lastSet }) {
      listenTo(promiseProperty, ({ value }) => {
        value.then(resolve);
      });
      if (this[promiseProperty]) {
        this[promiseProperty].then(resolve);
      }
      listenTo(lastSet, (value) => {
        resolve(value);
      });
    },
  };
}
