// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";
import { getBusinessDatesCount } from "./status-helpers.js";


const DAY = 1000 * 60 * 60 * 24;

class CapacityPlanning extends StacheElement {
    static view = `
		<h2>Capacity Planner</h2>
		<input valueAsDate:to="this.startDate" type='date'/>
		<input valueAsDate:to="this.endDate" type='date'/>

		{{# if(this.workBreakdownSummary)}}

			{{# for(team of this.workBreakdownSummary)}}
				<h3>Work for {{team.name}}</h3>
				<h4>Dev Work (total = {{team.dev.sum}})</h4>

				<table>
					<thead>
						<tr><th>Features</th><th>Jira Link</th><th>Points</th></tr>
					</thead>
					<tbody>

						{{# for(epic of team.dev.issues)}}
							<tr><td>{{epic.Summary}}</td><td><a href="{{initiative.url}}">{{epic["Issue key"]}}</a></td><td>{{epic.workingDaysInPeriod}}</td></tr>
						{{/ for}}
					</tbody>
				</table>

			{{/}}

		{{/ if}}


		{{# if(this.epicsBetweenDates)}}
			{{# for(epic of this.epicsBetweenDates)}}
				<p>{{epic.Summary}} -  {{epic.workingDaysInPeriod}}</p>
			{{/ }}
		{{/}}
	`;

    static props = {
        startDate: {
            type: type.maybe(Date),
        },
        endDate: {
            type: type.maybe(Date),
        },
        rawIssues: type.Any,
        get epicsBetweenDates() {
            if (this.rawIssues && this.startDate && this.endDate) {
                return this.rawIssues.filter((issue) => {
                    if (issue["Issue Type"] === "Epic") {
                        if (issue["Start date"] || issue["Due date"]) {
                            const epicStart = issue["Start date"] ? new Date(issue["Start date"]).getTime() : 0;
                            const epicEnd = issue["Due date"] ? new Date(issue["Due date"]).getTime() : Infinity;
                            return this.startDate.getTime() <= epicEnd && epicStart <= this.endDate.getTime()
                        }

                    }
                    return false;
                }).map((epic) => {
                    let epicStart = epic["Start date"] ? new Date(epic["Start date"]) : this.startDate;
                    let epicEnd = epic["Due date"] ? new Date(epic["Due date"]) : this.endDate;
                    if (epicStart <= this.startDate) {
                        epicStart = this.startDate
                    }
                    if (epicEnd >= this.endDate) {
                        epicEnd = this.endDate
                    }

                    return {
                        ...epic,
                        workingDaysInPeriod: getBusinessDatesCount(epicStart, epicEnd)
                    }
                })
            }
        }
    }
    get teams() {
        if (!this.rawIssues) {
            return new Set();
        }
        return new Set(this.rawIssues.map(issue => issue["Project key"]));
    }
    get workBreakdownSummary() {
        if (this.epicsBetweenDates) {
            const teams = [...this.teams].map((team) => {
                return {
                    name: team,
                    dev: {
                        issues: [],
                        sum: 0
                    },
                    qa: {
                        issues: [],
                        sum: 0
                    },
                    uat: {
                        issues: [],
                        sum: 0
                    }
                }
            })
            this.epicsBetweenDates.forEach((epic) => {
                // fix O(n^2) later
                const team = teams.find(team => epic["Project key"] === team.name);
                team[epic.workType].issues.push(epic);
                team[epic.workType].sum += epic.workingDaysInPeriod;
            });
            return teams;
        }
    }
}


customElements.define("capacity-planning", CapacityPlanning);
