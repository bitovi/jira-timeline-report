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

		{{# if(this.showExtraTimings) }}
			<div style="display: grid; grid-template-columns: auto repeat(6, [col] 1fr); grid-template-rows: repeat({{this.releases.length}}, auto)"
				class='p2 mb-10'>
				<div></div>


				<div style="grid-column: 2 / span 3" class="text-center">{{this.quartersAndMonths.quarters[0].name}}</div>
				<div style="grid-column: 5 / span 3" class="text-center">{{this.quartersAndMonths.quarters[1].name}}</div>

				<div></div>
				{{# for(month of this.quartersAndMonths.months)}}
					<div class='border-b-solid-2px-slate-900 text-center'>{{month.name}}</div>
				{{/ for }}


				<!-- VERTICAL COLUMNS -->
				<div style="grid-column: 2; grid-row: 3 / span {{this.releases.length}}; z-index: 10"
					class='border-l-solid-1px-slate-900 border-b-solid-1px-slate-900'></div>
				<div style="grid-column: 3; grid-row: 3 / span {{this.releases.length}}; z-index: 10"
					class='border-l-solid-1px-slate-400 border-b-solid-1px-slate-900'></div>
				<div style="grid-column: 4; grid-row: 3 / span {{this.releases.length}}; z-index: 10"
					class='border-l-solid-1px-slate-400 border-b-solid-1px-slate-900'></div>
				<div style="grid-column: 5; grid-row: 3 / span {{this.releases.length}}; z-index: 10"
					class='border-l-solid-1px-slate-400 border-b-solid-1px-slate-900'></div>
				<div style="grid-column: 6; grid-row: 3 / span {{this.releases.length}}; z-index: 10"
					class='border-l-solid-1px-slate-400 border-b-solid-1px-slate-900'></div>
				<div style="grid-column: 7; grid-row: 3 / span {{this.releases.length}}; z-index: 10"
					class='border-l-solid-1px-slate-400 border-b-solid-1px-slate-900 border-r-solid-1px-slate-900'></div>

				{{# for(release of this.releases) }}
					<div class='p2'>{{release.shortVersion}}</div>
					{{this.getReleaseTimeline(release, scope.index)}}
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
		{{# for(release of this.releases) }}
			<div class='release_box'>
				<div class="release_box_header_bubble color-text-and-bg-{{release.status}}">{{release.shortName}}</div>
				<div class="release_box_subtitle">
					{{# if(not(eq(release.release, "Next")))}}
						{{# if(this.showExtraTimings) }}
						<div class="release_box_subtitle_wrapper">
								<span class="release_box_subtitle_key color-text-and-bg-{{release.devStatus}}">Dev</span>
								<span class="release_box_subtitle_value">
									{{ this.prettyDate(release.dev.due) }}{{this.wasReleaseDate(release.dev)}}
								</span>
						</div>
						<div class="release_box_subtitle_wrapper">
								<span class="release_box_subtitle_key color-text-and-bg-{{release.qaStatus}}">QA&nbsp;</span>
								<span class="release_box_subtitle_value">
									{{ this.prettyDate(release.qa.due) }}{{this.wasReleaseDate(release.qa)}}
								</span>
						</div>
						<div class="release_box_subtitle_wrapper">
								<span class="release_box_subtitle_key color-text-and-bg-{{release.uatStatus}}">UAT</span>
								<span class="release_box_subtitle_value">
									{{ this.prettyDate(release.uat.due) }}{{this.wasReleaseDate(release.uat)}}
								</span>
						</div>
						{{ else }}
						<div class="release_box_subtitle_wrapper">
								<b>Target Delivery</b>
								<span class="release_box_subtitle_value">
									{{ this.prettyDate(release.uat.due) }}{{this.wasReleaseDate(release.uat)}}
								</span>
						</div>
						{{/ if }}

					{{/ if }}
				</div>
				<ul class="release_box_body">
					{{# for(initiative of release.initiatives) }}
					 <li class='font-sans text-sm {{# unless(this.showExtraTimings) }} color-text-{{initiative.status}} {{/ }}'>
						{{# if(this.showExtraTimings) }}
						<span class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.devStatus}}'>D</span><span
							class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.qaStatus}}'>Q</span><span
							class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.uatStatus}}'>U</span>
						{{/ if }}
						{{initiative.Summary}}
					 </li>
					{{/ for}}
				</ul>
			</div>
		{{/ }}

		</div>
	`
		get calendarData() {
				const startDate = new Date(
						new Date().getFullYear(),
						Math.floor(new Date().getMonth() / 3) * 3
				);
				const hasDate = this.releases.filter(r => r.team.due);
				const lastRelease = hasDate.length && hasDate[hasDate.length - 1];
				const endDate = lastRelease ? lastRelease.team.due : new Date();
				return getCalendarHtml(startDate, endDate);
		}
		get quartersAndMonths(){
			const startDate = new Date(
					new Date().getFullYear(),
					Math.floor(new Date().getMonth() / 3) * 3
			);
			const hasDate = this.releases.filter(r => r.team.due);
			const lastRelease = hasDate[hasDate.length - 1];
			const endDate = lastRelease.team.due;
			return getQuartersAndMonths(startDate, endDate);
		}
		//const {html, firstDay, lastDay}
		get calendarHTML() {
				return stache.safeString(this.calendarData.html);
		}
		getReleaseTimeline(release, index){
			const base = {
				gridColumn: '2 / span 6',
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
				console.log("f", firstDay, "l", lastDay);

				return this.releases.map((release, index) => {

						const div = document.createElement("div");
						if (release.team.due) {
								div.className = "release-timeline-item color-text-and-bg-" + release.status;
								div.style.left = ((release.team.due - firstDay) / totalTime * 100) + "%";
								div.appendChild(document.createTextNode("M" + release.shortVersion))
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
}



customElements.define("steerco-timeline", SteercoTimeline);
