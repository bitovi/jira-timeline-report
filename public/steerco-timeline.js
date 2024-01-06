// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";

import { getCalendarHtml, getQuarter, getQuartersAndMonths } from "./quarter-timeline.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS } from "./date-helpers.js";



const inQAStatus = { "QA": true, "In QA": true };
const inDevStatus = { "In Development": true, "Development": true };
const inPartnerReviewStatus = { "Partner Review": true };
const inDoneStatus = { "Done": true };

import SimpleTooltip from "./shared/simple-tooltip.js";

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

class SteercoTimeline extends StacheElement {
		static view = `

		{{# if(showReleasesInTimeline) }}
		
		{{/ if }}
		
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
		
		get quartersAndMonths(){
			const {startDate, endDate} = this.startAndEndDate;
			return getQuartersAndMonths(startDate, endDate);
		}
		//const {html, firstDay, lastDay}
		get calendarHTML() {
				return stache.safeString(this.calendarData.html);
		}
		get todayMarginLeft() {
				const { firstDay, lastDay } = this.calendarData;
				const totalTime = (lastDay - firstDay);
				return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
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
