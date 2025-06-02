// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache, key, value } from '../../can';
import { makeGetChildrenFromReportingIssues } from '../../jira/rollup/rollup';
import { FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES } from '../../jira/rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time';

/*
export const dateFormatter = new Intl.DateTimeFormat('en-US', { 
    month: 'short',  // Abbreviated month (e.g., "Oct")
    day: 'numeric',  // Numeric day (e.g., "20")
    year: 'numeric'  // Full year (e.g., "1982") 
});*/

export const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit', // Abbreviated month (e.g., "Oct")
  day: '2-digit', // Numeric day (e.g., "20")
  year: '2-digit', // Full year (e.g., "1982")
});

import SimpleTooltip from '../ui/simple-tooltip/simple-tooltip';

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Stats from '../../react/Stats/Stats';

export class EstimateBreakdown extends StacheElement {
  static view = `<div class="text-right"><button class="remove-button text-red-500 p-2 text-lg">X</button></div>
    <div class="p-4">
        {{# if( this.usedStoryPointsMedian(issue) ) }}

            <div class="flex gap-4 items-center mb-2 items-stretch">
                <div class="flex-col">
                    <div class="text-base text-neutral-801">&nbsp;</div>
                    <div class="text-right">Current:</div>
                    <div class="text-right text-xs">Last:</div>
                </div>
                <div>
                    <div class="text-base font-bold">Estimated Days</div>
                    {{ this.makeCurrentAndPreviousHTML("derivedTiming.deterministicTotalDaysOfWork") }}
                </div>
                <div class="text-center">=</div>
                <div class="flex-col">
                    <div class="text-base text-green-300">Adjusted Estimate</div>
                    {{ this.makeCurrentAndPreviousHTML("derivedTiming.deterministicTotalPoints") }}
                </div>
                <div class="align-middle"> ÷ </div>
                <div class="flex-col">
                    <div class="text-base text-blue-200">Points per Day per Parallel Track</div>
                    {{ this.makeCurrentAndPreviousHTML("team.pointsPerDayPerTrack") }}
                </div>
            </div>
            
            <div class="flex gap-4 items-center my-4 items-stretch">
                <div class="flex-col">
                    <div class="text-base text-neutral-801">&nbsp;</div>
                    <div class="text-right">Current:</div>
                    <div class="text-right text-xs">Last:</div>
                </div>
                <div class="flex-col">
                    <div class="text-base text-green-300">Adjusted Estimate</div>
                    {{ this.makeCurrentAndPreviousHTML("derivedTiming.deterministicTotalPoints") }}
                </div>
                <div>=</div>

                <div class="flex-col">
                    <div class="text-base text-neutral-801">Median Estimate</div>
                    {{ this.makeCurrentAndPreviousHTML("storyPointsMedian", "derivedTiming.isStoryPointsMedianValid") }}
                </div>
                <div>× LOGNORMINV(</div>
                <div class="flex-col">
                    <div class="text-base text-neutral-801">Confidence</div>
                    {{ this.makeCurrentAndPreviousHTML("derivedTiming.usedConfidence", "derivedTiming.isConfidenceValid", this.formatPercent) }}
                </div>
                <div>)</div>
            </div>

            
        {{ else }}

            <div class="flex gap-4 items-center mb-2 items-stretch">
                <div class="flex-col">
                    <div class="text-base text-neutral-801">&nbsp;</div>
                    <div class="text-right">Current:</div>
                    <div class="text-right text-xs">Last:</div>
                </div>
                <div>
                    <div class="text-base font-bold">Estimated Days</div>
                    {{ this.makeCurrentAndPreviousHTML("derivedTiming.deterministicTotalDaysOfWork") }}
                </div>
                <div class="text-center">=</div>
                <div class="flex-col">
                    <div class="text-base text-green-300">Estimate</div>
                    {{ this.makeCurrentAndPreviousHTML("derivedTiming.deterministicTotalPoints") }}
                </div>
                <div class="align-middle"> ÷ </div>
                <div class="flex-col">
                    <div class="text-base text-blue-200">Points per Day per Parallel Track</div>
                    {{ this.makeCurrentAndPreviousHTML("team.pointsPerDayPerTrack") }}
                </div>
            </div>
            
        {{/ }}

        {{# if(this.teamsAreTheSame() )}}
            <div class="flex gap-4 items-center mt-4 items-stretch">
                <div class="flex-col">
                    <div class="text-base text-blue-200">Points per Day per Track</div>
                    <div class="text-right">{{this.round( this.issue.team.pointsPerDayPerTrack, 2)}}</div>
                </div>
                <div class="text-center">=</div>
                <div class="flex-col">
                    <div class="text-base text-neutral-801">Estimate Points Per Sprint</div>
                    <div class="text-right">{{this.issue.team.velocity}}</div>
                </div>
                <div>÷</div>
                <div class="flex-col">
                    <div class="text-base text-neutral-801">Days Per Sprint</div>
                    <div class="text-right">{{this.issue.team.daysPerSprint}}</div>
                </div>
                <div>÷</div>
                <div class="flex-col">
                    <div class="text-base text-neutral-801">Parallel Work Tracks</div>
                    <div class="text-right">{{this.issue.team.parallelWorkLimit}}</div>
                </div>
                
                
                
            </div>
        {{else }}
            <div class="flex gap-4 items-center mt-4 items-stretch">
        
                <div class="flex-col">
                    <div class="text-base text-blue-200">Points per Day per Track</div>
                    {{ this.makeCurrentAndPreviousHTML("team.pointsPerDayPerTrack") }}
                </div>
                <div class="text-center">=</div>
                <div class="flex-col">
                    <div class="text-base text-neutral-801">Estimate Points Per Sprint</div>
                    {{ this.makeCurrentAndPreviousHTML("team.velocity") }}
                </div>
                <div>÷</div>
                <div class="flex-col">
                    <div class="text-base text-neutral-801">Parallel Work Tracks</div>
                    {{ this.makeCurrentAndPreviousHTML("team.parallelWorkLimit") }}
                </div>
                <div>÷</div>
                <div class="flex-col">
                    <div class="text-base text-neutral-801">Days Per Sprint</div>
                    {{ this.makeCurrentAndPreviousHTML("team.daysPerSprint") }}
                </div>
                
            </div>
        {{/ if }}
    </div>
    `;
  teamsAreTheSame() {
    if (!this.issue.issueLastPeriod) {
      return false;
    } else {
      return this.issue.issueLastPeriod.team === this.issue.team;
    }
  }
  makeCurrentAndPreviousHTML(valueKey, validKey, format = (x) => x) {
    const currentValue = key.get(this.issue, valueKey);
    const lastValue = this.issue.issueLastPeriod ? key.get(this.issue.issueLastPeriod, valueKey) : undefined;

    let isCurrentValueValid = true,
      lastValueValid = true;
    if (validKey) {
      isCurrentValueValid = key.get(this.issue, validKey);
      lastValueValid = this.issue.issueLastPeriod ? key.get(this.issue.issueLastPeriod, validKey) : undefined;
    }

    return stache.safeString(`
            <div class="text-right ${
              isCurrentValueValid === false ? 'bg-neutral-100' : ''
            }">${format(this.round(currentValue, 1))}</div>
            <div class="text-right text-xs ${lastValueValid === false ? 'bg-neutral-100' : ''}">
                ${this.issue.issueLastPeriod ? format(this.round(lastValue, 1)) : '🚫'}
            </div>    
        `);
  }
  formatPercent(value) {
    return value + '%';
  }
  usedStoryPointsMedian(issue) {
    return issue?.derivedTiming?.isStoryPointsMedianValid && issue?.derivedTiming?.usedConfidence !== 100;
  }
  confidenceValue(issue) {
    return issue?.derivedTiming?.usedConfidence;
  }
  confidenceClass(issue) {
    return issue?.derivedTiming?.isConfidenceValid ? '' : 'bg-neutral-100';
  }
  timingEquation(issue) {
    if (issue?.derivedTiming?.isStoryPointsMedianValid) {
      return (
        Math.round(issue.derivedTiming.deterministicTotalPoints) +
        ' / ' +
        issue.team.velocity +
        ' / ' +
        issue.team.parallelWorkLimit +
        ' * ' +
        issue.team.daysPerSprint +
        ' = ' +
        Math.round(issue.derivedTiming.deterministicTotalDaysOfWork)
      );
    }
  }
  round(number, decimals = 0) {
    return typeof number === 'number' ? parseFloat(number.toFixed(decimals)) : '∅';
  }
}
customElements.define('estimate-breakdown', EstimateBreakdown);

