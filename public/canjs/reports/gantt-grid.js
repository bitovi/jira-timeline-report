// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "../../can.js";
import { showTooltip, showTooltipContent } from "../controls/issue-tooltip.js";
import { mergeStartAndDueData } from "../../jira/rollup/dates/dates.js";

import { makeGetChildrenFromReportingIssues } from "../../jira/rollup/rollup.js";
import { workTypes } from "../../jira/derived/work-status/work-status";
import { normalizeIssue, normalizeParent } from "../../jira/normalized/normalize.js";

import { roundDateByRoundToParam } from "../routing/utils/round.js";
import { getDaysInMonth } from "../../utils/date/days-in-month.js";
import {getBusinessDatesCount} from "../../utils/date/business-days.js"

import {daysBetween} from "../../utils/date/days-between.js"
import {timeRangeShorthand} from "../../utils/date/time-range-shorthand.js"

import SimpleTooltip from "../ui/simple-tooltip/simple-tooltip.js";
import PercentComplete from "../../react/reports/GanttReport/PercentComplete";


import { createRoot } from "react-dom/client";
import { createElement } from "react";


const DATES_TOOLTIP = new SimpleTooltip();
DATES_TOOLTIP.classList.add("reset","pointer-events-none")
document.body.append(DATES_TOOLTIP);

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function container({addedClasses, currentValue, oldValue, title}){
  return `<div class="flex-col justify-items-center px-1 py-3 rounded-md border ${addedClasses || ""}">
      <div class="text-sm font-semibold">${title}</div>
      <div class="flex justify-center gap-1 items-baseline">
        <div>${currentValue}</div>
        ${oldValue !== undefined ? 
          `<div class="bg-neutral-801 rounded-sm text-xs text-white px-1">${oldValue}</div>` : ``
        }
        
      </div>
    </div>`
}


const datesTooltipStache = stache(`<div class='flex gap-0.5 p-1'>
  {{# if(this.startDate)}}
  <div class="text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5">{{this.startDate}}</div>
  {{/ }}
  {{# if(this.businessDays) }}
    <div class="text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5">{{this.businessDays}}</div>
  {{/ }}
  {{# if(this.endDate) }}
  <div class="text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5">{{this.endDate}}</div>
  {{/ }}
</div>`)

import { getQuartersAndMonths } from "../../utils/date/quarters-and-months";
import routeData from "../routing/route-data";

const dateFormatter = new Intl.DateTimeFormat('en-US', {weekday: "short", day: "numeric", month: "short", year: "numeric" })

