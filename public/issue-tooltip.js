
import SimpleTooltip from "./shared/simple-tooltip.js";
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

export function showTooltip(element, issue){
    console.log(issue);
    if(showingObject === issue) {
        showingObject = null;
        TOOLTIP.leftElement();
        return;
    }
    showingObject = issue;
    const make = (issue, workPart) =>{
        const breakdownPart = issue.dateData[workPart];

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
                    ${breakdownPart?.startFrom?.reference?.Summary}</a>'s 
                    ${breakdownPart?.startFrom?.message}
                </p>
                <p>End: <a href="${breakdownPart?.dueTo?.reference?.url}" target="_blank" class="link">
                    ${breakdownPart?.dueTo?.reference?.Summary}</a>'s
                    ${breakdownPart?.dueTo?.message}
                </p>` :
                ''
            }
            
        </div>`;
    }
    const rollupData = issue.dateData.rollup;

    const DOM = document.createElement("div");
    DOM.innerHTML = `
    <div class='flex remove-button pointer' style="justify-content: space-between">
        <a class="p-1 color-text-and-bg-${rollupData.status} rounded"
            href="${issue.url}" target="_blank">${issue.Summary || issue.release}</a>
        <span>❌</span>
    </div>
    ${ 
        rollupData?.statusData?.warning === true ?
        `<div class="color-bg-warning">${rollupData.statusData.message}</div>` : ""
    }
    ${ issue.dateData.rollup ? make(issue, "rollup") :""}
    ${ issue.dateData.dev ? make(issue, "dev") :""}
    ${issue.dateData.qa ? make(issue, "qa") : ""}
    ${issue.dateData.uat ?  make(issue, "uat") : ""}
    `

    TOOLTIP.belowElementInScrollingContainer(element, DOM);

    TOOLTIP.querySelector(".remove-button").onclick = ()=> {
        showingObject = null;
        TOOLTIP.leftElement()
    }

}


