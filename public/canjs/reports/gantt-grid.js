// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "../../can.js";
import { showTooltip, showTooltipContent } from "../controls/issue-tooltip.js";
import { mergeStartAndDueData } from "../../jira/rollup/dates/dates.js";

import { makeGetChildrenFromReportingIssues } from "../../jira/rollup/rollup.js";
import { workTypes } from "../../jira/derived/work-status/work-status";
import { normalizeIssue, normalizeParent } from "../../jira/normalized/normalize.js";

import { roundDateByRoundToParam } from "../routing/utils/round.js";
import { getDaysInMonth } from "../../utils/date/days-in-month.js";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const percentCompleteTooltip = stache(`
    <button class="remove-button">❌</button>
    <div class="grid gap-2" style="grid-template-columns: auto repeat(4, auto);">

            <div class="font-bold">Summary</div>
            <div class="font-bold">Percent Complete</div>
            <div class="font-bold">Completed Working Days</div>
            <div class="font-bold">Remaining Working Days</div>
            <div class="font-bold">Total Working Days</div>
        
            <div class="truncate max-w-96">{{this.issue.summary}}</div>
            <div class="text-right">{{this.getPercentComplete(this.issue)}}</div>
            <div class="text-right">{{this.round( this.issue.completionRollup.completedWorkingDays) }}</div>
            <div class="text-right">{{this.round(this.issue.completionRollup.remainingWorkingDays)}}</div>
            <div class="text-right">{{this.round(this.issue.completionRollup.totalWorkingDays)}}</div>
        
        {{# for(child of this.children) }}
       
            <div class="pl-4 truncate max-w-96"><a href="{{child.url}}" class="link">{{child.summary}}</a></div>
            <div class="text-right">{{this.getPercentComplete(child)}}</div>
            <div class="text-right">{{this.round(child.completionRollup.completedWorkingDays)}}</div>
            <div class="text-right">{{this.round(child.completionRollup.remainingWorkingDays)}}</div>
            <div class="text-right">{{this.round(child.completionRollup.totalWorkingDays)}}</div>
       
        {{/ for }}
   </div>
`);

import { getQuartersAndMonths } from "../../utils/date/quarters-and-months";
import routeData from "../routing/route-data";