// loops through and creates
export class GanttGrid extends StacheElement {
  static view = `
        <div style="display: grid; grid-template-columns: auto auto {{this.gridColumnsCSS}} ; grid-template-rows: repeat({{this.gridRowData.length}}, auto)"
            class='p-2'>
            <div class='z-50 bg-white sticky top-0'></div><div class='z-50 bg-white sticky top-0'></div>
            {{# for(column of this.columnsToShow) }}
            <div class='z-50 bg-white sticky top-0'></div>
            {{/ for }}

            {{# for(quarter of this.quartersAndMonths.quarters) }}
                <div style="grid-column: span 3" class="text-center z-50 bg-white sticky top-0">{{quarter.name}}</div>
            {{ / for }}

            <div class='z-50 bg-white sticky top-6' ></div><div class='z-50 bg-white sticky top-6'></div>
            
            {{# for(column of this.columnsToShow) }}
              <div class='z-50 bg-white sticky top-6'></div>
            {{/ for }}

            {{# for(month of this.quartersAndMonths.months)}}
                <div class='border-b border-neutral-80 text-center z-50 bg-white sticky top-6'>{{month.name}}</div>
            {{/ for }}

            <!-- CURRENT TIME BOX -->
            <div style="grid-column: {{plus(3,this.columnsToShow.length)}} / span {{this.quartersAndMonths.months.length}}; grid-row: 3 / span {{this.gridRowData.length}};">
                <div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: #cf57a0; z-index: 45; position: relative; height: 100%;"></div>
            </div>


            <!-- VERTICAL COLUMNS -->
            {{# for(month of this.quartersAndMonths.months)}}
                <div style="grid-column: {{ plus(scope.index, 3, this.columnsToShow.length) }}; grid-row: 3 / span {{this.gridRowData.length}}; z-index: 10"
                    class='border-l border-b border-neutral-80 {{this.lastRowBorder(scope.index)}}'></div>
            {{/ for }}

            <!-- Each of the issues -->
            {{# for(data of this.gridRowData) }}
                {{let rowIndex = scope.index}}
                {{# eq(data.type, "issue") }}
                  
                  <div style="grid-row: {{ plus(3, rowIndex) }}; grid-column: 1"></div>
                  <div style="grid-row: {{ plus(3, rowIndex) }}; grid-column: 2"
                    class="flex z-10 items-stretch {{# if(this.alignLeft) }} justify-left {{ else }} justify-between{{/}}" on:mouseenter='this.hoverEnter(data.issue)' on:mouseleave='this.hoverLeave(data.issue)'>
                    <div on:click='this.toggleShowingChildren(data.issue)'
                      class="{{# if(this.hasChildren(data.issue)) }}pointer hover:bg-neutral-41{{/}} {{this.expandPadding}} pl-{{multiply(data.issue.reportingHierarchy.depth,4)}} w-4 box-content">

                      {{# if(data.isShowingChildren) }}
                        <img src="/images/chevron-down-collapse.svg" class="{{^ this.showExpandChildrenIcon(data.issue) }} invisible {{/}} inline"/>
                      {{ else }}
                        {{# if(this.hasChildren( data.issue) ) }}
                          <img src="/images/chevron-right-expand.svg" class="{{^ this.showExpandChildrenIcon(data.issue) }} invisible {{/}} inline"/>
                        {{/ if }}
                      {{/ if}}
                      
                    </div>
                    <div on:click='this.showTooltip(scope.event,data.issue)' 
                        class='{{this.classForSpecialStatus(data.issue.rollupStatuses.rollup.status)}} {{this.textSize}} 
                          pt-1 pb-0.5 px-1 truncate max-w-96 pointer'>
                        {{data.issue.summary}}
                    </div>
                  </div>

                    {{# for(column of this.columnsToShow) }}
                      <div style="grid-column: {{plus(3, scope.index) }}; grid-row: {{ plus(3, rowIndex) }}; z-index: 25" 
                        class="{{this.textSize}} text-right pointer pt-1 pb-0.5 px-1 hover:bg-neutral-41"
                        on:click="column.onclick(scope.event, data.issue, this.allIssues)">{{column.getValue(data.issue)}}</div>
                    {{/ for }}

                    {{ this.getReleaseTimeline(data.issue, rowIndex) }}
                {{/ eq }}

                {{# eq(data.type, "parent") }}
                    <div style="grid-row: {{ plus(3, scope.index) }}; grid-column: 1"></div>
                    <div 
                        style="grid-row: {{ plus(3, scope.index) }}; grid-column: 2" 
                        on:click='this.showTooltip(scope.event,data.issue)' 
                        class='pointer border-y-solid-1px-white text-left font-bold {{this.classForSpecialStatus(data.issue.rollupStatuses.rollup.status)}} truncate max-w-96 {{this.textSize}}'>
                        {{data.issue.summary}}
                    </div>
                    {{# for(column of this.columnsToShow) }}
                      <div style="grid-row: {{ plus(3, scope.index) }}; grid-column: {{ plus(3, scope.index) }}"></div>
                    {{/ for }}
                    {{ this.groupElement(data.issue, scope.index) }}
                {{/ }}
            {{/ for }}
        </div>
        <div class="react-modal"></div>
    `;
  static props = {
    routeData: {
      get default() {
        return routeData;
      },
    },
    get breakdown() {
      return this.routeData.primaryReportBreakdown;
    },
    showPercentComplete: {
      get() {
        return this.routeData.showPercentComplete ?? !!localStorage.getItem("showPercentComplete");
      },
    },
    showChildrenByKey: {
      get default() {
        return new ObservableObject();
      },
    },
    getChildren: {
      type: Function,
      get: function () {
        return makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);
      },
    },
  };
  hasChildren(issue) {
    return issue.reportingHierarchy.childKeys.length > 0;
  }
  toggleShowingChildren(issue) {
    // make sure we have children
    if(this.hasChildren( issue )) {
      if (this.showChildrenByKey[issue.key]) {
        this.showChildrenByKey[issue.key] = false;
      } else {
        this.showChildrenByKey[issue.key] = true;
      }
    }
  }
  get lotsOfIssues() {
    return this.primaryIssuesOrReleases.length > 20 && !this.breakdown;
  }
  get textSize() {
    return this.lotsOfIssues ? "text-xs" : "";
  }
  get bigBarSize() {
    return this.lotsOfIssues ? "h-2" : "h-4";
  }
  get shadowBarSize() {
    return this.lotsOfIssues ? "h-4" : "h-6";
  }
  get expandPadding() {
    return this.lotsOfIssues ? "" : "pt-1 pb-0.5";
  }
  get columnsToShow() {
    if (this.showPercentComplete) {
      return [
        {
          name: "percentComplete",
          getValue(issue) {
            return stache.safeString(`
              ${Math.round(
                (issue.completionRollup.completedWorkingDays * 100) /
                  issue.completionRollup.totalWorkingDays
              )}%
            `);
          },
          onclick: (event, issue, allIssues) => {
            const getChildren = makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);

            // we should get all the children ...
            const children = getChildren(issue);

            this.root.render(createElement(PercentComplete, {
              allIssuesOrReleases: this.allIssuesOrReleases,
              issue: issue,
              isOpen: true,
              children
            }))
          },
        },
      ];
    } else {
      return [];
    }
  }
  get gridColumnsCSS() {
    let columnCSS = "";
    // repeat({{this.quartersAndMonths.months.length}}, [col] 1fr)

    if (this.columnsToShow.length) {
      columnCSS += "repeat(" + this.columnsToShow.length + ", auto)";
    }

    columnCSS += this.quartersAndMonths.months
      .map(({ date }) => {
        return getDaysInMonth(date.getYear(), date.getMonth() + 1) + "fr";
      })
      .join(" ");

    return columnCSS;
  }
  hoverEnter(issue) {
    this.hoveringIssue = issue;
  }
  hoverLeave() {
    this.hoveringIssue = null;
  }
  showExpandChildrenIcon(issue) {
    return this.hoveringIssue === issue || this.somePrimaryIssuesAreExpanded; //Object.values(this.showChildrenByKey).some(value => value === true);
  }
  getPercentComplete(issue) {
    if (this.showPercentComplete) {
      return (
        Math.round(
          (issue.completionRollup.completedWorkingDays * 100) /
            issue.completionRollup.totalWorkingDays
        ) + "%"
      );
    } else {
      return "";
    }
  }
  showTooltip(event, issue) {
    const getChildren = makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);
    showTooltip(event.currentTarget, issue, this.allIssuesOrReleases);
  }
  showDatesTooltip(issueOrRelease, index, event) {
    const currentTime = event.currentTarget.querySelector(".identifier-current-time");
    let reference
    if(currentTime) {
      reference = currentTime;
    } else {
      reference = event.currentTarget;
    }

    DATES_TOOLTIP.belowElementInScrollingContainer(reference, datesTooltipStache({
      startDate: makeDateAndDiff(issueOrRelease.rollupDates.start, issueOrRelease?.issueLastPeriod?.rollupDates?.start),
      endDate: makeDateAndDiff(issueOrRelease.rollupDates.due, issueOrRelease?.issueLastPeriod?.rollupDates?.due),
      businessDays: issueOrRelease.rollupDates.start && issueOrRelease.rollupDates.due ?
      timeRangeShorthand( daysBetween( issueOrRelease.rollupDates.due, issueOrRelease.rollupDates.start) ) : null
    }).firstElementChild);
  }
  hideDatesTooltip(issueOrRelease, index, event) {
    DATES_TOOLTIP.leftElement(event);
  }
  classForSpecialStatus(status, issue) {
    if (status === "complete" || status === "blocked" || status === "warning") {
      return "color-text-" + status;
    } else {
      return "";
    }
  }
  plus(first, second, third) {
    return first + second + (third || 0);
  }
  multiply(first, second) {
    return first * second;
  }
  lastRowBorder(index) {
    return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : "";
  }
  get quartersAndMonths() {
    const rollupDates = this.primaryIssuesOrReleases.map((issue) => issue.rollupStatuses.rollup);

    let { start, due } = mergeStartAndDueData(rollupDates);
    // nothing has timing
    if (!start) {
      start = new Date();
    }
    if (!due) {
      due = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 90);
    }
    if (due < new Date()) {
      due = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 90);
    }
    return getQuartersAndMonths(new Date(), due);
  }
  get todayMarginLeft() {
    const { firstDay, lastDay } = this.quartersAndMonths;
    const totalTime = lastDay - firstDay;
    return ((new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime) * 100;
  }

  get gridRowData() {
    const getRows = makeGetRows((key) => {
      return this.showChildrenByKey[key];
    }, this.getChildren.bind(this));

    // we need to check here b/c primaryIssueType and groupBy can't be made atomic easily
    if (this.routeData.groupBy === "parent" && this.routeData.primaryIssueType !== "Release") {
      // get all the parents of the primary releases
      const { parents, parentToChildren } = getSortedParents(
        this.primaryIssuesOrReleases,
        this.routeData.derivedIssues
      );

      // for each parent, find its children
      let parentsAndChildren = parents
        .map((parent) => {
          return [
            { type: "parent", issue: parent, isShowingChildren: false },
            ...parentToChildren[parent.key].map(getRows).flat(1),
          ];
        })
        .flat(1);

      return parentsAndChildren.length ? parentsAndChildren : this.primaryIssuesOrReleases;
    } else if (this.routeData.groupBy === "team" && this.routeData.primaryIssueType !== "Release") {
      let issuesByTeam = Object.groupBy(this.primaryIssuesOrReleases, (issue) => issue.team.name);

      const teams = Object.keys(issuesByTeam).map((teamName) => {
        return {
          ...issuesByTeam[teamName][0].team,
          summary: teamName,
        };
      });

      teams.sort((t1, t2) => {
        return t1.name > t2.name ? 1 : -1;
      });
      return teams
        .map((team) => {
          return [
            { type: "parent", issue: team, isShowingChildren: false },
            ...issuesByTeam[team.name].map(getRows).flat(1),
          ];
        })
        .flat(1);
    } else {
      return this.primaryIssuesOrReleases.map((issue) => getRows(issue)).flat(1);
    }
  }
  groupElement(issue, index) {
    const baseGridStyles = {
      gridColumn: `${this.columnsToShow.length + 3} / span ${this.quartersAndMonths.months.length}`,
      gridRow: `${index + 3}`,
    };

    const background = makeElement([index % 2 ? "bg-neutral-20" : ""], {
      ...baseGridStyles,
      zIndex: 0,
    });
    return stache.safeString(background);
  }
  /**
   *
   * @param {} release
   * @param {*} index
   * @returns
   */
  getReleaseTimeline(release, index) {
    // we will have 2 elements, one for a background, the other for the chart stuff ...
    const frag = document.createDocumentFragment();

    // background and chart stuff have the same grid config
    const baseGridStyles = {
      gridRow: `${index + 3}`,
    };

    const background = makeElement([index % 2 ? "bg-neutral-20" : ""], {
      ...baseGridStyles,
      // we probably want to move this to it's own element so we don't have to redraw so much
      gridColumn: this.somePrimaryIssuesAreExpanded
        ? `1 / span ${this.quartersAndMonths.months.length + this.columnsToShow.length + 2}`
        : `${this.columnsToShow.length + 3} / span ${this.quartersAndMonths.months.length}`,
      zIndex: 0,
    });

    // the root element contains the last period and current period bars
    const root = makeElement([], {
      ...baseGridStyles,
      gridColumn: `${this.columnsToShow.length + 3} / span ${this.quartersAndMonths.months.length}`,
      position: "relative",
      zIndex: 20,
    });
    
    

    // this has the last period stuff ... it's absolutely stretched to match the same space
    // we probably could have put this in the grid, but it's nice to have this stuff w/i an element
    const lastPeriodRoot = makeElement([this.breakdown ? "" : "py-1"], {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
    });

    frag.appendChild(background);
    frag.appendChild(root);

    root.appendChild(lastPeriodRoot);

    const { firstDay, lastDay } = this.quartersAndMonths;

    const getPositions = getPositionsFromWork.bind(this, { firstDay, lastDay });

    if (release.rollupStatuses.rollup.start && release.rollupStatuses.rollup.due) {
      function makeLastPeriodElement(status, timing, currentPositions, extraClasses) {
        const positions = getPositions(timing || {});

        if (currentPositions.start === positions.start && currentPositions.end === positions.end) {
          return makeElement([], {});
        }

        if (positions.endIsBeforeFirstDay) {
          return makeElement([], {});
        }

        const behindTime = makeElement(
          [
            /*"bg-neutral-41","blur-xs", roundBasedOnIfTheBarsExtend(positions) */

            /* "color-border-"+status, ...borderBasedOnIfTheBarsExtend(positions), roundBasedOnIfTheBarsExtend(positions)*/
            "border-black",
            "blur-xs",
            ...borderBasedOnIfTheBarsExtend(positions),
            roundBasedOnIfTheBarsExtend(positions),
            ...extraClasses,
          ],
          {
            backgroundClip: "content-box",
            position: "relative",
            ...positions.style,
          }
        );

        return behindTime;
      }

      if (this.breakdown) {
        const workTypes = this.hasWorkTypes.list.filter((wt) => wt.hasWork);
        for (const { type } of workTypes) {
          const thisPeriodPositions = getPositions(release.rollupStatuses[type]);

          const lastPeriod = makeLastPeriodElement(
            release.rollupStatuses[type].status,
            release.rollupStatuses[type].lastPeriod,
            thisPeriodPositions,
            ["h-2" /*, "py-[2px]"*/]
          );

          lastPeriodRoot.appendChild(lastPeriod);

          const thisPeriod = makeElement(
            [
              type + "_time",
              "h-[6px]",
              "my-[1px]",
              "rounded-sm",
              "color-text-and-bg-" + release.rollupStatuses[type].status,
            ],
            {
              ...thisPeriodPositions.style,
              position: "relative", // for some reason needed to bring this ahead of `lastPeriod`
            }
          );

          root.appendChild(thisPeriod);
        }
      } else {
        root.addEventListener("mouseenter",this.showDatesTooltip.bind(this, release, index));
        root.addEventListener("mouseleave",this.hideDatesTooltip.bind(this, release, index));
        
        // make the last one ...
        const currentPositions = getPositions(release.rollupStatuses.rollup);

        let team;

        if (currentPositions.endIsBeforeFirstDay) {
          team = makeCircleForStatus(release.rollupStatuses.rollup.status, "←", this.lotsOfIssues);
        } else {
          team = makeElement(
            [
              "my-2",
              this.bigBarSize,
              "color-text-and-bg-" + release.rollupStatuses.rollup.status,
              roundBasedOnIfTheBarsExtend(currentPositions),
              "identifier-current-time"
            ],
            {
              /*opacity: "0.9",*/
              ...currentPositions.style,
              zIndex: 30,
              position: "relative",
            }
          );
        }

        if (release.rollupStatuses.rollup.lastPeriod) {
          const behindTime = makeLastPeriodElement(
            release.rollupStatuses.rollup.status,
            release.rollupStatuses.rollup.lastPeriod,
            currentPositions,
            [this.shadowBarSize]
          );

          lastPeriodRoot.appendChild(behindTime);
        }

        root.appendChild(team);
      }
    } else {
      let team = makeCircleForStatus(
        "notstarted",
        '<img src="/images/empty-set.svg" />',
        this.lotsOfIssues
      );

      root.appendChild(team);
    }

    return stache.safeString(frag);
  }
  get hasWorkTypes() {
    const map = {};
    const list = workTypes.map((type) => {
      let hasWork = this.primaryIssuesOrReleases
        ? this.primaryIssuesOrReleases.some((issue) => issue.rollupStatuses[type].issueKeys.length)
        : false;
      return (map[type] = { type, hasWork });
    });
    return { map, list };
  }
  get hasQAWork() {
    if (this.primaryIssuesOrReleases) {
      return this.primaryIssuesOrReleases.some((issue) => issue.rollupStatuses.qa.issueKeys.length);
    } else {
      return true;
    }
  }
  get hasUATWork() {
    if (this.primaryIssuesOrReleases) {
      return this.primaryIssuesOrReleases.some(
        (issue) => issue.rollupStatuses.uat.issueKeys.length
      );
    } else {
      return true;
    }
  }

  get alignLeft() {
    return this.somePrimaryIssuesAreExpanded;
    //const hasExpanded = Object.values(this.showChildrenByKey).some(value => value === true);
    //console.log("alignLeft", hasExpanded);
    //return hasExpanded;
  }

  get somePrimaryIssuesAreExpanded() {
    return (
      this.primaryIssuesOrReleases.filter((issue) => {
        return this.showChildrenByKey[issue.key];
      }).length > 0
    );
  }

  connected(){
    this.root = createRoot(this.querySelector(".react-modal"));
  }
}

