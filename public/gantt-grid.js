// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "./can.js";
import { showTooltip, showTooltipContent } from "./issue-tooltip.js";
import { mergeStartAndDueData } from "./jira/rollup/dates/dates.js";

import { createRoot } from "react-dom/client";
import { createElement } from "react";

import TeamConfigure from "./react/Configure/Teams/index.ts";

import { makeGetChildrenFromReportingIssues } from "./jira/rollup/rollup.js";
import { workTypes } from "./jira/derived/work-status/work-status.js";
import { normalizeIssue, normalizeParent } from "./jira/normalized/normalize.js";

/*
import { getCalendarHtml, getQuarter, getQuartersAndMonths } from "./quarter-timeline.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS } from "./date-helpers.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { day: "numeric", month: "short" })

const inQAStatus = { "QA": true, "In QA": true };
const inDevStatus = { "In Development": true, "Development": true };
const inPartnerReviewStatus = { "Partner Review": true };
const inDoneStatus = { "Done": true };

import SimpleTooltip from "./shared/simple-tooltip.js";

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);*/

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

import { getQuartersAndMonths } from "./quarter-timeline.js";

// loops through and creates
export class GanttGrid extends StacheElement {
  connectedCallback() {
    createRoot(document.getElementById("test-attach")).render(
      createElement(TeamConfigure, { primary: true, label: "React button created from a web component in auth.ts" })
    );
  }

