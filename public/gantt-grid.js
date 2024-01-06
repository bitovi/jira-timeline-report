// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";

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

import { rollupDatesFromRollups } from "./prepare-issues/date-data.js";
import { getQuartersAndMonths } from "./quarter-timeline.js";
// loops through and creates 
export class GanttGrid extends StacheElement {
    static view = `
        <div style="display: grid; grid-template-columns: auto repeat({{this.quartersAndMonths.months.length}}, [col] 1fr); grid-template-rows: repeat({{this.issues.length}}, auto)"
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
            <div style="grid-column: 2 / span {{this.quartersAndMonths.months.length}}; grid-row: 3 / span {{this.issues.length}};">
                <div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 1000; position: relative; height: 100%;"></div>
            </div>


            <!-- VERTICAL COLUMNS -->
            {{# for(month of this.quartersAndMonths.months)}}
                <div style="grid-column: {{ plus(scope.index, 2) }}; grid-row: 3 / span {{this.issues.length}}; z-index: 10"
                    class='border-l-solid-1px-slate-900 border-b-solid-1px-slate-900 {{this.lastRowBorder(scope.index)}}'></div>
            {{/ for }}

            <!-- Each of the issues -->
            {{# for(issue of this.issues) }}
                <div on:click='this.showTooltip(scope.event, issue)' 
                    class='pointer p-2 color-text-and-bg-{{issue.dateData.rollup.status}} border-y-solid-1px-white'>
                    {{issue.Summary}}
                </div>
                {{ this.getReleaseTimeline(issue, scope.index) }}
            {{/ for }}
        </div>
    `;
    static props = {
        breakdown: Boolean
    };
    
    plus(first, second) {
        return first + second;
    }
    lastRowBorder(index) {
        return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : ""
    }
    get quartersAndMonths(){
        const {start, due} = rollupDatesFromRollups(this.issues);
        return getQuartersAndMonths(start, due);
    }
    get todayMarginLeft() {
        const { firstDay, lastDay } = this.quartersAndMonths;
        const totalTime = (lastDay - firstDay);
        return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
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


        const { firstDay, lastDay } = this.quartersAndMonths;
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
    
                if(this.breakdown) {

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
    get hasQAEpic(){
        if(this.issues) {
            return this.issues.some( (initiative)=> initiative.dateData.qa.issues.length )
        } else {
            return true;
        }
    }
    get hasUATEpic(){
        if(this.issues) {
            return this.issues.some( (initiative)=> initiative.dateData.uat.issues.length )
        } else {
            return true;
        }
    }
}

customElements.define("gantt-grid", GanttGrid)