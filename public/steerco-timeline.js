// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";

import { getCalendarHtml, getQuarter, getQuartersAndMonths } from "./quarter-timeline.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS } from "./date-helpers.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { day: "numeric", month: "short" })

const inQAStatus = { "QA": true, "In QA": true };
const inDevStatus = { "In Development": true, "Development": true };
const inPartnerReviewStatus = { "Partner Review": true };
const inDoneStatus = { "Done": true };

import "./shared/simple-tooltip.js";

class SteercoTimeline extends StacheElement {
		static view = `

		{{# if(this.showGanttGrid) }}
			<div style="display: grid; grid-template-columns: auto repeat({{this.quartersAndMonths.months.length}}, [col] 1fr); grid-template-rows: repeat({{this.gridRows}}, auto)"
				class='p-2 mb-10'>
				<div></div>

				{{# for(quarter of this.quartersAndMonths.quarters) }}
					<div style="grid-column: span 3" class="text-center">{{quarter.name}}</div>
				{{ / for }}

				<div></div>
				{{# for(month of this.quartersAndMonths.months)}}
					<div class='border-b-solid-2px-slate-900 text-center'>{{month.name}}</div>
				{{/ for }}

				<!-- CURRENT TIME BOX -->
				<div style="grid-column: 2 / span {{this.quartersAndMonths.months.length}}; grid-row: 3 / span {{this.gridRows}};">
					<div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 1000; position: relative; height: 100%;"></div>
				</div>


				<!-- VERTICAL COLUMNS -->
				{{# for(month of this.quartersAndMonths.months)}}
					<div style="grid-column: {{ plus(scope.index, 2) }}; grid-row: 3 / span {{this.gridRows}}; z-index: 10"
						class='border-l-solid-1px-slate-900 border-b-solid-1px-slate-900 {{this.lastRowBorder(scope.index)}}'></div>
				{{/ for }}

				{{# if(this.showGanttReleases) }}
					{{# for(release of this.releases) }}
						<div class='p-2'>{{release.shortVersion}}</div>
						{{this.getReleaseTimeline(release, scope.index)}}
					{{/ for }}
				{{ else }}
					{{# for(initiative of this.initiatives) }}
						<div class='p-2 color-text-and-bg-{{initiative.status}} border-y-solid-1px-white'>
							<a href="{{initiative.url}}"
								class='color-text-and-bg-{{initiative.status}} no-underline'>{{initiative.Summary}}</a>
						</div>
						{{this.getReleaseTimeline(initiative, scope.index)}}
					{{/ for }}
				{{/ if }}

			</div>
		{{ else }}

			<div class='calendar_wrapper'>{{this.calendarHTML}}</div>

			<div class='gantt simple-timings'>{{# for(chart of this.releaseGantt) }}
					{{chart}}
				{{/}}
				<div class='today' style="margin-left: {{this.todayMarginLeft}}%"></div>
			</div>

		{{/ if }}
		{{# if(showReleasesInTimeline) }}
		<div class='release_wrapper {{# if(this.breakOutTimings) }}extra-timings{{else}}simple-timings{{/ if}}'>
			{{# for(release of this.releases) }}
				<div class='release_box'>
					<div class="release_box_header_bubble color-text-and-bg-{{release.status}}">{{release.shortName}}</div>
					<div class="release_box_subtitle">
						{{# if(not(eq(release.release, "Next")))}}
							{{# if(this.breakOutTimings) }}
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
										{{ this.prettyDate(release.team.due) }}{{this.wasReleaseDate(release.team)}}
									</span>
							</div>
							{{/ if }}

						{{/ if }}
					</div>
					<ul class="release_box_body list-disc">
						{{# for(initiative of release.initiatives) }}
						 <li class='font-sans text-sm ' on:click='this.showTooltip(scope.event, initiative)'>
							{{# if(this.breakOutTimings) }}
							<span class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.devStatus}}'>D</span><span
								class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.qaStatus}}'>Q</span><span
								class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.uatStatus}}'>U</span>
							{{/ if }}
							<span class="pointer {{# if(this.breakOutTimings) }} color-text-black{{else}} color-text-{{initiative.status}} {{/ }}">{{initiative.Summary}}</span>
						 </li>
						{{/ for}}
					</ul>
				</div>
			{{ else }}
			<div class='release_box'>
				<div class="release_box_header_bubble">
					Unable to find any initiatives with releases.
				</div>
			</div>
			{{/ for }}
			
		</div>
		{{/ if }}
		<div class='p-2'>
              <span class='color-text-and-bg-notstarted p-2 inline-block'>Not Started</span>
              <span class='color-text-and-bg-ontrack p-2 inline-block'>On Track</span>
              <span class='color-text-and-bg-blocked p-2 inline-block'>Blocked</span>
              <span class='color-text-and-bg-complete p-2 inline-block'>Complete</span>
              <span class='color-text-and-bg-behind p-2 inline-block'>Behind</span>
              <span class='color-text-and-bg-unknown p-2 inline-block'>Unknown</span>
            </div>
		<simple-tooltip id="simpleTooltip"></simple-tooltip>
	`
		get showGanttGrid(){
			return this.breakOutTimings || !this.showReleasesInTimeline;
		}
		get showGanttReleases(){
			return this.breakOutTimings && this.showReleasesInTimeline;
		}
		get gridRows() {
			return this.initiatives ? this.initiatives.length : this.releases.length;
		}
		get hasQAEpic(){
			if(this.initiatives) {
				return this.initiatives.some( (initiative)=> initiative.qa.issues.length )
			} else {
				return true;
			}
		}
		get hasUATEpic(){
			if(this.initiatives) {
				return this.initiatives.some( (initiative)=> initiative.uat.issues.length )
			} else {
				return true;
			}
		}