function roundBasedOnIfTheBarsExtend({ startExtends, endExtends }) {
  if (!startExtends && !endExtends) {
    return "rounded";
  } else if (startExtends && endExtends) {
    return "rounded-none";
  } else if (startExtends) {
    return "rounded-r";
  } else {
    return "rounded-l";
  }
}

function borderBasedOnIfTheBarsExtend({ startExtends, endExtends }) {
  if (!startExtends && !endExtends) {
    return ["border"];
  } else if (startExtends && endExtends) {
    return ["border-0"];
  } else if (startExtends) {
    return ["border-r", "border-y"];
  } else {
    return ["border-l", "border-y"];
  }
}

function makeElement(classNames, styles) {
  const div = document.createElement("div");
  div.classList.add(...classNames.filter((x) => x));
  Object.assign(div.style, styles);
  return div;
}


function makeDateAndDiff(dateNow, dateThen) {
  let endDate = "";
  if(dateNow) {
    endDate += dateFormatter.format(dateNow)
    if(dateThen) {
      let days = daysBetween( dateNow, dateThen );
      if(days != 0) {
        endDate += " "+(days >= 0 ? "+" : "-") +timeRangeShorthand( (days >= 0 ? 1 : -1) * days )
      }
    }
  }
  return endDate;
}

