
import { StacheElement, type, ObservableObject, stache } from "//unpkg.com/can@6/core.mjs";

import { rollupDatesFromRollups } from "./prepare-issues/date-data.js";
import { getQuartersAndMonths } from "./quarter-timeline.js";
import { getCalendarHtml } from "./quarter-timeline.js";
export class GanttTimeline extends StacheElement {
    static view = `
        <div class='calendar_wrapper'>{{this.calendarHTML}}</div>

        <div class='gantt simple-timings'>{{# for(chart of this.releaseTimeline) }}
                {{chart}}
            {{/}}
            <div class='today' style="margin-left: {{this.todayMarginLeft}}%"></div>
        </div>
    `;

    get quartersAndMonths(){
        const {start, due} = rollupDatesFromRollups(this.issues);
        return getQuartersAndMonths(start, due);
    }
    get todayMarginLeft() {
        const { firstDay, lastDay } = this.quartersAndMonths;
        const totalTime = (lastDay - firstDay);
        return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
    }
    get calendarData() {
        const {start, due} = rollupDatesFromRollups(this.issues);
        return getCalendarHtml(start, due);
    }
    get calendarHTML() {
        return stache.safeString(this.calendarData.html);
    }
    get releaseTimeline() {
        const { firstDay, lastDay } = this.calendarData;
        const totalTime = (lastDay - firstDay);

        return this.issues.map((release, index) => {
            const div = document.createElement("div");
            if (release.dateData.rollup.due) {
                    div.className = "release-timeline-item color-text-and-bg-" + release.dateData.rollup.status;
                    div.style.left = ((release.dateData.rollup.due - firstDay) / totalTime * 100) + "%";
                    div.appendChild(document.createTextNode(release.Summary))
            }
            return div;
        });
    }
    
}


customElements.define("gantt-timeline",GanttTimeline);