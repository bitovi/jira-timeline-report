
import SimpleTooltip from "../ui/simple-tooltip/simple-tooltip.js";
export const DAY_IN_MS = 1000 * 60 * 60 * 24;

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

let showingObject = null;

export const dateFormatter = new Intl.DateTimeFormat('en-US', { day: "numeric", month: "short" });

export function prettyDate(date) {
    return date ? dateFormatter.format(date) : "";
}

export function wasReleaseDate(release) {

    const current = release.due;
    const was = release.lastPeriod && release.lastPeriod.due;
    
    if (was && current - DAY_IN_MS > was) {
            return " (" + prettyDate(was) + ")";
    } else {
            return ""
    }
}

export function wasStartDate(release) {

    const current = release.start;
    const was = release.lastPeriod && release.lastPeriod.start;
    
    if (was && (current - DAY_IN_MS > was)) {
            return " (" + prettyDate(was) + ")";
    } else {
            return ""
    }
}


export function showTooltipContent(element, content) {

    TOOLTIP.belowElementInScrollingContainer(element, content);

    TOOLTIP.querySelector(".remove-button").onclick = ()=> {
        showingObject = null;
        TOOLTIP.leftElement()
    }
}

export function showTooltip(element, issue){
    console.log(issue);
    if(showingObject === issue) {
        showingObject = null;
        TOOLTIP.leftElement();
        return;
    }
    showingObject = issue;

    const makePartDetails = (dateData, partName) => {
        return `<details class="border border-slate-200">
            <summary>
                <span class="release_box_subtitle_key color-text-and-bg-${dateData.status}">
                &nbsp;${partName}
                </span>
                ${
                    dateData.status !== "unknown" ?
                    `&nbsp;<span class="release_box_subtitle_value">
                        ${prettyDate(dateData.start)}
                        ${wasStartDate(dateData)}
                        </span><span>-</span>
                        <span class="release_box_subtitle_value">
                        ${prettyDate(dateData.due)}
                        ${wasReleaseDate(dateData)}
                    </span>` : ''
                }
            </summary>
            <div class="flex gap-2 ">
                <div class="bg-neutral-20">
                    <div>${prettyDate(dateData.start)}</div>
                    <div>
                        <a href="${dateData?.startFrom?.reference?.url}" target="_blank" class="link">
                            ${dateData?.startFrom?.reference?.summary}</a> </div>
                    <div class="font-mono text-sm">${dateData?.startFrom?.message}</div>
                </div>
                <div class="bg-neutral-20">
                    <div>${prettyDate(dateData.due)}</div>
                    <a href="${dateData?.dueTo?.reference?.url}" target="_blank" class="link">
                        ${dateData?.dueTo?.reference?.summary}</a>
                    <div class="font-mono text-sm">${dateData?.dueTo?.message}</div>
                </div>
            </div>
        </details>`
    }

    const make = (issue, workPart) =>{
        const breakdownPart = issue.rollupStatuses[workPart];

        return `<div class="p-2">
            <div class="release_box_subtitle_wrapper">
                    <span class="release_box_subtitle_key color-text-and-bg-${breakdownPart.status}">
                        &nbsp;${workPart.toUpperCase()}&nbsp;
                    </span>
                    ${
                        issue[workPart+"Status"] !== "unknown" ?
                        `<span class="release_box_subtitle_value">
                            ${prettyDate(breakdownPart.start)}
                            ${wasStartDate(breakdownPart)}
                            </span><span>-</span>
                            <span class="release_box_subtitle_value">
                            ${prettyDate(breakdownPart.due)}
                            ${wasReleaseDate(breakdownPart)}
                        </span>` : ''
                    }
            </div>
            ${ 
                breakdownPart.statusData?.warning === true ?
                `<div class="color-bg-warning">${breakdownPart.statusData.message}</div>` : ""
            }
            ${
                breakdownPart.status !== "unknown" ?
                `<p>Start: <a href="${breakdownPart?.startFrom?.reference?.url}" target="_blank" class="link">
                    ${breakdownPart?.startFrom?.reference?.summary}</a>'s 
                    ${breakdownPart?.startFrom?.message}
                </p>
                <p>End: <a href="${breakdownPart?.dueTo?.reference?.url}" target="_blank" class="link">
                    ${breakdownPart?.dueTo?.reference?.summary}</a>'s
                    ${breakdownPart?.dueTo?.message}
                </p>` :
                ''
            }
            
        </div>`;
    }
    const DOM = document.createElement("div");
    if(issue.rollupStatuses) {
        const rollupData = issue.rollupStatuses.rollup;
        DOM.innerHTML = `
        <div class='flex remove-button pointer' style="justify-content: space-between">
            <a class="${issue.url ? "link" : ""} text-lg font-bold"
                href="${issue.url || '' }" target="_blank">${issue.summary}</a>
            <span>❌</span>
        </div>
        <a class="explore link">Show Children</a>
        ${/*issue.dateData.rollup*/ false ? makePartDetails(issue.dateData.rollup, "rollup") :""}
        ${ 
            rollupData?.statusData?.warning === true ?
            `<div class="color-bg-warning">${rollupData.statusData.message}</div>` : ""
        }
        ${ issue.rollupStatuses.rollup ? make(issue, "rollup") :""}
        ${ issue.rollupStatuses.dev ? make(issue, "dev") :""}
        ${issue.rollupStatuses.qa ? make(issue, "qa") : ""}
        ${issue.rollupStatuses.uat ?  make(issue, "uat") : ""}
        `;

        //this connects a lot to routing logic ...
        let exploreUrl = new URL(window.location.href);
        exploreUrl.searchParams.set('jql', 'issue = '+issue.key);
        exploreUrl.searchParams.set('loadChildren','true');
        exploreUrl.searchParams.set('childJQL','');
        exploreUrl.searchParams.delete('statusesToShow');
        exploreUrl.searchParams.delete('statusesToRemove');
        exploreUrl.searchParams.delete('releasesToShow');
        exploreUrl.searchParams.delete('groupBy');
        
        const explore = DOM.querySelector(".explore");

        explore.href = exploreUrl.href;
    } else {
        // "Planning" epics might not have this data
        DOM.innerHTML = `
        <div class='flex remove-button pointer gap-2' style="justify-content: space-between">
            <a class="${issue.url ? "link" : ""} text-lg font-bold"
                href="${issue.url || '' }" target="_blank">${issue.summary}</a>
            <span>❌</span>
        </div>`
    }
   
    showTooltipContent(element, DOM);

}



