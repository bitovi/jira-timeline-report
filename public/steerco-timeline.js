// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";

import { getCalendarHtml, getQuarter, getQuartersAndMonths } from "./quarter-timeline.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS } from "./date-helpers.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { day: "numeric", month: "short" })

const inQAStatus = { "QA": true, "In QA": true };
const inDevStatus = { "In Development": true, "Development": true };
const inPartnerReviewStatus = { "Partner Review": true };
const inDoneStatus = { "Done": true };



class SteercoTimeline extends StacheElement {
		static view = `

		{{# if(this.showGanttGrid) }}
			<div style="display: grid; grid-template-columns: auto repeat({{this.quartersAndMonths.months.length}}, [col] 1fr); grid-template-rows: repeat({{this.gridRows}}, auto)"
				class='p2 mb-10'>
				<div></div>

				{{# for(quarter of this.quartersAndMonths.quarters) }}
					<div style="grid-column: span 3" class="text-center">{{quarter.name}}</div>
				{{ / for }}

				<div></div>
				{{# for(month of this.quartersAndMonths.months)}}
					<div class='border-b-solid-2px-slate-900 text-center'>{{month.name}}</div>
				{{/ for }}


				<!-- VERTICAL COLUMNS -->
				{{# for(month of this.quartersAndMonths.months)}}
					<div style="grid-column: {{ plus(scope.index, 2) }}; grid-row: 3 / span {{this.gridRows}}; z-index: 10"
						class='border-l-solid-1px-slate-900 border-b-solid-1px-slate-900'></div>
				{{/ for }}

				<!-- <div style="grid-column: 7; grid-row: 3 / span {{this.gridRows}}; z-index: 10"
					class='border-l-solid-1px-slate-400 border-b-solid-1px-slate-900 border-r-solid-1px-slate-900'></div> -->

				{{# for(initiative of this.initiatives) }}
					<div class='p2'>{{initiative.Summary}}</div>
					{{this.getReleaseTimeline(initiative, scope.index)}}
				{{/ for }}

			</div>
		{{ else }}

			<div class='calendar_wrapper'>{{this.calendarHTML}}</div>

			<div class='gantt simple-timings'>{{# for(chart of this.releaseGantt) }}
					{{chart}}
				{{/}}
				<div class='today' style="margin-left: {{this.todayMarginLeft}}%"></div>
			</div>

		{{/ if }}
		<div class='release_wrapper {{# if(this.showExtraTimings) }}extra-timings{{else}}simple-timings{{/ if}}'>


		</div>
	`
		get showGanttGrid(){
			return this.showExtraTimings || this.initiatives;
		}
		get gridRows() {
			return this.initiatives ? this.initiatives.length : this.releases.length;
		}

