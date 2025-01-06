
import { StacheElement, type, ObservableObject, stache } from "../../can.js";

import { getQuartersAndMonths } from "../../utils/date/quarters-and-months";
import { makeGetChildrenFromReportingIssues } from "../../jira/rollup/rollup.js";
import {mergeStartAndDueData} from "../../jira/rollup/dates/dates";

const DAY = 1000*60*60*24;
export class ScatterTimeline extends StacheElement {
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
    static props = {
        // how wide we can show the scatter changes with the window resize
        visibleWidth: {
            value({listenTo, resolve}) {
                listenTo(window,"resize", ()=> resolve(this.offsetWidth));
                listenTo(this, "isElementConnected", ()=> {
                    resolve(this.offsetWidth);
                });
                if(this.offsetWidth && this.offsetWidth > 0) {
                    resolve(this.offsetWidth);
                }
            }
        },
        isElementConnected: Boolean
    };
    connected() {
        this.isElementConnected = true;
    }
    get quartersAndMonths(){
        
        // handle if there are no issues
        const endDates = this.primaryIssuesOrReleases.map((issue)=> {
            return {
                start: issue.rollupDates.due,
                startFrom: issue.rollupDates.dueTo,
                due: issue.rollupDates.due,
                dueTo: issue.rollupDates.dueTo
            };
        })
        const {start, due} = mergeStartAndDueData(endDates);
        let firstEndDate = new Date( (start || new Date()).getTime() - DAY * 30 ) ;
        
        return getQuartersAndMonths(firstEndDate, due || new Date( new Date().getTime() + DAY*30));
    }
    get todayMarginLeft() {
        const { firstDay, lastDay } = this.quartersAndMonths;
        const totalTime = (lastDay - firstDay);
        return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
    }
    /*
    get calendarData() {
        const {start, due} = rollupDatesFromRollups(this.primaryIssuesOrReleases);
        return getCalendarHtml(new Date(), due);
    }
    get calendarHTML() {
        return stache.safeString(this.calendarData.html);
    }
    */
    
    get rows() {
        // if we don't know our space, wait until we know it
        if(!this.visibleWidth) {
            return [];
        }
        const { firstDay, lastDay } = this.quartersAndMonths;
        const totalTime = (lastDay - firstDay);
        const issuesWithDates = this.primaryIssuesOrReleases.filter( issue => issue.rollupDates.due );

        const rows = calculate({
            widthOfArea: this.visibleWidth,
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
                text.appendChild(document.createTextNode(release?.names?.shortVersion || release.summary))
                div.appendChild(text);

                const tick = document.createElement("div");
                tick.className = "color-text-and-bg-" + release.rollupStatuses.rollup.status
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
                item.element.style.right = ( (totalTime - (item.issue.rollupStatuses.rollup.due - firstDay)) / totalTime * 100) + "%";
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
    miroData(){
        miroData(this.primaryIssuesOrReleases, this.allIssuesOrReleases);
    }
}

function toMiroData({summary, rollupDates, status, team, url, type, key, parent, issue, releases}){
    return {
        summary,
        due: rollupDates.due,
        status,
        team: team.name,
        url,
        type,
        key,
        releases: releases.map( r => r.name)
    }
}

function miroData(primaryIssuesOrReleases, allIssuesOrReleases){
    const getChildren = makeGetChildrenFromReportingIssues(allIssuesOrReleases);



    const data = primaryIssuesOrReleases.map( (issue)=> {
        const children = getChildren(issue);
        return {
            ...toMiroData(issue),
            parent: {key: issue.parentKey, summary: issue.issue.fields.Parent.fields.summary},
            children: children.map(toMiroData)
        }
    });
    console.log(data)
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
            rightPercentEnd = Math.ceil( (issue.rollupStatuses.rollup.due - firstDay) / totalTime * 100),
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

customElements.define("scatter-timeline",ScatterTimeline);