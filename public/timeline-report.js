// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject } from "//unpkg.com/can@6/core.mjs";
//import bootstrap from "https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" assert {type: 'css'};

import "./css/css.js";


import { howMuchHasDueDateMovedForwardChangedSince,
    DAY_IN_MS, parseDateISOString, epicTimingData } from "./date-helpers.js";

import "./timeline-use.js";

import {
    addStatusToInitiative, addStatusToEpic,
    addStatusToRelease, getBusinessDatesCount, inPartnerReviewStatuses,
    inIdeaStatus,
    inIdeaStatuses
} from "./status-helpers.js";

import {releasesAndInitiativesWithPriorTiming, 
  rawIssuesToBaseIssueFormat, filterOutInitiativeStatuses} from "../prepare-issues/prepare-issues.js";

import semverReleases from "./semver-releases.js";
import sortedByLastEpicReleases from "./sorted-by-last-epic-releases.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: "short" });
const booleanParsing = {
  parse: x => {
    return ({"": true, "true": true, "false": false})[x];
  },
  stringify: x => ""+x
};

import { estimateExtraPoints } from "./confidence.js";
import {saveJSONToUrl} from "./shared/state-storage.js";

import "./steerco-timeline.js";

const ISSUE_KEY = "Issue key";
const PRODUCT_TARGET_RELEASE_KEY = "Product Target Release";
const ISSUE_TYPE_KEY = "Issue Type";
const PARENT_LINK_KEY = "Parent Link";
const START_DATE_KEY = "Start date";
const DUE_DATE_KEY = "Due date";
const LABELS_KEY = "Labels";
const STATUS_KEY = "Status";
const FIX_VERSIONS_KEY = "Fix versions";


