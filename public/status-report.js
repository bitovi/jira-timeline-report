
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";

import { dateFormatter } from "./issue-tooltip.js";

import { DAY_IN_MS } from "./date-helpers.js";

import { showTooltip } from "./issue-tooltip.js";

export class StatusReport extends StacheElement {
    static view = `
    <div class='release_wrapper {{# if(this.breakdown) }}extra-timings{{else}}simple-timings{{/ if}} px-2'>
        {{# for(primaryIssue of this.primaryIssues) }}
            <div class='release_box'>
                <div 
                    on:click='this.showTooltip(scope.event, primaryIssue)'
                    class="pointer release_box_header_bubble color-text-and-bg-{{primaryIssue.dateData.rollup.status}}">{{primaryIssue.Summary}}</div>
                <div class="flex gap-4 p-1">
                    {{# if(this.breakdown) }}
                        <div class="release_box_subtitle_wrapper">
                                <span class="release_box_subtitle_key color-text-and-bg-{{primaryIssue.dateData.dev.status}}">Dev</span>
                                <span class="release_box_subtitle_value">
                                    {{ this.prettyDate(primaryIssue.dateData.dev.due) }}{{this.wasReleaseDate(primaryIssue.dateData.dev) }}
                                </span>
                        </div>
                        <div class="release_box_subtitle_wrapper">
                                <span class="release_box_subtitle_key color-text-and-bg-{{primaryIssue.dateData.qa.status}}">QA&nbsp;</span>
                                <span class="release_box_subtitle_value">
                                    {{ this.prettyDate(primaryIssue.dateData.qa.due) }}{{ this.wasReleaseDate(primaryIssue.dateData.qa) }}
                                </span>
                        </div>
                        <div class="release_box_subtitle_wrapper">
                                <span class="release_box_subtitle_key color-text-and-bg-{{primaryIssue.dateData.uat.status}}">UAT</span>
                                <span class="release_box_subtitle_value">
                                    {{ this.prettyDate(primaryIssue.dateData.uat.due) }}{{ this.wasReleaseDate(primaryIssue.dateData.uat) }}
                                </span>
                        </div>
                    {{ else }}
                        <div class="release_box_subtitle_wrapper">
                                <b>Target Delivery</b>
                                <span class="release_box_subtitle_value">
                                    <span class="nowrap">{{ this.prettyDate(primaryIssue.dateData.rollup.due) }}</span>
                                    <span class="nowrap">{{ this.wasReleaseDate(primaryIssue.dateData.rollup) }}</span>
                                </span>
                        </div>
                    {{/ if }}

                </div>
                <ul class="p-1 list-disc list-inside">
                    {{# for(secondaryIssue of primaryIssue.dateData.children.issues) }}
                    <li class='font-sans text-sm pointer' on:click='this.showTooltip(scope.event, secondaryIssue)'>
                        {{# if(this.breakdown) }}
                        <span class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.dateData.dev.status}}'>D</span><span
                            class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.dateData.qa.status}}'>Q</span><span
                            class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.dateData.uat.status}}'>U</span>
                        {{/ if }}
                        <span class="{{# if(this.breakdown) }} color-text-black{{else}} color-text-{{secondaryIssue.dateData.rollup.status}} {{/ }}">{{secondaryIssue.Summary}}</span>
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
        
    </div>
    `;

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
    showTooltip(event, isssue) {
        showTooltip(event.currentTarget, isssue);
    }
}


customElements.define("status-report",StatusReport);