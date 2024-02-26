
import { StacheElement, type, ObservableObject, stache } from "./can.js";

import { rollupDatesFromRollups } from "./prepare-issues/date-data.js";
import { getQuartersAndMonths } from "./quarter-timeline.js";
import { getCalendarHtml } from "./quarter-timeline.js";
export class GanttTimeline extends StacheElement {
    static view = `
        <div style="display: grid; grid-template-columns: repeat({{this.quartersAndMonths.months.length}}, auto); grid-template-rows: auto auto repeat({{this.rows.length}}, auto)"
        class='p-2 mb-10'>

            {{# for(quarter of this.quartersAndMonths.quarters) }}
                <div style="grid-column: span 3" class="text-center">{{quarter.name}}</div>
            {{ / for }}

            {{# for(month of this.quartersAndMonths.months)}}
                <div 
                    style="grid-column: {{ plus(scope.index, 1) }} / span 1; grid-row: 2 / span 1;"
                    class='border-b-solid-2px-slate-900 text-center'>{{month.name}}</div>
            {{/ for }}

            <!-- CURRENT TIME BOX -->
            <div style="grid-column: 1 / span {{this.quartersAndMonths.months.length}}; grid-row: 2 / span {{plus(this.rows.length, 1)}};">
                <div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 1000; position: relative; height: 100%;"></div>
            </div>

            <!-- VERTICAL COLUMNS -->
            {{# for(month of this.quartersAndMonths.months)}}
                <div style="grid-column: {{ plus(scope.index, 1) }} / span 1; grid-row: 3 / span {{this.rows.length}}; z-index: 10"
                    class='border-l-solid-1px-slate-900 border-b-solid-1px-slate-900 {{this.lastRowBorder(scope.index)}}'></div>
            {{/ for }}

            
            {{# for(row of this.rows) }}
            <div class="h-10 relative" style="grid-column: 1 / span {{this.quartersAndMonths.months.length}}; grid-row: {{plus(scope.index, 3)}} / span 1;">
                {{# for(item of row.items) }}
                    {{{item.element}}}
                {{/ for }}
            </div>
            {{/ for }}

            
        </div>
    `;

    get quartersAndMonths(){
        const {start, due} = rollupDatesFromRollups(this.issues);
        return getQuartersAndMonths(new Date(), due);
    }
    get todayMarginLeft() {
        const { firstDay, lastDay } = this.quartersAndMonths;
        const totalTime = (lastDay - firstDay);
        return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
    }
    get calendarData() {
        const {start, due} = rollupDatesFromRollups(this.issues);
        return getCalendarHtml(new Date(), due);
    }
    get calendarHTML() {
        return stache.safeString(this.calendarData.html);
    }
    get rows() {
        const { firstDay, lastDay } = this.quartersAndMonths;
        const totalTime = (lastDay - firstDay);
        const rows = calculate({
            issues: this.issues,
            firstDay,
            totalTime,
            makeElementForIssue: function(release){
                const div = document.createElement("div");
                div.className = "rounded-sm release-timeline-item color-text-and-bg-" + release.dateData.rollup.status;
                div.appendChild(document.createTextNode(release.shortVersion || release.Summary))
                return div;
            }
        });

        for(let row of rows) {
            for(let item of row.items) {
                item.element.style.left = ((item.issue.dateData.rollup.due - firstDay) / totalTime * 100) + "%";
            }
        }
        console.log(rows);
        return rows;
    }
    get releaseTimeline() {
        
        
        return this.issues.map((release, index) => {
            const div = document.createElement("div");
            if (release.dateData.rollup.due) {
                    div.className = "rounded-sm release-timeline-item color-text-and-bg-" + release.dateData.rollup.status;
                    div.style.left = ((release.dateData.rollup.due - firstDay) / totalTime * 100) + "%";
                    div.appendChild(document.createTextNode(release.shortVersion || release.Summary))
            }
            return div;
        });
    }

    plus(first, second) {
        return first + second;
    }
    lastRowBorder(index) {
        return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : ""
    }
}

function defaultGetWidth(element){
    const clone = element.cloneNode(true);
    const outer = document.createElement("div");
    outer.appendChild(clone);
    Object.assign(outer.style,{
        position: "absolute",
        top: "-1000px",
        left: "-1000px",
        width: "700px",
        visibility: 'hidden' 
    });
    document.body.appendChild(outer);
    const width = clone.getBoundingClientRect().width;
    document.body.removeChild(outer);
    return width;
}


function calculate({widthOfArea = 1230, issues, makeElementForIssue, firstDay, totalTime, getWidth = defaultGetWidth}){
    
    
    const rows = [];
    
    const issueUIData = issues.map( issue => {
        
        const element = makeElementForIssue(issue),
        widthInPercent =  getWidth(element) * 100 / widthOfArea,
        centerInPercent = ((issue.dateData.rollup.due - firstDay) / totalTime * 100);
        return {
            issue,
            element,
            widthInPercent,
            centerInPercent,
            leftPercentStart: Math.floor(centerInPercent - widthInPercent / 2),
            rightPercentEnd: Math.ceil(centerInPercent + widthInPercent / 2)
        }
    });

    // earliest first
    issueUIData.sort( (a, b)=> {
        return a.leftPercentStart - b.leftPercentStart;
    })

    function addToRow(issueUIDatum){

        for(let row of rows) {
            // if we have no intersections, we can insert
            const intersected = row.items.some((item)=>{
                return intersect(
                    {start: item.leftPercentStart, end: item.rightPercentEnd}, 
                    {start: issueUIDatum.leftPercentStart, end: issueUIDatum.rightPercentEnd})
            })
            if(!intersected) {
                row.items.push(issueUIDatum);
                return;
            }
        }
        // we didn't find space, add a raw
        rows.push({
            items: [issueUIDatum]
        });
    }

    issueUIData.forEach(addToRow);
    return rows;
}

function intersect(range1, range2) {
    return range1.start < range2.end && range2.start < range1.end;
}

customElements.define("gantt-timeline",GanttTimeline);