export class TimelineReport extends StacheElement {
    static view = `
          <details class='rounded-lg-gray-100-on-white my-2 drop-shadow-sm'>
            <summary>Use</summary>
            <timeline-use class="p-4 block"></timeline-use>
          </details>
          <details class='rounded-lg-gray-100-on-white my-2 drop-shadow-sm' open:from="not(this.jql)">

            <summary>
              Configure
            </summary>

						<div class='p-4'>
							<p><label class="inline font-bold">JQL</label>
							- Specify a JQL to load your project's initiatives and epics.</p>
							<input class="w-full-border-box mt-2" value:bind='this.jql'/>
						</div>

						<div class="grid gap-3 p-4" style="grid-template-columns: max-content max-content 1fr">

							<label class='font-bold'>Show Releases</label>
							<input type='checkbox' checked:bind='this.showReleasesInTimeline'/>
							<p>Instead of showing the timing for initiatives, show the timing for releases. Initiatives
							must have their <code>release</code> (also called <code>Fix version</code>) field set.
							</p>

							{{# if(this.showReleasesInTimeline) }}
							<label class='font-bold'>Show Only Semver Releases</label>
							<input type='checkbox' checked:bind='this.showOnlySemverReleases'/>
							<p>This will only include releases that have a structure like <code>[NAME]_[D.D.D]</code>. Examples:
							<code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.
							</p>
							{{/ }}

							<label class='font-bold'>Break out Dev, QA and UAT</label>
							<input type='checkbox' checked:bind='this.breakOutTimings'/>
							<p>If initiatives have epics labelled with "QA" and/or "UAT", the report will show individual timelines and
								statuses for Development, QA, and UAT.
							</p>

							<label class='font-bold'>Ignore Initiatives in UAT</label>
							<input type='checkbox' checked:bind='this.hideInitiativesInUAT'/>
							<p>Initiatives that are in UAT will not be shown. Check this if you do not want to
							report on work that is in its final stages.
							</p>

              <label class='font-bold'>Ignore Initiatives in Idea</label>
							<input type='checkbox' checked:bind='this.hideInitiativesInIdea'/>
							<p>Initiatives that have an Open, To Do, or Idea status will not be shown.
							</p>


						</div>



						<div class='p-4'>
							<p><label class="inline font-bold">Compare to {{this.compareToTime.text}}</label>
							- Specify what timepoint to use to determine if an initiative or release has fallen behind.</p>
							<input class="w-full-border-box" type='range' valueAsNumber:bind:on:input='this.timeSliderValue' min="0" max="100"/>
						</div>

          </details>




					{{# if(this.releases) }}
						<steerco-timeline
							class='my-2  border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md'
							releases:from="this.releases"
							initiatives:from="this.initiativesWithAStartAndEndDate"
							breakOutTimings:from="this.breakOutTimings"
							showReleasesInTimeline:from="this.showReleasesInTimeline"
							/>

            <div class='border-solid-1px-slate-900 p-2'>
              <span class='color-text-and-bg-notstarted p-2 inline-block'>Not Started</span>
              <span class='color-text-and-bg-ontrack p-2 inline-block'>On Track</span>
              <span class='color-text-and-bg-blocked p-2 inline-block'>Blocked</span>
              <span class='color-text-and-bg-complete p-2 inline-block'>Complete</span>
              <span class='color-text-and-bg-behind p-2 inline-block'>Behind</span>
              <span class='color-text-and-bg-unknown p-2 inline-block'>Unknown</span>
            </div>

          {{ else }}
            {{# if(this.jql) }}
              <div class="my-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">Loading ...</div>
            {{/ if }}
          {{/ if}}

  `;
    static props = {
        uploadUrl: {
            get default() {
                return localStorage.getItem("csv-url") || "";
            },
            set(newVal) {
                localStorage.setItem("csv-url", newVal);
                return newVal;
            }
        },
        timeSliderValue: {
          type: type.convert(Number),
          default: 25
        },
        get compareToTime(){
          const SECOND = 1000;
          const MIN = 60 * SECOND;
          const HOUR = 60 * MIN;
          const DAY = 24 * HOUR;
          if(this.timeSliderValue === 0) {
            return {timePrior: 0, text: "now"}
          }
          if(this.timeSliderValue === 1) {
            return {timePrior: 30*SECOND, text: "30 seconds ago"}
          }
          if(this.timeSliderValue === 2) {
            return {timePrior: MIN, text: "1 minute ago"}
          }
          if(this.timeSliderValue === 3) {
            return {timePrior: 5*MIN, text: "5 minutes ago"}
          }
          if(this.timeSliderValue === 4) {
            return {timePrior: 10*MIN, text: "10 minutes ago"}
          }
          if(this.timeSliderValue === 5) {
            return {timePrior: 30*MIN, text: "30 minutes ago"}
          }
          if(this.timeSliderValue === 6) {
            return {timePrior: HOUR, text: "1 hour ago"}
          }
          if(this.timeSliderValue === 7) {
            return {timePrior: 3*HOUR, text: "3 hours ago"}
          }
          if(this.timeSliderValue === 8) {
            return {timePrior: 6*HOUR, text: "6 hours ago"}
          }
          if(this.timeSliderValue === 9) {
            return {timePrior: 12*HOUR, text: "12 hours ago"}
          }
          if(this.timeSliderValue === 10) {
            return {timePrior: DAY, text: "1 day ago"}
          } else {
            const days = this.timeSliderValue - 10;
            return {timePrior: DAY*days, text: days+" days ago"}
          }
          const days = this.timeSliderValue;
          return {timePrior: (MIN / 2) *this.timeSliderValue, text: this.timeSliderValue+" days ago"}
        },
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
        breakOutTimings: saveJSONToUrl("breakOutTimings", false, Boolean, booleanParsing),
        hideInitiativesInUAT: saveJSONToUrl("hideInitiativesInUAT", false, Boolean, booleanParsing),
        hideInitiativesInIdea: saveJSONToUrl("hideInitiativesInIdea", false, Boolean, booleanParsing),
        showReleasesInTimeline: saveJSONToUrl("showReleasesInTimeline", false, Boolean, booleanParsing),
        jql: saveJSONToUrl("jql", "issueType in (Initiative, Epic) order by Rank", String, {parse: x => ""+x, stringify: x => ""+x}),
        mode: {
            type: String,
        },
        getReleaseValue: {
            type: Function,
            default: function (issue) {
                return issue?.[FIX_VERSIONS_KEY]?.[0]?.name;
            }
        }
    };
    // hooks
    async connected() {

        this.jiraHelpers.getServerInfo().then((serverInfo) => {
            this.serverInfo = serverInfo;
        });

        if (this.jql) {
            const serverInfoPromise = this.jiraHelpers.getServerInfo();

            const issuesPromise = this.jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields({
                jql: this.jql,
                fields: ["summary",
                    "Rank",
                    "Start date",
                    "Due date",
                    "Issue Type",
                    "Fix versions",
                    "Story Points",
                    "Confidence",
                    "Product Target Release", PARENT_LINK_KEY, LABELS_KEY, STATUS_KEY, "Sprint", "Epic Link", "Created"],
                expand: ["changelog"]
            });

            Promise.all([
                issuesPromise, serverInfoPromise
            ]).then(([issues, serverInfo]) => {
                this.rawIssues = rawIssuesToBaseIssueFormat(issues, serverInfo);
            })


        }

    }
    get teams() {
        if (!this.rawIssues) {
            return new Set();
        }
        return new Set(this.rawIssues.map(issue => issue["Project key"]));
    }
    get teamKeyToCharacters() {
        if (!this.teams) {
            return [];
        }
        const names = this.teams;
        return characterNamer(names);
    }
    get issuesMappedByParentKey() {
        if (!this.rawIssues) {
            return {};
        }
        const map = {};
        for (const issue of this.rawIssues) {
            const parentKeyValue = issue[PARENT_LINK_KEY] || issue["Epic Link"];
            if ( parentKeyValue ) {
              if (!map[parentKeyValue]) {
                  map[parentKeyValue] = []
              }
              map[parentKeyValue].push(issue);
            }
        }
        return map;
    }
    get releasesAndInitiativesWithPriorTiming(){
      if(!this.rawIssues) {
        return {releases: [], initiatives: []}
      }

      // Remove initiatives with certain statuses
      let initiativeStatusesToRemove = ["Done", "Cancelled", "Duplicate"];
      if(this.hideInitiativesInUAT) {
        initiativeStatusesToRemove = [...initiativeStatusesToRemove, ...inPartnerReviewStatuses];
      }
      if(this.hideInitiativesInIdea) {
        initiativeStatusesToRemove = [...initiativeStatusesToRemove, ...inIdeaStatuses];
      }

      const filteredInitiatives =  filterOutInitiativeStatuses( this.rawIssues, initiativeStatusesToRemove )

      return releasesAndInitiativesWithPriorTiming(filteredInitiatives, 
        new Date( new Date().getTime() - this.compareToTime.timePrior ), 
        !this.hideInitiativesInUAT)
    }
    get initiativesWithTimedEpics(){
      return this.releasesAndInitiativesWithPriorTiming.initiatives;
    }
    get initiativesWithAStartAndEndDate(){
      var initiatives =  this.initiativesWithTimedEpics.filter( (i) => {
        return i.team.start < i.team.due;
      }).sort( (i1, i2) => i1.team.due - i2.team.due);

      if(this.hideInitiativesInIdea) {
        initiatives = initiatives.filter( (initiative) => {
          return !inIdeaStatus[initiative.Status]
        });
      }

      return initiatives;
    }
    get sortedIncompleteReleasesInitiativesAndEpics() {
        const unsortedReleases = this.releasesAndInitiativesWithPriorTiming.releases;
        if(this.showOnlySemverReleases) {
          return semverReleases(unsortedReleases);
        } else {
          return sortedByLastEpicReleases(unsortedReleases);
        }
    }
    get releases() {
        if (!this.rawIssues) {
            return undefined;
        }
        const data = this.sortedIncompleteReleasesInitiativesAndEpics;
        return data;
    }
    get releasesAndNext() {
        if (this.releases) {
            let releasesAndNext = [
                ...this.releases/*,
        {
          release: "Next",
          initiatives: sortReadyFirst(filterPlanningAndReady(
            filterOutReleases(
              filterInitiatives(this.rawIssues),
              this.getReleaseValue
            )))
        }*/];
            return releasesAndNext;
        }
    }