  static view = `
        <div id='test-attach'></div>
        <div style="display: grid; grid-template-columns: auto auto repeat({{this.quartersAndMonths.months.length}}, [col] 1fr); grid-template-rows: repeat({{this.gridRowData.length}}, auto)"
            class='p-2 mb-10'>
            <div></div><div></div>

            {{# for(quarter of this.quartersAndMonths.quarters) }}
                <div style="grid-column: span 3" class="text-center">{{quarter.name}}</div>
            {{ / for }}

            <div></div><div></div>
            {{# for(month of this.quartersAndMonths.months)}}
                <div class='border-b border-neutral-80 text-center'>{{month.name}}</div>
            {{/ for }}

            <!-- CURRENT TIME BOX -->
            <div style="grid-column: 3 / span {{this.quartersAndMonths.months.length}}; grid-row: 3 / span {{this.gridRowData.length}};">
                <div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 1000; position: relative; height: 100%;"></div>
            </div>


            <!-- VERTICAL COLUMNS -->
            {{# for(month of this.quartersAndMonths.months)}}
                <div style="grid-column: {{ plus(scope.index, 3) }}; grid-row: 3 / span {{this.gridRowData.length}}; z-index: 10"
                    class='border-l border-b border-neutral-80 {{this.lastRowBorder(scope.index)}}'></div>
            {{/ for }}

            <!-- Each of the issues -->
            {{# for(data of this.gridRowData) }}
                {{# eq(data.type, "issue") }}
                
                    <div on:click='this.showTooltip(scope.event,data.issue)' 
                        class='pointer border-y-solid-1px-white text-right {{this.classForSpecialStatus(data.issue.rollupStatuses.rollup.status)}} truncate max-w-96 {{this.textSize}}'>
                        {{data.issue.summary}}
                    </div>
                    <div style="grid-column: 2" class="{{this.textSize}} text-right pointer"
                        on:click="this.showPercentCompleteTooltip(scope.event, data.issue)">{{this.getPercentComplete(data.issue)}}
                    </div>
                    {{ this.getReleaseTimeline(data.issue, scope.index) }}
                {{/ eq }}

                {{# eq(data.type, "parent") }}
                    <div on:click='this.showTooltip(scope.event,data.issue)' 
                        class='pointer border-y-solid-1px-white text-left font-bold {{this.classForSpecialStatus(data.issue.rollupStatuses.rollup.status)}} truncate max-w-96 {{this.textSize}}'>
                        {{data.issue.summary}}
                    </div>
                    <div style="grid-column: 2" class="{{this.textSize}} text-right pointer"
                        on:click="this.showPercentCompleteTooltip(scope.event, data.issue)">
                    </div>
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
  };
  get lotsOfIssues() {
    return this.primaryIssuesOrReleases.length > 20 && !this.breakdown;
  }
  get textSize() {
    return this.lotsOfIssues ? "text-xs pt-1 pb-0.5 px-1" : "p-1";
  }
  get bigBarSize() {
    return this.lotsOfIssues ? "h-4" : "h-6";
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
  plus(first, second) {
    return first + second;
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
    return getQuartersAndMonths(new Date(), due);
  }
  get todayMarginLeft() {
    const { firstDay, lastDay } = this.quartersAndMonths;
    const totalTime = lastDay - firstDay;
    return ((new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime) * 100;
  }
  get gridRowData() {
    if (this.groupBy === "parent") {
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
    } else if (this.groupBy === "team") {
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
      return this.primaryIssuesOrReleases.map((issue) => {
        return { type: "issue", issue };
      });
    }
  }
  groupElement(issue, index) {
    const base = {
      gridColumn: "3 / span " + this.quartersAndMonths.months.length,
      gridRow: `${index + 3}`,
    };

    const background = document.createElement("div");

    Object.assign(background.style, {
      ...base,
      zIndex: 0,
    });
    background.className = index % 2 ? "color-bg-gray-20" : "";
    return stache.safeString(background);
  }
  /**
   *
   * @param {} release
   * @param {*} index
   * @returns
   */
  getReleaseTimeline(release, index) {
    const base = {
      gridColumn: "3 / span " + this.quartersAndMonths.months.length,
      gridRow: `${index + 3}`,
    };

    const background = document.createElement("div");

    Object.assign(background.style, {
      ...base,
      zIndex: 0,
    });

    background.className = index % 2 ? "color-bg-gray-20" : "";

    const root = document.createElement("div");
    const lastPeriodRoot = document.createElement("div");
    root.appendChild(lastPeriodRoot);

    Object.assign(root.style, {
      ...base,
      position: "relative",
      zIndex: 20,
    });
    root.className = "py-1";

    Object.assign(lastPeriodRoot.style, {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
    });
    lastPeriodRoot.className = "py-1 lastPeriod";

    const { firstDay, lastDay } = this.quartersAndMonths;
    const totalTime = lastDay - firstDay;

    if (release.rollupStatuses.rollup.start && release.rollupStatuses.rollup.due) {
      function getPositions(work) {
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
          startExtends,
          endExtends,
          style: {
            width: Math.max(((end - start) / totalTime) * 100, 0) + "%",
            marginLeft: "max(" + ((start - firstDay) / totalTime) * 100 + "%, 1px)",
          },
        };
      }

      function makeLastPeriodElement(status, timing) {
        const behindTime = document.createElement("div");
        behindTime.style.backgroundClip = "content-box";
        behindTime.style.opacity = "0.9";
        behindTime.style.position = "relative";
        behindTime.className = "border-y-solid-1px";

        if (timing && status === "behind") {
          Object.assign(behindTime.style, getPositions(timing || {}).style);
          behindTime.style.zIndex = 1;
          behindTime.classList.add("color-text-and-bg-behind-last-period");
        }
        if (timing && status === "ahead") {
          Object.assign(behindTime.style, getPositions(timing || {}).style);
          behindTime.classList.add("color-text-and-bg-ahead-last-period");
          behindTime.style.zIndex = -1;
        }
        if (timing && status === "blocked") {
          Object.assign(behindTime.style, getPositions(timing || {}).style);
          behindTime.classList.add("color-text-and-bg-blocked-last-period");
          behindTime.style.zIndex = 1;
        }
        if (timing && status === "warning") {
          Object.assign(behindTime.style, getPositions(timing || {}).style);
          behindTime.classList.add("color-text-and-bg-warning-last-period");
          behindTime.style.zIndex = 1;
        }
        return behindTime;
      }

      if (this.breakdown) {
        /*
                    const lastDev = makeLastPeriodElement(release.rollupStatuses.dev.status, release.rollupStatuses.dev.lastPeriod);
                    lastDev.classList.add("h-2","py-[2px]");
                    lastPeriodRoot.appendChild(lastDev);

                    const dev = document.createElement("div");
                    dev.className = "dev_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.rollupStatuses.dev.status;
                    Object.assign(dev.style, getPositions(release.rollupStatuses.dev).style);
                    root.appendChild(dev);*/

        const workTypes = this.hasWorkTypes.list.filter((wt) => wt.hasWork);
        for (const { type } of workTypes) {
          const lastPeriod = makeLastPeriodElement(
            release.rollupStatuses[type].status,
            release.rollupStatuses[type].lastPeriod
          );
          lastPeriod.classList.add("h-2", "py-[2px]");
          lastPeriodRoot.appendChild(lastPeriod);

          const thisPeriod = document.createElement("div");
          thisPeriod.className =
            type + "_time h-2 border-y-solid-1px-white color-text-and-bg-" + release.rollupStatuses[type].status;
          Object.assign(thisPeriod.style, getPositions(release.rollupStatuses[type]).style);
          root.appendChild(thisPeriod);
        }
        /*
                    if(this.hasQAWork) {
                        const lastQA = makeLastPeriodElement(release.rollupStatuses.qa.status, release.rollupStatuses.qa.lastPeriod);
                        lastQA.classList.add("h-2","py-[2px]");
                        lastPeriodRoot.appendChild(lastQA);


                        const qa = document.createElement("div");
                        qa.className = "qa_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.rollupStatuses.qa.status;
                        Object.assign(qa.style, getPositions(release.rollupStatuses.qa).style);
                        root.appendChild(qa);

                        
                    }
                    if(this.hasUATWork) {
                        const lastUAT = makeLastPeriodElement(release.rollupStatuses.uat.status, release.rollupStatuses.uat.lastPeriod);
                        lastUAT.classList.add("h-2","py-[2px]");
                        lastPeriodRoot.appendChild(lastUAT);


                        const uat = document.createElement("div");
                        uat.className = "uat_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.rollupStatuses.uat.status;
                        Object.assign(uat.style, getPositions(release.rollupStatuses.uat).style);
                        root.appendChild(uat);

                        
                    }*/
      } else {
        const behindTime = makeLastPeriodElement(
          release.rollupStatuses.rollup.status,
          release.rollupStatuses.rollup.lastPeriod
        );
        behindTime.classList.add(this.bigBarSize, "py-1");
        lastPeriodRoot.appendChild(behindTime);

        const team = document.createElement("div");
        team.className =
          this.bigBarSize + " border-y-solid-1px-white color-text-and-bg-" + release.rollupStatuses.rollup.status;
        Object.assign(team.style, getPositions(release.rollupStatuses.rollup).style);
        team.style.opacity = "0.9";

        root.appendChild(team);
      }
    }
    const frag = document.createDocumentFragment();
    frag.appendChild(background);
    frag.appendChild(root);
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

customElements.define("gantt-grid", GanttGrid);
