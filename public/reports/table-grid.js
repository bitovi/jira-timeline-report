// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "../can.js";
import { makeGetChildrenFromReportingIssues } from "../jira/rollup/rollup.js";

/*
export const dateFormatter = new Intl.DateTimeFormat('en-US', { 
    month: 'short',  // Abbreviated month (e.g., "Oct")
    day: 'numeric',  // Numeric day (e.g., "20")
    year: 'numeric'  // Full year (e.g., "1982") 
});*/

export const dateFormatter = new Intl.DateTimeFormat('en-US', { 
    month: '2-digit',  // Abbreviated month (e.g., "Oct")
    day: '2-digit',  // Numeric day (e.g., "20")
    year: '2-digit'  // Full year (e.g., "1982") 
})

import SimpleTooltip from "../shared/simple-tooltip.js";

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);


export class EstimateBreakdown extends StacheElement {
    static view = `<button class="remove-button">X</button>
    <div class="p-4">
        {{# if( this.usedStoryPointsMedian(issue) ) }}
            <div class="flex gap-4 items-center my-2">
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">&nbsp;</div>
                    <div class="text-right">Current:</div>
                    <div class="text-right text-xs">Last:</div>
                </div>
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Median Estimate</div>
                    <div class="text-right">{{this.issue.storyPointsMedian}}</div>
                    <div class="text-right text-xs">{{this.issue.issueLastPeriod.storyPointsMedian}}</div>
                </div>
                <div>× LOGNORMINV(</div>
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Confidence</div>
                    <div class="text-right {{this.confidenceClass(issue)}}">
                        {{this.confidenceValue(this.issue)}}%
                    </div>
                    <div class="text-right text-xs {{this.confidenceClass(this.issue.issueLastPeriod)}}">
                        {{this.confidenceValue(this.issue.issueLastPeriod)}}%</div>
                </div>
                <div>)</div>
                <div>=</div>
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Adjusted Estimate</div>
                    <div class="text-right">{{this.round( this.issue.derivedTiming.deterministicTotalPoints) }}</div>
                    <div class="text-right text-xs">{{this.round( this.issue.issueLastPeriod.derivedTiming.deterministicTotalPoints) }}</div>
                </div>
            </div>
            <div class="flex gap-4 items-center my-2">
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Estimate Points Per Sprint</div>
                    <div class="text-right">{{this.issue.team.velocity}}</div>
                </div>
                <div>/</div>
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Parallel Work Tracks</div>
                    <div class="text-right">{{this.issue.team.parallelWorkLimit}}</div>
                </div>
                <div>/</div>
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Days Per Sprint</div>
                    <div class="text-right">{{this.issue.team.daysPerSprint}}</div>
                </div>
                <div class="text-center">=</div>
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Points per day per work track</div>
                    <div class="text-right">{{this.round( this.issue.team.pointsPerDayPerTrack, 2)}}</div>
                </div>
            </div>
            <div class="flex gap-4 items-center my-2">
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Adjusted Estimate</div>
                    <div class="text-right">{{this.round( this.issue.derivedTiming.deterministicTotalPoints ) }}</div>
                </div>
                <div class="align-middle"> / </div>
                <div class="flex-col">
                    <div class="text-xs text-neutral-801">Points per day per work track</div>
                    <div class="text-right">{{this.round( this.issue.team.pointsPerDayPerTrack, 2 ) }}</div>
                </div>
                <div class="text-center">=</div>
                <div>
                    <div class="text-xs text-neutral-801">Estimated Days</div>
                    <div class="text-right">{{this.round( this.issue.derivedTiming.deterministicTotalDaysOfWork ) }}</div>
                </div>
            </div>
            
        {{/ }}
    </div>
    `;
    usedStoryPointsMedian(issue){
        return issue.derivedTiming.isStoryPointsMedianValid
    }
    confidenceValue(issue){
        return issue?.derivedTiming?.usedConfidence;
    }
    confidenceClass(issue){
        return issue.derivedTiming.isConfidenceValid ? "" : "bg-neutral-100"
    }
    timingEquation(issue) {
        if(issue?.derivedTiming?.isStoryPointsMedianValid) {
            return Math.round( issue.derivedTiming.deterministicTotalPoints ) + 
                " / " +issue.team.velocity + " / "+issue.team.parallelWorkLimit  + " * " + issue.team.daysPerSprint + " = " +
                Math.round(issue.derivedTiming.deterministicTotalDaysOfWork)
        }
    }
    round(number, decimals = 0) {
        return parseFloat(number.toFixed(decimals))
    }
}
customElements.define("estimate-breakdown", EstimateBreakdown);

// <td>{{this.estimate(tableRow.issue)}}</td>
// <td>{{this.startDate( tableRow.issue ) }}</td>
// <td>{{this.endDate( tableRow.issue) }}</td>