// <td>{{this.estimate(tableRow.issue)}}</td>
// <td>{{this.startDate( tableRow.issue ) }}</td>
// <td>{{this.endDate( tableRow.issue) }}</td>

// loops through and creates
export class TableGrid extends StacheElement {
  static view = `
        <div id="stats"></div>
        <table>
            <thead>
                <tr>
                    <th class="p-2">Summary</th>
                    <th class="p-2">Estimated Days</th>
                    <th class="p-2">Timed Days</th>
                    <th class="p-2">Rolled Up Days</th>
                </tr>
            </thead>
            {{# for(tableRow of this.tableRows) }}
                <tr on:click="console.log(tableRow.issue)">
                    <td style="{{this.padding(tableRow)}}" class="px-2 flex gap-2">
                        <img src:from="this.iconUrl(tableRow)" class="inline-block"/>
                        {{# not(eq(tableRow.issue.type, "Release")) }}
                            <a href="{{tableRow.issue.url}}" target="_blank"
                                class="link inline-block">{{tableRow.issue.key}}</a>
                        {{/ not }}
                        <span class="text-ellipsis truncate inline-block max-w-96">{{tableRow.issue.summary}}</span>
                    </td>
                    <td class="px-2 text-right" on:click="this.showEstimation(tableRow.issue, scope.event.target)">
                        {{this.estimatedDaysOfWork(tableRow.issue)}}
                    </td>
                    <td class="px-2 text-right">{{this.timedDays(tableRow.issue)}}</td>

                    <td class="px-2 text-right" on:click="">{{this.rolledUpDays(tableRow.issue)}}</td>
                </tr>
            {{/ for }}
        </table>
        
    `;
  static props = {
    columns: {
      get default() {
        return [
          {
            path: 'summary',
            name: 'Summary',
          },
          {
            path: 'rollupDates.start',
            name: 'Rollup Start',
          },
          {
            path: 'rollupDates.start',
            name: 'Rollup Due',
          },
        ];
      },
    },
  };

