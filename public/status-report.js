import { StacheElement, type, ObservableObject, stache } from "./can.js";

import { dateFormatter } from "./issue-tooltip.js";

import { DAY_IN_MS } from "./date-helpers.js";

import { showTooltip } from "./issue-tooltip.js";

const release_box_subtitle_wrapper = `flex gap-2 text-neutral-800 text-sm`

export class StatusReport extends StacheElement {
    static view = `
    <div class='release_wrapper {{# if(this.breakdown) }}extra-timings{{else}}simple-timings{{/ if}} px-2 flex gap-2'>
        {{# for(primaryIssue of this.primaryIssuesOrReleases) }}
            <div class='release_box grow'>
                <div 
                    on:click='this.showTooltip(scope.event, primaryIssue)'
                    class="pointer release_box_header_bubble color-text-and-bg-{{primaryIssue.rollupStatuses.rollup.status}} rounded-t {{this.fontSize(0)}}">
                        {{primaryIssue.summary}}
                    </div>
                
                    {{# if(this.breakdown) }}

                            <div class="${release_box_subtitle_wrapper} pt-1">
                                    <span class="release_box_subtitle_key color-text-and-bg-{{primaryIssue.rollupStatuses.dev.status}} font-mono px-px">Dev</span>
                                    <span class="release_box_subtitle_value">
                                        {{ this.prettyDate(primaryIssue.rollupStatuses.dev.due) }}{{this.wasReleaseDate(primaryIssue.rollupStatuses.dev) }}
                                    </span>
                            </div>
                            <div class="${release_box_subtitle_wrapper}">
                                    <span class="release_box_subtitle_key color-text-and-bg-{{primaryIssue.rollupStatuses.qa.status}} font-mono px-px">QA&nbsp;</span>
                                    <span class="release_box_subtitle_value">
                                        {{ this.prettyDate(primaryIssue.rollupStatuses.qa.due) }}{{ this.wasReleaseDate(primaryIssue.rollupStatuses.qa) }}
                                    </span>
                            </div>
                            <div class="${release_box_subtitle_wrapper}">
                                    <span class="release_box_subtitle_key color-text-and-bg-{{primaryIssue.rollupStatuses.uat.status}} font-mono px-px">UAT</span>
                                    <span class="release_box_subtitle_value">
                                        {{ this.prettyDate(primaryIssue.rollupStatuses.uat.due) }}{{ this.wasReleaseDate(primaryIssue.rollupStatuses.uat) }}
                                    </span>
                            </div>
                    {{ else }}
                        <div class="${release_box_subtitle_wrapper} p-1">
                                <b>Target Delivery</b>
                                <span class="release_box_subtitle_value">
                                    <span class="nowrap">{{ this.prettyDate(primaryIssue.rollupStatuses.rollup.due) }}</span>
                                    <span class="nowrap">{{ this.wasReleaseDate(primaryIssue.rollupStatuses.rollup) }}</span>
                                </span>
                        </div>
                    {{/ if }}

                <ul class=" {{# if(this.breakdown) }}list-none{{else}}list-disc list-inside p-1{{/if}}">
                    {{# for(secondaryIssue of this.getIssues(primaryIssue.rollupStatuses.children.issueKeys)) }}
                    <li class='font-sans {{this.fontSize(primaryIssue.rollupStatuses.children.issueKeys.length)}} pointer' on:click='this.showTooltip(scope.event, secondaryIssue)'>
                        {{# if(this.breakdown) }}
                        <span class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.rollupStatuses.dev.status}}'>D</span><span
                            class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.rollupStatuses.qa.status}}'>Q</span><span
                            class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.rollupStatuses.uat.status}}'>U</span>
                        {{/ if }}
                        <span class="{{# if(this.breakdown) }} color-text-black{{else}} color-text-{{secondaryIssue.rollupStatuses.rollup.status}} {{/ }}">{{secondaryIssue.summary}}</span>
                    </li>
                    {{/ for}}
                </ul>
            </div>
        {{ else }}
        <div class='release_box'>
            <div class="release_box_header_bubble">
                Unable to find any issues.
            </div>
        </div>
        {{/ for }}
        {{# if(this.planningIssues.length) }}
            <div class='release_box grow'>
                <div class="release_box_header_bubble color-text-and-bg-unknown rounded-t">Planning</div>
                <ul class="list-disc list-inside p-1">
                {{# for(planningIssue of this.planningIssues)}}
                    <li class='font-sans {{this.fontSize(this.planningIssues.length)}} color-text-unknown pointer'
                         on:click='this.showTooltip(scope.event, planningIssue)'>
                        {{planningIssue.Summary}}
                    </li>

                {{/}}
                </ul>
            </div>
        {{/ }}
        
    </div>
    `;
    get columnDensity(){
        if(this.primaryIssuesOrReleases.length > 20) {
            return "absurd"
        } else if(this.primaryIssuesOrReleases.length > 10) {
            return "high"
        } else if(this.primaryIssuesOrReleases.length > 4) {
            return "medium"
        } else {
            return "light"
        }
    }
    prettyDate(date) {
        return date ? dateFormatter.format(date) : "";
    }
    get getIssues() {
        const map = new Map();
        for(let issue of this.allIssuesOrReleases || []) {
            map.set(issue.key, issue);
        }
        const getIssue = map.get.bind(map);

        return function(issueKeys){
            return issueKeys.map(getIssue)
        }
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
    showTooltip(event, isssue) {
        showTooltip(event.currentTarget, isssue);
    }
    fontSize(count){
        if(["high","absurd"].includes(this.columnDensity)) {
            return "text-xs"
        }
        if(count >= 7 && this.columnDensity === "medium") {
            return "text-sm";
        } else if(count <= 4) {
            return "text-base";
        }
        
    }
}


customElements.define("status-report",StatusReport);