// loops through and creates
export class TableGrid extends StacheElement {
  static view = `
        <table>
            <thead>
                <tr>
                    <th class="p-2">Summary</th>
                    <th class="p-2">Estimated Days</th>
                    <th class="p-2">Timed Days</th>
                    <th class="p-2">Rolled Up Days</th>
                </tr>
            </thead>
            {{# for(tableRow of this.tableRows) }}
                <tr on:click="console.log(tableRow.issue)">
                    <td style="{{this.padding(tableRow)}}" class="px-2 flex gap-2">
                        <img src:from="this.iconUrl(tableRow)" class="inline-block"/>
                        <a href="{{tableRow.issue.url}}" target="_blank"
                            class="link inline-block max-w-96">{{tableRow.issue.key}}</a>
                        <span class="text-ellipsis truncate inline-block">{{tableRow.issue.summary}}</span>
                    </td>
                    <td class="px-2 text-right" on:click="this.showEstimation(tableRow.issue, scope.event.target)">
                        {{this.estimatedDaysOfWork(tableRow.issue)}}
                    </td>
                    <td class="px-2 text-right">{{this.timedDays(tableRow.issue)}}</td>

                    <td class="px-2 text-right" on:click="">{{this.rolledUpDays(tableRow.issue)}}</td>
                </tr>
            {{/ for }}
        </table>
        
    `;
  static props = {
    columns: {
        get default(){
            return [{
                path: "summary",
                name: "Summary",
            },{
                path: "rollupDates.start",
                name: "Rollup Start"
            },
            {
                path: "rollupDates.start",
                name: "Rollup Due"
            }]
        }
    }
  };

  get tableRows(){


    const getChildren = makeGetChildrenFromReportingIssues(this.allIssuesOrReleases);
    
    function childrenRecursive(issue, depth = 0) {
        return [
            {depth: depth, issue},
            ...getChildren(issue).map( issue => childrenRecursive(issue, depth+1))
        ]
    }

    let allChildren = this.primaryIssuesOrReleases.map( i => childrenRecursive(i)).flat(Infinity)


    console.log( [...this.primaryIssuesOrReleases].sort((a,b)=> {
        return a.completionRollup.totalWorkingDays - b.completionRollup.totalWorkingDays
    }) )

    return allChildren;
  }
  padding(row){
    return "padding-left: "+(row.depth * 20)+"px"
  }
  iconUrl(row){
    return row.issue.issue.fields["Issue Type"].iconUrl
  }
  shortDate(date) {
    return date ? dateFormatter.format(date) : "";
  }
  startDate(issue) {
    return compareToLast(issue, issue => issue?.rollupDates?.start,  formatDate)
  }
  endDate(issue) {
    return compareToLast(issue, issue => issue?.rollupDates?.due,  formatDate)
  }
  estimate(issue) {
    return compareToLast(issue, getEstimate,  x => x)

  }
  estimatedDaysOfWork(issue){
    return compareToLast(issue, (issue) => {
        // if we have story points median, use that
        if(issue?.derivedTiming?.isStoryPointsMedianValid) {
            return issue.derivedTiming.deterministicTotalDaysOfWork
        } else if(issue?.derivedTiming?.isStoryPointsValid ) {
            return issue?.derivedTiming?.storyPointsDaysOfWork
        }
    }, value => {
        if(typeof value === "number") {
            return Math.round(value)
        } else {
            return value;
        }
    })
  }
  timedDays(issue){
    return compareToLast(issue, (issue) => {
        // if we have story points median, use that
        if(issue?.derivedTiming?.datesDaysOfWork) {
            return issue?.derivedTiming?.datesDaysOfWork
        } 
    }, value => {
        if(typeof value === "number") {
            return Math.round(value)
        } else {
            return value;
        }
    })
  }
  rolledUpDays(issue){
    return compareToLast(issue, (issue) => {
        // if we have story points median, use that
        if(issue?.completionRollup?.totalWorkingDays) {
            return issue?.completionRollup?.totalWorkingDays;
        } 
    }, value => {
        if(typeof value === "number") {
            return Math.round(value)
        } else {
            return value;
        }
    })
  }
  timingEquation(issue) {
    if(issue?.derivedTiming?.isStoryPointsMedianValid) {
        return Math.round( issue.derivedTiming.deterministicTotalPoints ) + 
            " / " +issue.team.velocity + " / "+issue.team.parallelWorkLimit  + " * " + issue.team.daysPerSprint + " = " +
            Math.round(issue.derivedTiming.deterministicTotalDaysOfWork)
    }
  }
  showEstimation(issue, element) {



    TOOLTIP.belowElementInScrollingContainer(element, new EstimateBreakdown().initialize({
        issue
    }));

    TOOLTIP.querySelector(".remove-button").onclick = ()=> {
        TOOLTIP.leftElement()
    }
  }
}

customElements.define("table-grid", TableGrid);

function getEstimate(issue){
    if(issue?.derivedTiming?.isStoryPointsMedianValid) {
        return issue.storyPointsMedian + " "+ issue.confidence+"%"
    } else if(issue?.storyPoints != null){
        return issue.storyPoints
    } else {
        return null;
    }
}

function anythingToString(value){
    return value == null ? "∅" : ""+value;
}

function compareToLast(issue, getValue, formatValue) {
 
    const currentValue = anythingToString( formatValue( getValue(issue) ) );

    if(!issue.issueLastPeriod) {
        return "🚫 ➡ "+currentValue
    }
    const lastValue = anythingToString( formatValue( getValue(issue.issueLastPeriod) ) );

    if(currentValue !== lastValue) {
        return lastValue + " ➡ " + currentValue;
    } else {
        return currentValue === "∅" ? "" : currentValue;
    }

}

function formatDate(date){
    return date ? dateFormatter.format(date) : date;
}

function getStartDate(issue){
    return formatDate(issue?.rollupDates?.start)
}


