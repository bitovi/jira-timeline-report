import { mostCommonElement } from '../../utils/array/array-helpers';

/**
 *
 * @param {Array<import("../../../jira/normalized/normalize.js").NormalizedIssue>} normalizedIssues
 * @returns {Array<{type: string, hierarchyLevel: number}>}
 */
export function issueHierarchyFromNormalizedIssues(normalizedIssues) {
  const levelsToNames = [];
  for (let issue of normalizedIssues) {
    if (!levelsToNames[issue.hierarchyLevel]) {
      levelsToNames[issue.hierarchyLevel] = [];
    }
    levelsToNames[issue.hierarchyLevel].push(issue.type);
  }
  return levelsToNames
    .map((names, i) => {
      return { name: mostCommonElement(names), hierarchyLevel: i };
    })
    .filter((i) => i)
    .reverse();
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
