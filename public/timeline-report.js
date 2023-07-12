// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject } from "//unpkg.com/can@6/core.mjs";
//import bootstrap from "https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" assert {type: 'css'};

import "./css/css.js";


import { howMuchHasDueDateMovedForwardChangedSince,
    DAY_IN_MS, parseDateISOString, epicTimingData } from "./date-helpers.js";

import "./timeline-use.js";

import {
    addStatusToInitiative, addStatusToEpic,
    addStatusToRelease, getBusinessDatesCount, inPartnerReviewStatuses
} from "./status-helpers.js";

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
          <details class='border-solid-1px-slate-900 p-2 color-bg-sky-100'>
            <summary>Use</summary>
            <timeline-use></timeline-use>
          </details>
          <details class='border-solid-1px-slate-900 p-2 color-bg-sky-100' open:from="not(this.jql)">

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




						</div>



						<div class='p-4'>
							<p><label class="inline font-bold">Compare to {{this.compareToDaysPrior}} Days Ago</label>
							- Specify what timepoint to use to determine if an initiative or release has fallen behind.</p>
							<input class="w-full-border-box" type='range' valueAsNumber:bind:on:input='this.compareToDaysPrior' min="0" max="90"/>
						</div>

          </details>




					{{# if(this.releases) }}
						<steerco-timeline
							class='w-1280 h-780 border-solid-1px-slate-900 border-box block overflow-hidden'
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


            <h2>Release Breakdown</h2>
            {{# for(release of this.releasesAndNext) }}
              <h2>{{release.release}}</h2>
              <table class='basic-table'>
                <thead>
                <tr><th>Sequence</th>
                    <th>Start</th>
                    <th>Due</th>
                    <th>Due last period</th>
                    <th>Working days</th>
                    <th>Story Points</th>
                </tr>
                </thead>
                <tbody  class='release_box'>
                <tr>
                  <td class='status-{{release.status}}'>E2E</td>
                  <td>{{this.prettyDate(release.team.start)}}</td>
                  <td>{{this.prettyDate(release.team.due)}}</td>
                  <td>{{this.prettyDate(release.team.dueLastPeriod)}}</td>
                  <td>{{release.team.workingBusinessDays}}</td>
                  <td>{{release.team.weightedEstimate}}</td>
                </tr>
                <tr>
                  <td>Dev</td>
                  <td>{{this.prettyDate(release.dev.start)}}</td>
                  <td>{{this.prettyDate(release.dev.due)}}</td>
                  <td>{{this.prettyDate(release.dev.dueLastPeriod)}}</td>
                  <td>{{release.dev.workingBusinessDays}}</td>
                  <td>{{release.dev.weightedEstimate}}</td>
                </tr>
                <tr>
                  <td>QA</td>
                  <td>{{this.prettyDate(release.qa.start)}}</td>
                  <td>{{this.prettyDate(release.qa.due)}}</td>
                  <td>{{this.prettyDate(release.qa.dueLastPeriod)}}</td>
                  <td>{{release.qa.workingBusinessDays}}</td>
                  <td>{{release.qa.weightedEstimate}}</td>
                </tr>
                <tr>
                  <td>UAT</td>
                  <td>{{this.prettyDate(release.uat.start)}}</td>
                  <td>{{this.prettyDate(release.uat.due)}}</td>
                  <td>{{this.prettyDate(release.uat.dueLastPeriod)}}</td>
                  <td>{{release.uat.workingBusinessDays}}</td>
                  <td>{{release.uat.weightedEstimate}}</td>
                </tr>
                </tbody>
              </table>
              <table class='basic-table'>
                <thead>
                <tr><th>Initiative</th>
                    <th>Teams</th>
                    <th>Dev Dates</th>
                    <th>Dev Epics</th>

                    <th>QA Dates</th>
                    <th>QA Epics</th>

                    <th>UAT Dates</th>
                    <th>UAT Epics</th>
                </tr>
                </thead>
                <tbody>
                {{# for(initiative of release.initiatives) }}
                    <tr  class='release_box'>
                      <td><a class="status-{{initiative.status}}" href="{{initiative.url}}">{{initiative.Summary}}</a></td>

                      <td>
                        {{# for(team of this.initiativeTeams(initiative) ) }}
                          {{team}}
                        {{/ for }}
                      </td>

                      <td>
                        Start: {{this.prettyDate(initiative.dev.start)}} <br/>
                        Due: {{this.prettyDate(initiative.dev.due)}} <br/>
                        Last Due: {{this.prettyDate(initiative.dev.dueLastPeriod)}}

                      </td>
                      <td>
                        <ul>
                        {{# for( epic of initiative.dev.issues ) }}
                          <li><a class="status-{{epic.status}}" href="{{epic.url}}">
                            {{epic.Summary}}
                          </a> [{{epic.weightedEstimate}}] ({{epic.workingBusinessDays}})</li>
                        {{/ }}
                        </ul>
                      </td>


                      <td>
                        Start: {{this.prettyDate(initiative.qa.start)}} <br/>
                        Due: {{this.prettyDate(initiative.qa.due)}} <br/>
                        Last Due: {{this.prettyDate(initiative.qa.dueLastPeriod)}}

                      </td>
                      <td>
                        <ul class='release_box'>
                        {{# for( epic of initiative.qa.issues ) }}
                          <li><a class="status-{{epic.status}}" href="{{epic.url}}">
                            {{epic.Summary}}
                          </a></li>
                        {{/ }}
                        </ul>
                      </td>

                      <td>
                        Start: {{this.prettyDate(initiative.uat.start)}} <br/>
                        Due: {{this.prettyDate(initiative.uat.due)}} <br/>
                        Last Due: {{this.prettyDate(initiative.uat.dueLastPeriod)}}

                      </td>
                      <td>
                        <ul class='release_box'>
                        {{# for( epic of initiative.uat.issues ) }}
                          <li><a class="status-{{epic.status}}" href="{{epic.url}}">
                            {{epic.Summary}}
                          </a></li>
                        {{/ }}
                        </ul>
                      </td>
                    </tr>
                  {{/ for}}
                </tbody>
              </table>



              <ul>
              </ul>
            {{/ for }}

          {{ else }}
            {{# if(this.jql) }}
              Loading ...
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
        compareToDaysPrior: {
            type: type.convert(Number),
            default: 15
        },
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
        breakOutTimings: saveJSONToUrl("breakOutTimings", false, Boolean, booleanParsing),
        hideInitiativesInUAT: saveJSONToUrl("hideInitiativesInUAT", false, Boolean, booleanParsing),
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
                    "Product Target Release", PARENT_LINK_KEY, LABELS_KEY, STATUS_KEY],
                expand: ["changelog"]
            });

            Promise.all([
                issuesPromise, serverInfoPromise
            ]).then(([issues, serverInfo]) => {
                this.rawIssues = addWorkingBusinessDays(toCVSFormat(issues, serverInfo));
            })


        }

    }
    drawSlide(results) {
        this.rawIssues = makeObjectsFromRows(results.data);
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
            if (issue[PARENT_LINK_KEY]) {
                if (!map[issue[PARENT_LINK_KEY]]) {
                    map[issue[PARENT_LINK_KEY]] = []
                }
                map[issue[PARENT_LINK_KEY]].push(issue);
            }
        }
        return map;
    }
    get initiativesToShow(){
      if(!this.rawIssues) {
        return []
      }
      const extraRemovedStatuses = this.hideInitiativesInUAT ? inPartnerReviewStatuses : [];
      return  filterOutStatuses(
        filterInitiatives(this.rawIssues),
          ["Done", "Cancelled", "Duplicate", ...extraRemovedStatuses]
        )
    }
    get initiativesWithTimedEpics(){
      const issuesMappedByParentKey = this.issuesMappedByParentKey;
      return this.initiativesToShow.map((i) => {

          const timedEpics = (issuesMappedByParentKey[i[ISSUE_KEY]] || []).map((e) => {
              const { dueDateWasPriorToTheFirstChangeAfterTheCheckpoint } = howMuchHasDueDateMovedForwardChangedSince(e,
                  new Date(new Date().getTime() - this.compareToDaysPrior * DAY_IN_MS)
              )
              return addStatusToEpic({
                  ...e,
                  dueLastPeriod: dueDateWasPriorToTheFirstChangeAfterTheCheckpoint
              })
          });

          // try to figure out what is dev or QA
          const qaEpics = new Set(filterQAWork(timedEpics));
          const uatEpics = new Set(filterPartnerReviewWork(timedEpics));
          const devEpics = timedEpics.filter(epic => !qaEpics.has(epic) && !uatEpics.has(epic))

          return addStatusToInitiative({
              ...i,
              team: epicTimingData(timedEpics),
              dev: epicTimingData([...devEpics]),
              qa: epicTimingData([...qaEpics]),
              uat: epicTimingData([...uatEpics])
          });
      });
    }
    get initiativesWithAStartAndEndDate(){
      return this.initiativesWithTimedEpics.filter( (i) => {
        return i.team.start < i.team.due;
      })
    }
    get sortedIncompleteReleasesInitiativesAndEpics() {
        if (!this.rawIssues) {
            return [];
        }

        const releasesToInitiatives = mapReleasesToIssues(
            filterReleases( this.initiativesWithTimedEpics, this.getReleaseValue ),
            this.getReleaseValue
        );

        const unsortedReleases = Object.keys(releasesToInitiatives).map((release, index) => {

            const initiatives = releasesToInitiatives[release];

            const releaseObject = {
              release,
              initiatives
            };

            for (const key of ["team", "dev", "qa", "uat"]) {
                releaseObject[key] = epicTimingData(
                    initiatives.map(i => i[key].issues).flat()
                )
            }

            return addTeamBreakdown(addStatusToRelease(releaseObject));
        });
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

function filterInitiatives(issues) {
    return issues.filter(issue => issue[ISSUE_TYPE_KEY].includes("Initiative"))
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
function filterOutStatuses(issues, statuses) {
    return issues.filter(issue => !statuses.includes(issue.Status))
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

function filterByLabel(issues, label) {
    return issues.filter(
        issue => issue[LABELS_KEY].filter(
            l => l.includes(label)
        ).length
    );
}
function filterQAWork(issues) {
    return filterByLabel(issues, "QA")
}
function isQAWork(issue) {
    return filterQAWork([issue]).length > 0
}
function filterPOSWork(issues) {
    return filterByLabel(issues, "POS_WORK")
}
function filterPartnerReviewWork(issues) {
    return filterByLabel(issues, "UAT")
}
function isPartnerReviewWork(issue) {
    return filterPartnerReviewWork([issue]).length > 0
}


function sortReadyFirst(initiatives) {
    return initiatives.sort((a, b) => {
        if (a.Status === "Ready") {
            return -1;
        }
        return 1;
    })
}

function toCVSFormat(issues, serverInfo) {
    return issues.map(issue => {
        return {
            ...issue.fields,
            changelog: issue.changelog,
            "Project key": issue.key.replace(/-.*/, ""),
            [ISSUE_KEY]: issue.key,
            url: serverInfo.baseUrl + "/browse/" + issue.key,
            [ISSUE_TYPE_KEY]: issue.fields[ISSUE_TYPE_KEY].name,
            [PRODUCT_TARGET_RELEASE_KEY]: issue.fields[PRODUCT_TARGET_RELEASE_KEY]?.[0],
            [PARENT_LINK_KEY]: issue.fields[PARENT_LINK_KEY]?.data?.key,
            [STATUS_KEY]: issue.fields[STATUS_KEY]?.name
        }
    })
}

function newDateFromYYYYMMDD(dateString) {
    const [year, month, day] = dateString.split("-");
    return new Date(year, month - 1, day);
}

function addWorkingBusinessDays(issues) {


    return issues.map(issue => {
        let weightedEstimate = null;
        if (issue["Story Points"]) {
            if (issue["Confidence"]) {
                weightedEstimate = issue["Story Points"] + Math.round(estimateExtraPoints(issue["Story Points"], issue["Confidence"]));
            } else {
                weightedEstimate = issue["Story Points"];
            }
        }



        return {
            ...issue,
            workType: isQAWork(issue) ? "qa" : (isPartnerReviewWork(issue) ? "uat" : "dev"),
            workingBusinessDays:
                issue["Due date"] && issue["Start date"] ?
                    getBusinessDatesCount(new Date(issue["Start date"]), new Date(issue["Due date"])) : null,
            weightedEstimate: weightedEstimate
        };
    })
}



function addTeamBreakdown(release) {

    return {
        ...release
    }
}



// ontrack
// behind
// complete