		get startAndEndDate(){
			const startDate = new Date(
					new Date().getFullYear(),
					Math.floor(new Date().getMonth() / 3) * 3
			);
			let hasDate;
			if(this.releases && this.releases.length) {
				hasDate = this.releases.filter(r => r.team.due);
			} else if(this.initiatives) {
				hasDate = this.initiatives.filter(r => r.team.due);
			} else {
				debugger;
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

			background.className = (index % 2 ? "color-bg-gray-20" : "")

			const root = document.createElement("div");
			const lastPeriodRoot = document.createElement("div");
			root.appendChild(lastPeriodRoot);

			Object.assign(root.style, {
				...base,
				position: "relative",
				zIndex: 20
			});
			root.className = "py-1";

			Object.assign(lastPeriodRoot.style, {
				position: "absolute",
				top: "0",
				left: "0",
				right: "0",
				bottom: "0",
				zIndex: "1" // this shouldn't be needed
			});
			lastPeriodRoot.className = "py-1 lastPeriod"


			const { firstDay, lastDay } = this.calendarData;
			const totalTime = (lastDay - firstDay);

			if (release.team.start && release.team.due) {

					function getPositions(work) {
						if(work.start == null && work.end == null) {
							return {
								start: 0, end: Infinity, startExtends: false, endExtends: false,
								style: {
									marginLeft: "1px",
									marginRight: "1px"
								}
							}
						}

						const start = Math.max(firstDay, work.start);
						const end = Math.min(lastDay, work.due);
						const startExtends = work.start < firstDay;
						const endExtends = work.due > lastDay;

						return {
							start, end, startExtends, endExtends,
							style: {
								width: Math.max( (((end - start) / totalTime) * 100), 0) + "%",
								marginLeft: "max("+(((start - firstDay) / totalTime) * 100) +"%, 1px)"
							}
						}
					}

					function makeLastPeriodElement(status, timing){
						
						const behindTime =  document.createElement("div");
						behindTime.style.backgroundClip = "content-box";
						behindTime.style.opacity = "0.9";
						behindTime.className = "border-y-solid-1px"

						if(timing && status === "behind") {
							Object.assign(behindTime.style, getPositions(timing || {}).style);
							behindTime.classList.add("color-text-and-bg-behind-last-period");
						}
						return behindTime;
					}

					if(this.breakOutTimings) {

						const lastDev = makeLastPeriodElement(release.devStatus, release.dev.lastPeriod);
						lastDev.classList.add("h-1","py-half");
						lastPeriodRoot.appendChild(lastDev);

						const dev = document.createElement("div");
						dev.className = "dev_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.devStatus;
						Object.assign(dev.style, getPositions(release.dev).style);
						root.appendChild(dev);

						
						if(this.hasQAEpic) {
							const lastQA = makeLastPeriodElement(release.qaStatus, release.qa.lastPeriod);
							lastQA.classList.add("h-1","py-half");
							lastPeriodRoot.appendChild(lastQA);


							const qa = document.createElement("div");
							qa.className = "qa_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.qaStatus;
							Object.assign(qa.style, getPositions(release.qa).style);
							root.appendChild(qa);

							
						}
						if(this.hasUATEpic) {
							const lastUAT = makeLastPeriodElement(release.uatStatus, release.uat.lastPeriod);
							lastUAT.classList.add("h-1","py-half");
							lastPeriodRoot.appendChild(lastUAT);


							const uat = document.createElement("div");
							uat.className = "uat_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.uatStatus;
							Object.assign(uat.style, getPositions(release.uat).style);
							root.appendChild(uat);

							
						}
					} else {

						const behindTime = makeLastPeriodElement(release.status, release.team.lastPeriod);
						behindTime.classList.add("h-4","py-1")
						lastPeriodRoot.appendChild(behindTime);

						const team = document.createElement("div");
						team.className = "h-6 border-y-solid-1px-white color-text-and-bg-"+release.status;
						Object.assign(team.style, getPositions(release.team).style);
						team.style.opacity = "0.9";
						
						root.appendChild(team);

						
						
					}



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
				if (this.breakOutTimings) {
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
				const was = release.lastPeriod && release.lastPeriod.due;
				
				if (was && current - DAY_IN_MS > was) {
						return " (" + this.prettyDate(was) + ")";
				} else {
						return ""
				}
		}
		wasStartDate(release) {

			const current = release.start;
			const was = release.lastPeriod && release.lastPeriod.start;
			
			if (was && (current - DAY_IN_MS > was)) {
					return " (" + this.prettyDate(was) + ")";
			} else {
					return ""
			}
		}
		plus(first, second) {
			return first + second;
		}
		lastRowBorder(index) {
			return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : ""
		}
		showTooltip(event, initiative) {
			console.log(initiative);

			const make = (initiative, workPart) =>{
				return `<div class="p-2">
					<div class="release_box_subtitle_wrapper">
							<span class="release_box_subtitle_key color-text-and-bg-${initiative[workPart+"Status"]}">${workPart.toUpperCase()}&nbsp;</span>
							${
								initiative[workPart+"Status"] !== "unknown" ?
								`<span class="release_box_subtitle_value">
									${this.prettyDate(initiative[workPart].start)}
									${this.wasStartDate(initiative[workPart])}
									</span><span>-</span>
									<span class="release_box_subtitle_value">
									${this.prettyDate(initiative[workPart].due)}
									${this.wasReleaseDate(initiative[workPart])}
								</span>` : ''
							}
							
					</div>
					${
						initiative[workPart+"Status"] !== "unknown" ?
						`<p>Start: <a href="${initiative[workPart]?.startFrom?.reference?.url}">
							${initiative[workPart]?.startFrom?.reference?.Summary}</a>'s 
							${initiative[workPart]?.startFrom?.message}
						</p>
						<p>End: <a href="${initiative[workPart]?.dueTo?.reference?.url}">
							${initiative[workPart]?.dueTo?.reference?.Summary}</a>'s
							${initiative[workPart]?.dueTo?.message}
						</p>` :
						''
					}
					
				</div>`;
			}


			window.simpleTooltip.enteredElement(event, `
			<div class='flex remove-button pointer' style="justify-content: space-between">
				<a href="${initiative.url}">${initiative.Summary}</a>
				<span>❌</span>
			</div>
			${make(initiative, "dev")}
			${make(initiative, "qa")}
			${make(initiative, "uat")}
			`);

			window.simpleTooltip.querySelector(".remove-button").onclick = ()=>{
				window.simpleTooltip.leftElement()
			}

		}
		hideTooltip(event) {
			//window.simpleTooltip.leftElement()
		}
}



customElements.define("steerco-timeline", SteercoTimeline);
