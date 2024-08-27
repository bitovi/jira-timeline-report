
import { StacheElement, type, ObservableObject, stache } from "./can.js";

import { rollupDatesFromRollups } from "./prepare-issues/date-data.js";
import { getQuartersAndMonths } from "./quarter-timeline.js";
import { getCalendarHtml } from "./quarter-timeline.js";
const DAY = 1000*60*60*24;
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
                    class='border-b border-neutral-80 text-center'>{{month.name}}</div>
            {{/ for }}

            <!-- CURRENT TIME BOX -->
            <div style="grid-column: 1 / span {{this.quartersAndMonths.months.length}}; grid-row: 2 / span {{plus(this.rows.length, 1)}};">
                <div class='today' style="margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 0; position: relative; height: 100%;"></div>
            </div>

            <!-- VERTICAL COLUMNS -->
            {{# for(month of this.quartersAndMonths.months)}}
                <div style="grid-column: {{ plus(scope.index, 1) }} / span 1; grid-row: 3 / span {{this.rows.length}}; z-index: 10"
                    class='border-l border-b border-neutral-80 {{this.lastRowBorder(scope.index)}}'></div>
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
        
        // handle if there are no issues
        const endDates = this.issues.map((issue)=> {
            return {dateData: {rollup: {
                start: issue.dateData.rollup.due,
                startFrom: issue.dateData.rollup.dueTo,
                due: issue.dateData.rollup.due,
                dueTo: issue.dateData.rollup.dueTo
            }}}
        })
        const {start, due} = rollupDatesFromRollups(endDates);
        let firstEndDate = new Date( (start || new Date()).getTime() - DAY * 30 ) ;
        
        
        
        return getQuartersAndMonths(firstEndDate, due || new Date( new Date().getTime() + DAY*30));
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
        const issuesWithDates = this.issues.filter( issue => issue.dateData.rollup.due )
        const rows = calculate({
            issues: issuesWithDates,
            firstDay,
            totalTime,
            makeElementForIssue: function(release){
                const div = document.createElement("div");
                div.className = " release-timeline-item flex items-center gap-1";
                Object.assign(div.style, {
                    position: "absolute",
                    //transform: "translate(-100%, 0)",
                    padding: "2px 4px 2px 4px",
                    zIndex: "100",
                    top: "4px",
                    background: "rgba(255,255,255, 0.6)"
                })

                
                const text = document.createElement("div");
                text.className = "truncate";
                Object.assign( text.style, {
                    position: "relative",
                    zIndex: "10",
                    maxWidth: "300px"
                })
                text.appendChild(document.createTextNode(release.shortVersion || release.Summary))
                div.appendChild(text);

                const tick = document.createElement("div");
                tick.className = "color-text-and-bg-" + release.dateData.rollup.status
                Object.assign( tick.style, {
                    height: "10px",
                    width: "10px",
                    transform: "rotate(45deg)",
                })
                div.appendChild(tick);
                
                return div;
            }
        });

        for(let row of rows) {
            for(let item of row.items) {
                item.element.style.right = ( (totalTime - (item.issue.dateData.rollup.due - firstDay)) / totalTime * 100) + "%";
            }
        }
        
        return rows;
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
            width = getWidth(element),
            widthInPercent = width  * 100 / widthOfArea,
            rightPercentEnd = Math.ceil( (issue.dateData.rollup.due - firstDay) / totalTime * 100),
            leftPercentStart = rightPercentEnd - widthInPercent;

        element.setAttribute("measured-width", width);
        element.setAttribute("left-p", leftPercentStart);
        element.setAttribute("right-p", leftPercentStart);
        return {
            issue,
            element,
            widthInPercent,
            leftPercentStart,
            rightPercentEnd
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