    prettyDate(date) {
        return date ? dateFormatter.format(date) : "";
    }

    initiativeTeams(initiative) {
        return [...new Set(initiative.team.issues.map(issue => issue["Project key"]))];
    }

    /*teamWork(work) {
        const teamToWork = {};
        issues.forEach( issue => {
            let teamKey = issue["Project key"]
            if(!teamToWork[teamKey]) {
                teamToWork[teamKey] = 0
            }
            //teamToWork[teamKey] +=
        }) )
        const teams = [...new Set( work.issues.map( issue => issue["Project key"]) ) ];

    }*/
}



customElements.define("timeline-report", TimelineReport);



function filterByIssueType(issues, issueType) {
    return issues.filter(issue => issue[ISSUE_TYPE_KEY] === issueType)
}



function goodStuffFromIssue(issue) {
    return {
        Summary: issue.Summary,
        [ISSUE_KEY]: issue[ISSUE_KEY],
    }
}

function filterReleases(issues, getReleaseValue) {
    return issues.filter(issue => getReleaseValue(issue))
}

function filterOutReleases(issues, getReleaseValue) {
    return issues.filter(issue => !getReleaseValue(issue));
}
function filterPlanningAndReady(issues) {
    return issues.filter(issue => ["Ready", "Planning"].includes(issue.Status))
}


function mapReleasesToIssues(issues, getReleaseValue) {
    const map = {};
    issues.forEach((issue) => {
        const release = getReleaseValue(issue)
        if (!map[release]) {
            map[release] = [];
        }
        map[release].push(issue);
    })
    return map;
}




function makeIssueMap(issues) {
    if (typeof issues === "object" && !Array.isArray(issues)) {
        return issues;
    }
    const map = {};
    issues.forEach(i => {
        map[i[ISSUE_KEY]] = i;
    })
    return map;
}

function getChildrenOf(issue, issuesOrIssueMap) {
    const children = [];
    const issueMap = makeIssueMap(issuesOrIssueMap);

    for (let issueKey in issueMap) {
        let possibleChild = issueMap[issueKey];
        if (possibleChild[PARENT_LINK_KEY] === issue[ISSUE_KEY]) {
            children.push(possibleChild);
        }
    }
    return children;
}





function sortReadyFirst(initiatives) {
    return initiatives.sort((a, b) => {
        if (a.Status === "Ready") {
            return -1;
        }
        return 1;
    })
}



function newDateFromYYYYMMDD(dateString) {
    const [year, month, day] = dateString.split("-");
    return new Date(year, month - 1, day);
}





function addTeamBreakdown(release) {

    return {
        ...release
    }
}



// ontrack
// behind
// complete