		get startAndEndDate(){
			const startDate = new Date(
					new Date().getFullYear(),
					Math.floor(new Date().getMonth() / 3) * 3
			);
			let hasDate;
			if(this.releases) {
				hasDate = this.releases.filter(r => r.team.due);
			} else if(this.initiatives) {
				hasDate = this.initiatives.filter(r => r.team.due);
			}

			return {endDate: new Date( Math.max(...hasDate.map(r => r.team.due)) ), startDate};
		}
		get calendarData() {
				const {startDate, endDate} = this.startAndEndDate;
				return getCalendarHtml(startDate, endDate);
		}
		get quartersAndMonths(){
			const {startDate, endDate} = this.startAndEndDate;
			return getQuartersAndMonths(startDate, endDate);
		}
		//const {html, firstDay, lastDay}
		get calendarHTML() {
				return stache.safeString(this.calendarData.html);
		}
		getReleaseTimeline(release, index){
			const base = {
				gridColumn: '2 / span '+this.quartersAndMonths.months.length,
				gridRow: `${index+3}`,
			};

			const background = document.createElement("div");

			Object.assign(background.style, {
				...base,
				zIndex: 0
			});

			background.className = (index % 2 ? "color-bg-slate-300" : "")

			const root = document.createElement("div");

			Object.assign(root.style, {
				...base,
				position: "relative",
				zIndex: 20
			});

			root.className = "py-1"

			const { firstDay, lastDay } = this.calendarData;
			const totalTime = (lastDay - firstDay);

			if (release.team.start && release.team.due) {

					function getPositions(work) {

						const start = Math.max(firstDay, work.start);
						const end = Math.min(lastDay, work.due);
						const startExtends = work.start < firstDay;
						const endExtends = work.due > lastDay;

						return {
							start, end, startExtends, endExtends,
							style: {
								width: Math.max( (((end - start) / totalTime) * 100), 0) + "%",
								marginLeft: (((start - firstDay) / totalTime) * 100) +"%"
							}
						}
					}


					const dev = document.createElement("div");
					dev.className = "dev_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.devStatus;

					Object.assign(dev.style, getPositions(release.dev).style);
					root.appendChild(dev);

					const qa = document.createElement("div");
					qa.className = "qa_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.qaStatus;

					Object.assign(qa.style, getPositions(release.qa).style);
					root.appendChild(qa);


					const uat = document.createElement("div");
					uat.className = "uat_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.uatStatus;
					Object.assign(uat.style, getPositions(release.uat).style);
					root.appendChild(uat);
			}
			const frag = document.createDocumentFragment();
			frag.appendChild(background);
			frag.appendChild(root);
			return stache.safeString(frag);
		}
		get todayMarginLeft() {
				const { firstDay, lastDay } = this.calendarData;
				const totalTime = (lastDay - firstDay);
				return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
		}
		releaseTimeline() {
				const { firstDay, lastDay } = this.calendarData;
				const totalTime = (lastDay - firstDay);

				return this.releases.map((release, index) => {

						const div = document.createElement("div");
						if (release.team.due) {
								div.className = "release-timeline-item color-text-and-bg-" + release.status;
								div.style.left = ((release.team.due - firstDay) / totalTime * 100) + "%";
								div.appendChild(document.createTextNode(release.shortVersion))
						}


						return div;
				})
		}
		releaseGanttWithTimeline() {
				const { firstDay, lastDay } = this.calendarData;
				const totalTime = (lastDay - firstDay);

				return this.releases.map((release, index) => {

						const div = document.createElement("div");

						if (release.team.start && release.team.due) {
								const width = ((release.team.due - release.team.start) / totalTime);

								//div.style.top = (index * 20)+"px";
								div.style.width = (width * 100) + "%";
								div.style.marginLeft = ((release.team.start - firstDay) / totalTime * 100) + "%";

								div.className = "release_time " //+this.releaseQaStatus(release);


								const dev = document.createElement("div");
								dev.className = "dev_time " //+this.releaseDevStatus(release);

								const devWidth = ((release.dev.due - release.dev.start) / totalTime);
								dev.style.width = (devWidth / width * 100) + "%";
								div.appendChild(dev);

								const qa = document.createElement("div");
								qa.className = "qa_time " //+this.releaseDevStatus(release);

								const qaWidth = ((release.qa.due - release.qa.start) / totalTime);
								qa.style.width = (qaWidth / width * 100) + "%";
								div.appendChild(qa);


								const uat = document.createElement("div");
								uat.className = "uat_time "; //+this.releaseUatStatus(release);
								const uatWidth = ((release.uat.due - release.uat.start) / totalTime);

								uat.style.width = (uatWidth / width * 100) + "%";
								div.appendChild(uat);

								div.appendChild(document.createTextNode(release.shortName))

						}


						return div;
				})
		}
		get releaseGantt() {
				if (this.showExtraTimings) {
						return this.releaseGanttWithTimeline();
				} else {
						return this.releaseTimeline();
				}
		}
		prettyDate(date) {
				return date ? dateFormatter.format(date) : "";
		}
		wasReleaseDate(release) {

				const current = release.due;
				const was = release.dueLastPeriod;

				if (current - DAY_IN_MS > was) {
						return " (" + this.prettyDate(was) + ")";
				} else {
						return ""
				}
		}
		plus(first, second) {
			return first + second;
		}
}



customElements.define("steerco-timeline", SteercoTimeline);
