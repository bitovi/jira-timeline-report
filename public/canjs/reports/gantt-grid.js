// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "../../can.js";
import { showTooltip, showTooltipContent } from "../controls/issue-tooltip.js";
import { mergeStartAndDueData } from "../../jira/rollup/dates/dates.js";

import { makeGetChildrenFromReportingIssues } from "../../jira/rollup/rollup.js";
import { workTypes } from "../../jira/derived/work-status/work-status";
import { normalizeIssue, normalizeParent } from "../../jira/normalized/normalize.js";


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

// loops through and creates
export class GanttGrid extends StacheElement {
  static view = `
        <div style="display: grid; grid-template-columns: auto auto {{this.gridColumnsCSS}} repeat({{this.quartersAndMonths.months.length}}, [col] 1fr); grid-template-rows: repeat({{this.gridRowData.length}}, auto)"
            class='p-2 mb-10'>
            <div></div><div></div>
            {{# for(column of this.columnsToShow) }}
            <div></div>
            {{/ for }}

            {{# for(quarter of this.quartersAndMonths.quarters) }}
                <div style="grid-column: span 3" class="text-center">{{quarter.name}}</div>
            {{ / for }}

            <div></div><div></div>
            
            {{# for(column of this.columnsToShow) }}
              <div></div>
            {{/ for }}

            {{# for(month of this.quartersAndMonths.months)}}
                <div class='border-b border-neutral-80 text-center'>{{month.name}}</div>
            {{/ for }}

            <!-- CURRENT TIME BOX -->
            <div style="grid-column: {{plus(3,this.columnsToShow.length)}} / span {{this.quartersAndMonths.months.length}}; grid-row: 3 / span {{this.gridRowData.length}};">
                <div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 1000; position: relative; height: 100%;"></div>
            </div>


            <!-- VERTICAL COLUMNS -->
            {{# for(month of this.quartersAndMonths.months)}}
                <div style="grid-column: {{ plus(scope.index, 3, this.columnsToShow.length) }}; grid-row: 3 / span {{this.gridRowData.length}}; z-index: 10"
                    class='border-l border-b border-neutral-80 {{this.lastRowBorder(scope.index)}}'></div>
            {{/ for }}

            <!-- Each of the issues -->
            {{# for(data of this.gridRowData) }}
                {{# eq(data.type, "issue") }}
                    <div on:click='this.toggleShowingChildren(data.issue)'
                      class="pl-{{multiply(data.issue.reportingHierarchy.depth,4)}}">

                      {{# if(data.isShowingChildren) }}
                        <img class="inline" src="/images/chevron-down.svg" class="hidden"/>
                      {{ else }}
                        {{# if(data.issue.reportingHierarchy.childKeys.length) }}
                          <img class="inline" src="/images/chevron-right-new.svg" class="hidden"/>
                        {{/ }}
                      {{/ if}}
                      
                    </div>
                    <div on:click='this.showTooltip(scope.event,data.issue)' 
                        class='pointer border-y-solid-1px-white text-right {{this.classForSpecialStatus(data.issue.rollupStatuses.rollup.status)}} truncate max-w-96 {{this.textSize}}'>
                        {{data.issue.summary}}
                    </div>

                    {{# for(column of this.columnsToShow) }}
                      <div style="grid-column: {{plus(3, scope.index)}}" class="{{this.textSize}} text-right pointer"
                        on:click="column.onclick(scope.event, data.issue, this.allIssues)">{{column.getValue(data.issue)}}</div>
                    {{/ for }}

                    {{ this.getReleaseTimeline(data.issue, scope.index) }}
                {{/ eq }}

                {{# eq(data.type, "parent") }}
                    <div></div>
                    <div on:click='this.showTooltip(scope.event,data.issue)' 
                        class='pointer border-y-solid-1px-white text-left font-bold {{this.classForSpecialStatus(data.issue.rollupStatuses.rollup.status)}} truncate max-w-96 {{this.textSize}}'>
                        {{data.issue.summary}}
                    </div>
                    {{# for(column of this.columnsToShow) }}
                      <div style="grid-column: {{ plus(3, scope.index) }}"></div>
                    {{/ for }}
                    {{ this.groupElement(data.issue, scope.index) }}
                {{/ }}
            {{/ for }}
        </div>
    `;
  static props = {
    breakdown: Boolean,
    showPercentComplete: {
      get default() {
        return !!localStorage.getItem("showPercentComplete");
      },
    },
    showChildrenByKey: {
      get default(){
        return new ObservableObject();
      }
    },
    getChildren: {
      type: Function,
      get: function(){
        return makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);
      }
    }
  };
  toggleShowingChildren(issue) {
    if(this.showChildrenByKey[issue.key]) {
      this.showChildrenByKey[issue.key] = false;
    } else {
      this.showChildrenByKey[issue.key] = true;
    }
  }
  get lotsOfIssues() {
    return this.primaryIssuesOrReleases.length > 20 && !this.breakdown;
  }
  get textSize() {
    return this.lotsOfIssues ? "text-xs pt-1 pb-0.5 px-1" : "pt-1 pb-0.5 px-1";
  }
  get bigBarSize() {
    return this.lotsOfIssues ? "h-2" : "h-4";
  }
  get shadowBarSize(){
    return this.lotsOfIssues ? "h-4" : "h-6";
  }
  get columnsToShow(){
    if(this.showPercentComplete) {
      return [{
        name: "percentComplete",
        getValue(issue) {
          return (
            Math.round((issue.completionRollup.completedWorkingDays * 100) / issue.completionRollup.totalWorkingDays) + "%"
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
        }
      }]
    } else {
      return []
    }
  }
  get gridColumnsCSS(){
    if(this.columnsToShow.length) {
      return "repeat("+this.columnsToShow.length+", auto)"
    } else {
      return "";
    }
  }
  getPercentComplete(issue) {
    if (this.showPercentComplete) {
      return (
        Math.round((issue.completionRollup.completedWorkingDays * 100) / issue.completionRollup.totalWorkingDays) + "%"
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
    return first* second;
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
    if ( !due ) {
      due = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 90);
    }
    if( due < new Date() ) {
      due = new Date((new Date()).getTime() + 1000 * 60 * 60 * 24 * 90);
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
    if (this.groupBy === "parent" && this.primaryIssueType !== "Release") {
      // get all the parents ...

      let obj = Object.groupBy(this.primaryIssuesOrReleases, (issue) => issue.parentKey);
      let keyToAllIssues = Object.groupBy(this.allDerivedIssues, (issue) => issue.key);

      let parentKeys = Object.keys(obj);
      let parents = parentKeys
        .map((parentKey) => {
          if (keyToAllIssues[parentKey]) {
            return keyToAllIssues[parentKey][0];
          } else if (obj[parentKey][0].issue.fields.Parent) {
            return normalizeParent(obj[parentKey][0].issue.fields.Parent);
          } else {
            return {key: parentKey, summary: "No Parent"}
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
    } else if (this.groupBy === "team" && this.primaryIssueType !== "Release") {
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
        if(isShowingChildren) {
          return [row, ...this.getChildren(issue).map((issue)=> getRow(issue, depth+1)).flat(1)]
        } else {
          return [row]
        }
      }


      return this.primaryIssuesOrReleases.map( issue => getRow(issue)).flat(1);
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
    })
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
      gridColumn: `${this.columnsToShow.length + 3} / span ${this.quartersAndMonths.months.length}`,
      gridRow: `${index + 3}`,
    };

    const background = makeElement(
      [index % 2 ? "bg-neutral-20" : ""],
      {
        ...baseGridStyles,
        zIndex: 0,
      }
    );

    // the root element contains the last period and current period bars
    const root = makeElement([],{
      ...baseGridStyles,
      position: "relative",
      zIndex: 20,
    });

    // this has the last period stuff ... it's absolutely stretched to match the same space
    // we probably could have put this in the grid, but it's nice to have this stuff w/i an element
    const lastPeriodRoot = makeElement(
      [this.breakdown ? "": "py-1"],
    {
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
    
    const getPositions = getPositionsFromWork.bind(this, {firstDay, lastDay});
    
    if (release.rollupStatuses.rollup.start && release.rollupStatuses.rollup.due) {
      
      function makeLastPeriodElement(status, timing, currentPositions, extraClasses) {

        const positions = getPositions(timing || {});

        if(currentPositions.start === positions.start && currentPositions.end === positions.end) {
          return makeElement([],{});
        }

        if(positions.endIsBeforeFirstDay) {
          return makeElement([],{}); 
        }

        const behindTime = makeElement([
          /*"bg-neutral-41","blur-xs", roundBasedOnIfTheBarsExtend(positions) */

          /* "color-border-"+status, ...borderBasedOnIfTheBarsExtend(positions), roundBasedOnIfTheBarsExtend(positions)*/
          "border-black","blur-xs", ...borderBasedOnIfTheBarsExtend(positions), roundBasedOnIfTheBarsExtend(positions)
          , ... extraClasses
        ],{
          backgroundClip: "content-box",
          position: "relative",
          ...positions.style
        })
        
        return behindTime;
      }

      if (this.breakdown) {

        const workTypes = this.hasWorkTypes.list.filter((wt) => wt.hasWork);
        for (const { type } of workTypes) {
          const thisPeriodPositions = getPositions(release.rollupStatuses[type])

          const lastPeriod = makeLastPeriodElement(
            release.rollupStatuses[type].status,
            release.rollupStatuses[type].lastPeriod,
            thisPeriodPositions,
            ["h-2"/*, "py-[2px]"*/]
          );

          lastPeriodRoot.appendChild(lastPeriod);

          

          const thisPeriod = makeElement([
            type+"_time","h-[6px]","my-[1px]", "rounded-sm", "color-text-and-bg-"+release.rollupStatuses[type].status,
          ], {
            ...thisPeriodPositions.style,
            position: "relative" // for some reason needed to bring this ahead of `lastPeriod`
          })
          
          root.appendChild(thisPeriod);
        }
      } else {
        // make the last one ...
        const currentPositions = getPositions(release.rollupStatuses.rollup);

        let team;

        if(currentPositions.endIsBeforeFirstDay) {
          /*
          team = makeElement(["p-2"],{});
          team.appendChild(
            makeCircle("←",["color-text-and-bg-" + release.rollupStatuses.rollup.status, "w-4","h-4","text-xs"],
              {zIndex: 30, position: "relative"})
          );*/
          team = makeCircleForStatus(release.rollupStatuses.rollup.status, "←", this.lotsOfIssues)
        } else {
          team = makeElement([
            "my-2", this.bigBarSize, "color-text-and-bg-" + release.rollupStatuses.rollup.status,
            roundBasedOnIfTheBarsExtend(currentPositions)
          ],{
            /*opacity: "0.9",*/
            ... currentPositions.style,
            zIndex: 30, position: "relative"
          })
        }

        const behindTime = makeLastPeriodElement(
          release.rollupStatuses.rollup.status,
          release.rollupStatuses.rollup.lastPeriod,
          currentPositions,
          [this.shadowBarSize]
        );

        lastPeriodRoot.appendChild(behindTime);
        
        root.appendChild(team);
      }
    } else {
      let team = makeCircleForStatus("unknown", "∅", this.lotsOfIssues)
      /*
      let team = makeElement(["p-2"],{});
      team.appendChild(
        makeCircle("∅",["color-text-and-bg-unknown", "w-4","h-4","text-xs"],
          {zIndex: 30, position: "relative"})
      ); */

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
      return this.primaryIssuesOrReleases.some((issue) => issue.rollupStatuses.uat.issueKeys.length);
    } else {
      return true;
    }
  }
}

function roundBasedOnIfTheBarsExtend({startExtends, endExtends}) {
  if(!startExtends && !endExtends) {
    return "rounded"
  }
  else if(startExtends && endExtends) {
    return "rounded-none"
  } else if(startExtends) {
    return "rounded-r"
  } else {
    return "rounded-l"
  }
}

function borderBasedOnIfTheBarsExtend({startExtends, endExtends}) {
  if(!startExtends && !endExtends) {
    return "border"
  }
  else if(startExtends && endExtends) {
    return ["border-0"]
  } else if(startExtends) {
    return ["border-r", "border-y"]
  } else {
    return ["border-l", "border-y"]
  }
}

function makeElement(classNames, styles) {
  const div = document.createElement("div");
  div.classList.add(...classNames.filter( x => x));
  Object.assign(div.style, styles);
  return div;
}


function getPositionsFromWork({firstDay, lastDay}, work) {
  const totalTime = lastDay - firstDay;

  if (work.start == null && work.due == null) {
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

  const start = Math.max(firstDay, work.start);
  const end = Math.min(lastDay, work.due);
  const startExtends = work.start < firstDay;
  const endExtends = work.due > lastDay;

  return {

    start,
    end,
    endIsBeforeFirstDay: work.due && work.due <= firstDay,
    startIsAfterLastDay: work.start && work.start >= lastDay,
    startExtends, // is the start before the first day
    endExtends,   // is the end after the last day
    style: {
      width: Math.max(((end - start) / totalTime) * 100, 0) + "%",
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
    justifyContent: "center"
  });
  element.innerHTML = innerHTML;
  return element;
}

const fewerIssuesClasses = ["w-4","h-4","text-xs"];
const lotsOfIssueClasses = ["w-4","h-4","text-xs"];
function makeCircleForStatus(status,innerHTML, lotsOfIssues) {

  let team = makeElement([ lotsOfIssues ? "p-1" : "p-2"],{});
  team.appendChild(
    makeCircle(innerHTML,["color-text-and-bg-" + status, ...(lotsOfIssues ? lotsOfIssueClasses : fewerIssuesClasses)],
      {zIndex: 30, position: "relative"})
  ); 

  return team;
}


customElements.define("gantt-grid", GanttGrid);