function getPositionsFromWork({ firstDay, lastDay }, work) {
  const totalTime = lastDay - firstDay;

  const roundedWork = {
    start: roundDateByRoundToParam.start(work.start),
    due: roundDateByRoundToParam.end(work.due),
  };

  if (roundedWork.start == null && roundedWork.due == null) {
    return {
      start: 0,
      end: Infinity,
      startExtends: false,
      endExtends: false,
      style: {
        marginLeft: "1px",
        marginRight: "1px",
      },
    };
  }

  const start = Math.max(firstDay, roundedWork.start);
  const end = Math.min(lastDay, roundedWork.due);
  const startExtends = roundedWork.start < firstDay;
  const endExtends = roundedWork.due > lastDay;

  return {
    start,
    end,
    endIsBeforeFirstDay: roundedWork.due && roundedWork.due <= firstDay,
    startIsAfterLastDay: roundedWork.start && roundedWork.start >= lastDay,
    startExtends, // is the start before the first day
    endExtends, // is the end after the last day
    style: {
      width: Math.max(((end + DAY_IN_MS - start) / totalTime) * 100, 0) + "%",
      marginLeft: "max(" + ((start - firstDay) / totalTime) * 100 + "%, 1px)",
    },
  };
}

function makeCircle(innerHTML, styles, css) {
  const element = makeElement(styles, {
    ...css,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  element.innerHTML = innerHTML;
  return element;
}

const fewerIssuesClasses = ["w-4", "h-4", "text-xs"];
const lotsOfIssueClasses = ["w-4", "h-4", "text-xs"];
function makeCircleForStatus(status, innerHTML, lotsOfIssues) {
  let team = makeElement([lotsOfIssues ? "p-1" : "p-2"], {});
  team.appendChild(
    makeCircle(
      innerHTML,
      ["color-text-and-bg-" + status, ...(lotsOfIssues ? lotsOfIssueClasses : fewerIssuesClasses)],
      { zIndex: 30, position: "relative" }
    )
  );

  return team;
}

//  this.showChildrenByKey[issue.key];
// this.getChildren()

function makeGetRows(getIfKeyIsShowingChildren, getChildrenForIssue) {
  return function getRows(issue, depth = 0) {
    const isShowingChildren = getIfKeyIsShowingChildren(issue.key);
    const row = { type: "issue", issue, isShowingChildren, depth };
    if (isShowingChildren) {
      return [
        row,
        ...getChildrenForIssue(issue)
          .map((issue) => getRows(issue, depth + 1))
          .flat(1),
      ];
    } else {
      return [row];
    }
  };
}

function getSortedParents(primaryIssues, allIssues) {
  // once we know a parent key, be able to get all of its children
  let parentToChildren = Object.groupBy(primaryIssues || [], (issue) => issue.parentKey);

  // it's possible these are temporarily undefined or missing as route data changes
  let keyToAllIssues = Object.groupBy(allIssues || [], (issue) => issue.key);

  // get the parent keys
  let parentKeys = Object.keys(parentToChildren);

  // loop through and try to get as much information as possible about the parent
  let parents = parentKeys
    .map((parentKey) => {
      // if we loaded the issue itself ...
      if (keyToAllIssues[parentKey]) {
        return keyToAllIssues[parentKey][0];
      }
      // if the issue has some parent data with it
      else if (parentToChildren[parentKey][0].issue.fields.Parent) {
        return normalizeParent(parentToChildren[parentKey][0].issue.fields.Parent);
      }
      // else it doesnt' have a parent, create something for things with no parent
      else {
        return {
          key: parentKey,
          summary: "No Parent",
          rollupStatuses: { rollup: { status: null } },
        };
      }
    })
    // not sure what case this is filtering .. we should look at it
    .filter(Boolean);

  // sort them
  if (parents.length && parents[0].rank) {
    parents.sort((p1, p2) => {
      return p1.rank > p2.rank ? 1 : -1;
    });
  }
  return { parents, parentToChildren };
}

customElements.define("gantt-grid", GanttGrid);
