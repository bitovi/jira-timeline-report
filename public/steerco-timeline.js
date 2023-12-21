// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";

import { getCalendarHtml, getQuarter, getQuartersAndMonths } from "./quarter-timeline.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS } from "./date-helpers.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { day: "numeric", month: "short" })

const inQAStatus = { "QA": true, "In QA": true };
const inDevStatus = { "In Development": true, "Development": true };
const inPartnerReviewStatus = { "Partner Review": true };
const inDoneStatus = { "Done": true };

import SimpleTooltip from "./shared/simple-tooltip.js";

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

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
						<div on:click='this.showTooltip(scope.event, initiative)' 
							class='pointer p-2 color-text-and-bg-{{initiative.dateData.rollup.status}} border-y-solid-1px-white'>
							{{initiative.Summary}}
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
					<div 
						on:click='this.showTooltip(scope.event, release)'
						class="pointer release_box_header_bubble color-text-and-bg-{{release.dateData.rollup.status}}">{{release.shortName}}</div>
					<div class="release_box_subtitle">
						{{# if(not(eq(release.release, "Next")))}}
							{{# if(this.breakOutTimings) }}
							<div class="release_box_subtitle_wrapper">
									<span class="release_box_subtitle_key color-text-and-bg-{{release.dateData.dev.status}}">Dev</span>
									<span class="release_box_subtitle_value">
										{{ this.prettyDate(release.dateData.dev.due) }}{{this.wasReleaseDate(release.dateData.dev) }}
									</span>
							</div>
							<div class="release_box_subtitle_wrapper">
									<span class="release_box_subtitle_key color-text-and-bg-{{release.dateData.qa.status}}">QA&nbsp;</span>
									<span class="release_box_subtitle_value">
										{{ this.prettyDate(release.dateData.qa.due) }}{{ this.wasReleaseDate(release.dateData.qa) }}
									</span>
							</div>
							<div class="release_box_subtitle_wrapper">
									<span class="release_box_subtitle_key color-text-and-bg-{{release.dateData.uat.status}}">UAT</span>
									<span class="release_box_subtitle_value">
										{{ this.prettyDate(release.dateData.uat.due) }}{{ this.wasReleaseDate(release.dateData.uat) }}
									</span>
							</div>
							{{ else }}
							<div class="release_box_subtitle_wrapper">
									<b>Target Delivery</b>
									<span class="release_box_subtitle_value">
										<span class="nowrap">{{ this.prettyDate(release.dateData.rollup.due) }}</span>
										<span class="nowrap">{{this.wasReleaseDate(release.dateData.rollup)}}</span>
									</span>
							</div>
							{{/ if }}

						{{/ if }}
					</div>
					<ul class="release_box_body list-disc">
						{{# for(initiative of release.dateData.children.issues) }}
						 <li class='font-sans text-sm pointer' on:click='this.showTooltip(scope.event, initiative)'>
							{{# if(this.breakOutTimings) }}
							<span class='text-xs font-mono px-px py-0 color-text-and-bg-{{initiative.dateData.dev.status}}'>D</span><span
								class='text-xs font-mono px-px py-0 color-text-and-bg-{{initiative.dateData.qa.status}}'>Q</span><span
								class='text-xs font-mono px-px py-0 color-text-and-bg-{{initiative.dateData.uat.status}}'>U</span>
							{{/ if }}
							<span class="{{# if(this.breakOutTimings) }} color-text-black{{else}} color-text-{{initiative.dateData.rollup.status}} {{/ }}">{{initiative.Summary}}</span>
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
				return this.initiatives.some( (initiative)=> initiative.dateData.qa.issues.length )
			} else {
				return true;
			}
		}
		get hasUATEpic(){
			if(this.initiatives) {
				return this.initiatives.some( (initiative)=> initiative.dateData.uat.issues.length )
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
				hasDate = this.releases.filter(r => r.dateData.rollup.due);
			} else if(this.initiatives) {
				hasDate = this.initiatives.filter(r => r.dateData.rollup.due);
			} else {
				debugger;
			}

			return {endDate: new Date( Math.max(...hasDate.map(r => r.dateData.rollup.due)) ), startDate};
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

			if (release.dateData.rollup.start && release.dateData.rollup.due) {

					function getPositions(work) {
						if(work.start == null && work.due == null) {
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

						const lastDev = makeLastPeriodElement(release.dateData.dev.status, release.dateData.dev.lastPeriod);
						lastDev.classList.add("h-1","py-0.5");
						lastPeriodRoot.appendChild(lastDev);

						const dev = document.createElement("div");
						dev.className = "dev_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.dateData.dev.status;
						Object.assign(dev.style, getPositions(release.dateData.dev).style);
						root.appendChild(dev);

						
						if(this.hasQAEpic) {
							const lastQA = makeLastPeriodElement(release.dateData.qa.status, release.dateData.qa.lastPeriod);
							lastQA.classList.add("h-1","py-0.5");
							lastPeriodRoot.appendChild(lastQA);


							const qa = document.createElement("div");
							qa.className = "qa_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.dateData.qa.status;
							Object.assign(qa.style, getPositions(release.dateData.qa).style);
							root.appendChild(qa);

							
						}
						if(this.hasUATEpic) {
							const lastUAT = makeLastPeriodElement(release.dateData.uat.status, release.dateData.uat.lastPeriod);
							lastUAT.classList.add("h-1","py-0.5");
							lastPeriodRoot.appendChild(lastUAT);


							const uat = document.createElement("div");
							uat.className = "uat_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.dateData.uat.status;
							Object.assign(uat.style, getPositions(release.dateData.uat).style);
							root.appendChild(uat);

							
						}
					} else {

						const behindTime = makeLastPeriodElement(release.dateData.rollup.status, release.dateData.rollup.lastPeriod);
						behindTime.classList.add("h-4","py-1")
						lastPeriodRoot.appendChild(behindTime);

						const team = document.createElement("div");
						team.className = "h-6 border-y-solid-1px-white color-text-and-bg-"+release.dateData.rollup.status;
						Object.assign(team.style, getPositions(release.dateData.rollup).style);
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
						if (release.dateData.rollup.due) {
								div.className = "release-timeline-item color-text-and-bg-" + release.dateData.rollup.status;
								div.style.left = ((release.dateData.rollup.due - firstDay) / totalTime * 100) + "%";
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

						if (release.dateData.rollup.start && release.dateData.rollup.due) {
								const width = ((release.dateData.rollup.due - release.dateData.rollup.start) / totalTime);

								//div.style.top = (index * 20)+"px";
								div.style.width = (width * 100) + "%";
								div.style.marginLeft = ((release.dateData.rollup.start - firstDay) / totalTime * 100) + "%";

								div.className = "release_time " //+this.releaseQaStatus(release);


								const dev = document.createElement("div");
								dev.className = "dev_time " //+this.releaseDevStatus(release);

								const devWidth = ((release.dateData.dev.due - release.dateData.dev.start) / totalTime);
								dev.style.width = (devWidth / width * 100) + "%";
								div.appendChild(dev);

								const qa = document.createElement("div");
								qa.className = "qa_time " //+this.releaseDevStatus(release);

								const qaWidth = ((release.dateData.qa.due - release.dateData.qa.start) / totalTime);
								qa.style.width = (qaWidth / width * 100) + "%";
								div.appendChild(qa);


								const uat = document.createElement("div");
								uat.className = "uat_time "; //+this.releaseUatStatus(release);
								const uatWidth = ((release.dateData.uat.due - release.dateData.uat.start) / totalTime);

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
		showTooltip(event, initiativeOrRelease) {
			// Better would be to do the rest with state .... but I'm being lazy
			console.log(initiativeOrRelease);
			if(this.showTooltipObject === initiativeOrRelease) {
				this.showTooltipObject = null;
				TOOLTIP.leftElement();
				return;
			}
			this.showTooltipObject = initiativeOrRelease;
			const make = (initiativeOrRelease, workPart) =>{
				const breakdownPart = initiativeOrRelease.dateData[workPart];

				return `<div class="p-2">
					<div class="release_box_subtitle_wrapper">
							<span class="release_box_subtitle_key color-text-and-bg-${breakdownPart.status}">
								&nbsp;${workPart.toUpperCase()}&nbsp;
							</span>
							${
								initiativeOrRelease[workPart+"Status"] !== "unknown" ?
								`<span class="release_box_subtitle_value">
									${this.prettyDate(breakdownPart.start)}
									${this.wasStartDate(breakdownPart)}
									</span><span>-</span>
									<span class="release_box_subtitle_value">
									${this.prettyDate(breakdownPart.due)}
									${this.wasReleaseDate(breakdownPart)}
								</span>` : ''
							}
					</div>
					${ 
						breakdownPart.statusData?.warning === true ?
						`<div class="color-bg-warning">${breakdownPart.statusData.message}</div>` : ""
					}
					${
						breakdownPart.status !== "unknown" ?
						`<p>Start: <a href="${breakdownPart?.startFrom?.reference?.url}">
							${breakdownPart?.startFrom?.reference?.Summary}</a>'s 
							${breakdownPart?.startFrom?.message}
						</p>
						<p>End: <a href="${breakdownPart?.dueTo?.reference?.url}">
							${breakdownPart?.dueTo?.reference?.Summary}</a>'s
							${breakdownPart?.dueTo?.message}
						</p>` :
						''
					}
					
				</div>`;
			}
			const rollupData = initiativeOrRelease.dateData.rollup;

			TOOLTIP.enteredElement(event, `
			<div class='flex remove-button pointer' style="justify-content: space-between">
				<a class="p-1 color-text-and-bg-${rollupData.status}"
					href="${initiativeOrRelease.url}">${initiativeOrRelease.Summary || initiativeOrRelease.release}</a>
				<span>❌</span>
			</div>
			${ 
				rollupData?.statusData?.warning === true ?
				`<div class="color-bg-warning">${rollupData.statusData.message}</div>` : ""
			}
			${make(initiativeOrRelease, "dev")}
			${make(initiativeOrRelease, "qa")}
			${make(initiativeOrRelease, "uat")}
			`);

			TOOLTIP.querySelector(".remove-button").onclick = ()=> {
				this.showTooltipObject = null;
				TOOLTIP.leftElement()
			}

		}
}



customElements.define("steerco-timeline", SteercoTimeline);