  get tableRows() {
    const getChildren = makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);

    function childrenRecursive(issue, depth = 0) {
      return [{ depth: depth, issue }, ...getChildren(issue).map((issue) => childrenRecursive(issue, depth + 1))];
    }

    let allChildren = this.primaryIssuesOrReleases.map((i) => childrenRecursive(i)).flat(Infinity);

    return allChildren;
  }
  padding(row) {
    return 'padding-left: ' + row.depth * 20 + 'px';
  }
  iconUrl(row) {
    return row.issue?.issue?.fields['Issue Type']?.iconUrl;
  }
  shortDate(date) {
    return date ? dateFormatter.format(date) : '';
  }
  startDate(issue) {
    return compareToLast(issue, (issue) => issue?.rollupDates?.start, formatDate);
  }
  endDate(issue) {
    return compareToLast(issue, (issue) => issue?.rollupDates?.due, formatDate);
  }
  estimate(issue) {
    return compareToLast(issue, getEstimate, (x) => x);
  }
  estimatedDaysOfWork(issue) {
    return compareToLast(
      issue,
      (issue) => {
        // if we have story points median, use that
        if (issue?.derivedTiming?.isStoryPointsMedianValid) {
          return issue.derivedTiming.deterministicTotalDaysOfWork;
        } else if (issue?.derivedTiming?.isStoryPointsValid) {
          return issue?.derivedTiming?.storyPointsDaysOfWork;
        }
      },
      (value) => {
        if (typeof value === 'number') {
          return Math.round(value);
        } else {
          return value;
        }
      },
    );
  }
  timedDays(issue) {
    return compareToLast(
      issue,
      (issue) => {
        // if we have story points median, use that
        if (issue?.derivedTiming?.datesDaysOfWork) {
          return issue?.derivedTiming?.datesDaysOfWork;
        }
      },
      (value) => {
        if (typeof value === 'number') {
          return Math.round(value);
        } else {
          return value;
        }
      },
    );
  }
  rolledUpDays(issue) {
    return compareToLast(
      issue,
      (issue) => {
        // if we have story points median, use that
        if (issue?.completionRollup?.totalWorkingDays) {
          return issue?.completionRollup?.totalWorkingDays;
        }
      },
      (value) => {
        if (typeof value === 'number') {
          return Math.round(value);
        } else {
          return value;
        }
      },
    );
  }
  timingEquation(issue) {
    if (issue?.derivedTiming?.isStoryPointsMedianValid) {
      return (
        Math.round(issue.derivedTiming.deterministicTotalPoints) +
        ' / ' +
        issue.team.velocity +
        ' / ' +
        issue.team.parallelWorkLimit +
        ' * ' +
        issue.team.daysPerSprint +
        ' = ' +
        Math.round(issue.derivedTiming.deterministicTotalDaysOfWork)
      );
    }
  }
  showEstimation(issue, element) {
    TOOLTIP.belowElementInScrollingContainer(
      element,
      new EstimateBreakdown().initialize({
        issue,
      }),
    );

    TOOLTIP.querySelector('.remove-button').onclick = () => {
      TOOLTIP.leftElement();
    };
  }
  connected() {
    if (FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES()) {
      createRoot(document.getElementById('stats')).render(
        createElement(Stats, {
          primaryIssuesOrReleasesObs: value.from(this, 'primaryIssuesOrReleases'),
        }),
      );
    }
  }
}

customElements.define('table-grid', TableGrid);

function getEstimate(issue) {
  if (issue?.derivedTiming?.isStoryPointsMedianValid) {
    return issue.storyPointsMedian + ' ' + issue.confidence + '%';
  } else if (issue?.storyPoints != null) {
    return issue.storyPoints;
  } else {
    return null;
  }
}

function anythingToString(value) {
  return value == null ? '∅' : '' + value;
}

function compareToLast(issue, getValue, formatValue) {
  const currentValue = anythingToString(formatValue(getValue(issue)));

  if (!issue.issueLastPeriod) {
    return '🚫 ➡ ' + currentValue;
  }
  const lastValue = anythingToString(formatValue(getValue(issue.issueLastPeriod)));

  if (currentValue !== lastValue) {
    return lastValue + ' ➡ ' + currentValue;
  } else {
    return currentValue === '∅' ? '' : currentValue;
  }
}

function formatDate(date) {
  return date ? dateFormatter.format(date) : date;
}

function getStartDate(issue) {
  return formatDate(issue?.rollupDates?.start);
}
