import { nativeFetchJSON } from '../jira-oidc-helpers';

const REFERENCE_DATE = new Date(2024, 8, 21);
const DAY = 1000 * 60 * 60 * 24;

// http://localhost:3000/?primaryIssueType=Initiative&statusesToShow=Development%2CReady&primaryReportType=breakdown&secondaryReportType=breakdown&jql=parent+in+%28IMP-143%2C+IMP-147%29+Order+By+Rank&loadChildren=true

let PROMISE = null;

const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

export default function bitoviTrainingData(dateToShift) {
  if (PROMISE === null) {
    if (isNode) {
      PROMISE = Promise.resolve([{}]);
    } else {
      PROMISE = nativeFetchJSON('./examples/bitovi-training.json');
    }

    PROMISE.then(function (data) {
      const daysShift = Math.round((dateToShift.getTime() - REFERENCE_DATE.getTime()) / DAY) - 0;
      return adjustDateStrings(data, daysShift);
    });
  }

  return PROMISE;
}

let TRAINING_DATA_PROMISE = null;
export function bitoviTrainingIssueData() {
  if (TRAINING_DATA_PROMISE === null) {
    if (isNode) {
      TRAINING_DATA_PROMISE = Promise.resolve([{}]);
    } else {
      TRAINING_DATA_PROMISE = nativeFetchJSON('./examples/bitovi-training-issue-types.json');
    }
  }

  return TRAINING_DATA_PROMISE;
}

export function bitoviTrainingFields() {
  if (isNode) {
    return Promise.resolve([{}]);
  } else {
    return nativeFetchJSON('./examples/bitovi-training-fields.json');
  }
}

function adjustDateStrings(obj, days) {
  const dateRegex = /\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?([-+]\d{2}:\d{2})?)?/;

  function addDaysToDate(dateStr, daysToAdd) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString();
  }

  function formatDate(date, originalFormat) {
    if (originalFormat.includes('T') && originalFormat.includes('-0600')) {
      return date.replace('Z', '').replace(/\.\d{3}/, '') + '-0600';
    } else if (originalFormat.includes('T')) {
      return date.replace('Z', '');
    } else if (originalFormat.includes('-')) {
      return date.split('T')[0];
    } else {
      // Assumes format "yyyy-MM-dd HH:mm:ss.0"
      return date
        .replace('T', ' ')
        .replace('Z', '')
        .replace(/\.\d{3}/, '.0');
    }
  }

  for (let key in obj) {
    if (typeof obj[key] === 'string' && dateRegex.test(obj[key])) {
      const newDate = addDaysToDate(obj[key], days);
      obj[key] = formatDate(newDate, obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      adjustDateStrings(obj[key], days);
    } else if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map((item) => {
        if (typeof item === 'string' && dateRegex.test(item)) {
          const newDate = addDaysToDate(item, days);
          return formatDate(newDate, item);
        } else if (typeof item === 'object' && item !== null) {
          adjustDateStrings(item, days);
        }
        return item;
      });
    }
  }
  return obj;
}