// loops through and creates
export class GanttGrid extends StacheElement {
  static view = `
        <div style="display: grid; grid-template-columns: auto auto {{this.gridColumnsCSS}} ; grid-template-rows: repeat({{this.gridRowData.length}}, auto)"
            class='p-2 mb-10'>
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
                      class="pointer {{this.expandPadding}} pl-{{multiply(data.issue.reportingHierarchy.depth,4)}} w-4 box-content">

                      {{# if(data.isShowingChildren) }}
                        <img src="/images/chevron-down-collapse.svg" class="{{^ this.showExpandChildrenIcon(data.issue) }} invisible {{/}} inline"/>
                      {{ else }}
                        {{# if(data.issue.reportingHierarchy.childKeys.length) }}
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
                      <div style="grid-column: {{plus(3, scope.index) }}; grid-row: {{ plus(3, rowIndex) }}" class="{{this.textSize}} text-right pointer pt-1 pb-0.5 px-1"
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
    }
  };
  toggleShowingChildren(issue) {
    if (this.showChildrenByKey[issue.key]) {
      this.showChildrenByKey[issue.key] = false;
    } else {
      this.showChildrenByKey[issue.key] = true;
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
  get expandPadding(){
    return this.lotsOfIssues ? "": "pt-1 pb-0.5"
  }
  get columnsToShow() {
    if (this.showPercentComplete) {
      return [
        {
          name: "percentComplete",
          getValue(issue) {
            return (
              Math.round(
                (issue.completionRollup.completedWorkingDays * 100) /
                  issue.completionRollup.totalWorkingDays
              ) + "%"
            );
          },
          onclick: (event, issue, allIssues) => {
            const getChildren = makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);

            // we should get all the children ...
            const children = getChildren(issue);

            showTooltipContent(
              event.currentTarget,
              percentCompleteTooltip({
                issue,
                children,
                getPercentComplete: this.getPercentComplete.bind(this),
                round: Math.round,
              })
            );
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
  showExpandChildrenIcon(issue){
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
  showPercentCompleteTooltip(event, issue) {
    const getChildren = makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);

    // we should get all the children ...
    const children = getChildren(issue);

    showTooltipContent(
      event.currentTarget,
      percentCompleteTooltip({
        issue,
        children,
        getPercentComplete: this.getPercentComplete.bind(this),
        round: Math.round,
      })
    );
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
    // we need to check here b/c primaryIssueType and groupBy can't be made atomic easily
    if (this.routeData.groupBy === "parent" && this.routeData.primaryIssueType !== "Release") {
      // get all the parents ...

      let obj = Object.groupBy(this.primaryIssuesOrReleases, (issue) => issue.parentKey);
      let keyToAllIssues = Object.groupBy(this.routeData.derivedIssues, (issue) => issue.key);

      let parentKeys = Object.keys(obj);
      let parents = parentKeys
        .map((parentKey) => {
          if (keyToAllIssues[parentKey]) {
            return keyToAllIssues[parentKey][0];
          } else if (obj[parentKey][0].issue.fields.Parent) {
            return normalizeParent(obj[parentKey][0].issue.fields.Parent);
          } else {
            return { key: parentKey, summary: "No Parent" };
          }
        })
        .filter(Boolean);

      if (parents.length && parents[0].rank) {
        parents.sort((p1, p2) => {
          return p1.rank > p2.rank ? 1 : -1;
        });
      }

      let parentsAndChildren = parents
        .map((parent) => {
          return [
            { type: "parent", issue: parent },
            ...obj[parent.key].map((issue) => {
              return { type: "issue", issue };
            }),
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
            { type: "parent", issue: team },
            ...issuesByTeam[team.name].map((issue) => {
              return { type: "issue", issue };
            }),
          ];
        })
        .flat(1);
    } else {
      const getRow = (issue, depth = 0) => {
        const isShowingChildren = this.showChildrenByKey[issue.key];

        const row = { type: "issue", issue, isShowingChildren, depth };
        if (isShowingChildren) {
          return [
            row,
            ...this.getChildren(issue)
              .map((issue) => getRow(issue, depth + 1))
              .flat(1),
          ];
        } else {
          return [row];
        }
      };

      return this.primaryIssuesOrReleases.map((issue) => getRow(issue)).flat(1);
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
      gridColumn: this.somePrimaryIssuesAreExpanded ? 
        `1 / span ${this.quartersAndMonths.months.length + this.columnsToShow.length + 2}`: 
        `${this.columnsToShow.length + 3} / span ${this.quartersAndMonths.months.length}`,
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
        
        // make the last one ...
        const currentPositions = getPositions(release.rollupStatuses.rollup);

        let team;

        if (currentPositions.endIsBeforeFirstDay) {
          /*
          team = makeElement(["p-2"],{});
          team.appendChild(
            makeCircle("←",["color-text-and-bg-" + release.rollupStatuses.rollup.status, "w-4","h-4","text-xs"],
              {zIndex: 30, position: "relative"})
          );*/
          team = makeCircleForStatus(release.rollupStatuses.rollup.status, "←", this.lotsOfIssues);
        } else {
          team = makeElement(
            [
              "my-2",
              this.bigBarSize,
              "color-text-and-bg-" + release.rollupStatuses.rollup.status,
              roundBasedOnIfTheBarsExtend(currentPositions),
            ],
            {
              /*opacity: "0.9",*/
              ...currentPositions.style,
              zIndex: 30,
              position: "relative",
            }
          );
        }

        if( release.rollupStatuses.rollup.lastPeriod ) {
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
      let team = makeCircleForStatus("notstarted", '<img src="/images/empty-set.svg" />', this.lotsOfIssues);

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

  get somePrimaryIssuesAreExpanded(){
    return this.primaryIssuesOrReleases.filter((issue) => {
      return this.showChildrenByKey[issue.key]
    }).length > 0
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

customElements.define("gantt-grid", GanttGrid);
