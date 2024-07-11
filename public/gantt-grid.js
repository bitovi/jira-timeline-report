// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "./can.js";
import { showTooltip, showTooltipContent } from "./issue-tooltip.js";
import { percentComplete } from "./percent-complete/percent-complete.js";
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
        
            <div class="truncate max-w-96">{{this.issue.Summary}}</div>
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
`)

import { rollupDatesFromRollups } from "./prepare-issues/date-data.js";
import { getQuartersAndMonths } from "./quarter-timeline.js";
// loops through and creates 
export class GanttGrid extends StacheElement {
    static view = `
        <div style="display: grid; grid-template-columns: auto auto repeat({{this.quartersAndMonths.months.length}}, [col] 1fr); grid-template-rows: repeat({{this.issues.length}}, auto)"
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
            <div style="grid-column: 3 / span {{this.quartersAndMonths.months.length}}; grid-row: 3 / span {{this.issues.length}};">
                <div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 1000; position: relative; height: 100%;"></div>
            </div>


            <!-- VERTICAL COLUMNS -->
            {{# for(month of this.quartersAndMonths.months)}}
                <div style="grid-column: {{ plus(scope.index, 3) }}; grid-row: 3 / span {{this.issues.length}}; z-index: 10"
                    class='border-l border-b border-neutral-80 {{this.lastRowBorder(scope.index)}}'></div>
            {{/ for }}

            <!-- Each of the issues -->
            {{# for(issue of this.issuesWithPercentComplete) }}
                <div on:click='this.showTooltip(scope.event, issue)' 
                    class='pointer border-y-solid-1px-white text-right {{this.classForSpecialStatus(issue.dateData.rollup.status)}} truncate max-w-96 {{this.textSize}}'>
                    {{issue.Summary}}
                </div>
                <div style="grid-column: 2" class="{{this.textSize}} text-right pointer"
                    on:click="this.showPercentCompleteTooltip(scope.event, issue)">{{this.getPercentComplete(issue)}}
                </div>
                {{ this.getReleaseTimeline(issue, scope.index) }}
            {{/ for }}
        </div>
    `;
    static props = {
        breakdown: Boolean,
        showPercentComplete: {
            get default(){
                return !!localStorage.getItem("showPercentComplete")
            }
        }
    };
    get percentComplete(){
        if(this.derivedIssues) {
            return percentComplete(this.derivedIssues);
        }
    }
    get issuesWithPercentComplete(){
        if(this.showPercentComplete && this.percentComplete) {
            const percentComplete = this.percentComplete;
            const idToIssue = {};
            for(const issue of percentComplete.issues) {
                issue.completionRollup.totalWorkingDays
                idToIssue[issue.key] = issue;
            }
            return this.issues.map( issue => {
                return {
                    ...issue,
                    completionRollup: idToIssue[issue["Issue key"]].completionRollup
                }
            })
        } else {
            return this.issues;
        }
    }
    get lotsOfIssues(){
        return this.issues.length > 20 && ! this.breakdown;
    }
    get textSize(){
        return this.lotsOfIssues ? "text-xs pt-1 pb-0.5 px-1" : "p-1"
    }
    get bigBarSize(){
        return this.lotsOfIssues ? "h-4" : "h-6"
    }
    getPercentComplete(issue) {
        if(this.showPercentComplete && this.percentComplete) {
            return Math.round( issue.completionRollup.completedWorkingDays * 100 / issue.completionRollup.totalWorkingDays )+"%"
        } else {
            return "";
        }
    }
    showTooltip(event, issue) {
        showTooltip(event.currentTarget, issue);
    }
    showPercentCompleteTooltip(event, issue) {
        // we should get all the children ...
        const keyToChildren = Object.groupBy(this.percentComplete.issues, i => i.parentKey) 
        const children = keyToChildren[issue["Issue key"]];

        showTooltipContent(event.currentTarget, percentCompleteTooltip(
            {   issue, 
                children,
                getPercentComplete: this.getPercentComplete.bind(this),
                round: Math.round
            }));
    }
    classForSpecialStatus(status){
        if( status === "complete") {
            return "color-text-"+status;
        } else if(status === "blocked" ) {
            return "color-text-"+status;
        } else {
            return "";
        }
    }
    plus(first, second) {
        return first + second;
    }
    lastRowBorder(index) {
        return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : ""
    }
    get quartersAndMonths(){
        let {start, due} = rollupDatesFromRollups(this.issues);
        // nothing has timing
        if(!start) {
            start = new Date();
        }
        if(!due) {
            due = new Date( start.getTime() + 1000 * 60 * 60 * 24 * 90 );
        }
        return getQuartersAndMonths(new Date(), due);
    }
    get todayMarginLeft() {
        const { firstDay, lastDay } = this.quartersAndMonths;
        const totalTime = (lastDay - firstDay);
        return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
    }
    getReleaseTimeline(release, index){
        const base = {
            gridColumn: '3 / span '+this.quartersAndMonths.months.length,
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
                    behindTime.style.position = "relative";
                    behindTime.className = "border-y-solid-1px"

                    if(timing && status === "behind") {
                        Object.assign(behindTime.style, getPositions(timing || {}).style);
                        behindTime.style.zIndex = 1;
                        behindTime.classList.add("color-text-and-bg-behind-last-period");
                    }
                    if(timing && status === "ahead") {
                        Object.assign(behindTime.style, getPositions(timing || {}).style);
                        behindTime.classList.add("color-text-and-bg-ahead-last-period");
                        behindTime.style.zIndex = -1;
                    }
                    return behindTime;
                }
    
                if(this.breakdown) {

                    const lastDev = makeLastPeriodElement(release.dateData.dev.status, release.dateData.dev.lastPeriod);
                    lastDev.classList.add("h-2","py-[2px]");
                    lastPeriodRoot.appendChild(lastDev);

                    const dev = document.createElement("div");
                    dev.className = "dev_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.dateData.dev.status;
                    Object.assign(dev.style, getPositions(release.dateData.dev).style);
                    root.appendChild(dev);

                    
                    if(this.hasQAEpic) {
                        const lastQA = makeLastPeriodElement(release.dateData.qa.status, release.dateData.qa.lastPeriod);
                        lastQA.classList.add("h-2","py-[2px]");
                        lastPeriodRoot.appendChild(lastQA);


                        const qa = document.createElement("div");
                        qa.className = "qa_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.dateData.qa.status;
                        Object.assign(qa.style, getPositions(release.dateData.qa).style);
                        root.appendChild(qa);

                        
                    }
                    if(this.hasUATEpic) {
                        const lastUAT = makeLastPeriodElement(release.dateData.uat.status, release.dateData.uat.lastPeriod);
                        lastUAT.classList.add("h-2","py-[2px]");
                        lastPeriodRoot.appendChild(lastUAT);


                        const uat = document.createElement("div");
                        uat.className = "uat_time h-2 border-y-solid-1px-white color-text-and-bg-"+release.dateData.uat.status;
                        Object.assign(uat.style, getPositions(release.dateData.uat).style);
                        root.appendChild(uat);

                        
                    }
                } else {

                    const behindTime = makeLastPeriodElement(release.dateData.rollup.status, release.dateData.rollup.lastPeriod);
                    behindTime.classList.add(this.bigBarSize,"py-1")
                    lastPeriodRoot.appendChild(behindTime);

                    const team = document.createElement("div");
                    team.className = this.bigBarSize+" border-y-solid-1px-white color-text-and-bg-"+release.dateData.rollup.status;
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