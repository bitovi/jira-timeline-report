import { StacheElement, type } from "../can.js";
import SimpleTooltip from "./simple-tooltip.js";

function makeConnectLink(originalLink) {
    const linkUrl = new URL(originalLink);
    const appParams = new URLSearchParams(location.search);
    const linkParams = linkUrl.searchParams;
    
    return `${appParams.get('xdm_e')}/plugins/servlet/ac/bitovi.timeline-report/deeplink?${
        Array.from(linkParams)
            .map(([name, value]) => `ac.${name}=${encodeURIComponent(value)}`)
            .join('&')
    }`;
}
function makeLocalLink(originalLink) {
    const linkUrl = new URL(originalLink);
    linkUrl.host = location.host;
    linkUrl.port = location.port;
    linkUrl.protocol = location.protocol;

    return linkUrl.toString();
}

// mr-8 bg-neutral-201 hover:bg-neutral-301 rounded text-center inline-flex items-center

export default class SavedUrls extends StacheElement {
    static view = `
        {{# if(this.canQuery) }}
            <button class="text-center inline-flex items-center mr-8 bg-neutral-201 hover:bg-neutral-301 rounded px-3 py-1 font-bitovipoppins"
                on:click="this.showSavedReports()">
                Saved Reports <svg class="w-2.5 h-2.5 ms-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4"/>
                </svg>
            </button>
        {{/ if}}

    `;
    static props = {
        jiraHelpers: type.Any,
        loginComponent: type.Any,
        get canQuery(){
            return this.jiraHelpers && this.loginComponent?.isLoggedIn;
        },
        get globalConfigurationsPromise() {
            if(this.canQuery) {
                return Promise.all([
                    this.jiraHelpers.getServerInfo(),
                    this.jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields({
                        jql: `summary ~ "Jira Timeline Report Configuration"`,
                        fields: ["summary","Description"]
                    })
                ])
                .then( ([serverInfo, issues])=> {
                    const first = issues.find( issue => issue.fields.Summary === "Jira Timeline Report Configuration");
    
                    if(first) {
                        const description = first.fields.Description.content;
                        return {issue: first, links: findLinks(description), serverInfo}
                    } else {
                        return {links: []};
                    }
    
                });
            } else {
                return Promise.resolve([])
            }
        }
    };
    showSavedReports(){
        const div = document.createElement("div");
        this.globalConfigurationsPromise.then(({links, issue,serverInfo}) => {
            // come back acround and fix this
            
            let html = ``
            if(!issue) {
                html += `<a href="https://github.com/bitovi/jira-timeline-report/blob/main/docs/saved-reports.md" class="link block p-2">Create Saved Reports</a>`
            } else {
                html += `
                <div class="divide-y divide-gray-100 p-2">
                    <div class="py-2">
                        ${
                            links.map(link => {
                                const isConnect = window.location.pathname.startsWith('/connect')
                                const localHref = isConnect
                                    ? makeConnectLink(link.href)
                                    : makeLocalLink(link.href);
                                return `
                                    <a href="${localHref}" class="${
                                        unescape(makeLocalLink(link.href)) === unescape(window.location) ? "" : "link"
                                    } block py-1" ${isConnect ? 'target="_top"' : ""}>${link.text}</a>
                                `
                            }).join("")
                        }
                    </div>
                    <div class="py-2">
                        <a href="${serverInfo.baseUrl}/browse/${issue.key}" class="link block">Update Saved Reports</a>
                    </div>
                </div>`;
            }
            
            
            this.simpleTooltip.belowElementInScrollingContainer(this, html );
            // wait for this click event to clear the event queue
            
            setTimeout(()=>{
                const handler = () => {
                    this.simpleTooltip.leftElement();
                    window.removeEventListener("click", handler);
                }
                window.addEventListener("click", handler);
            }, 13)
            
        })
        
        
        
    }
    connected(){
        
        const simpleTooltip = new SimpleTooltip();
        this.parentNode.append(simpleTooltip);
        this.simpleTooltip = simpleTooltip;

    }
}

/*
{
                                    "type": "text",
                                    "text": "Release End Dates and Initiative Status",
                                    "marks": [
                                        {
                                            "type": "link",
                                            "attrs": {
                                                "href": "http://localhost:3000/?primaryIssueType=Release&hideUnknownInitiatives=true&jql=issueType+in+(Initiative)+order+by+Rank&timingCalculations=Initiative%3AchildrenOnly%2CEpic%3AchildrenOnly%2CStory%3AwidestRange&loadChildren=true&primaryReportType=due&secondaryReportType=status"
                                            }
                                        },
                                        {
                                            "type": "strong"
                                        }
                                    ]
                                }
*/
function matchLink(fragment) {
    const isText = fragment.type === "text";
    if(!isText) {
        return false;
    }
    const marks = ( fragment?.marks || [] )
    const link = marks.find(mark => mark.type === "link")
    const strong = marks.find(mark => mark.type === "strong");
    if(link) {
        return {
            text: fragment.text,
            href: link.attrs.href,
            default: !!strong
        }
    }
}
function findLinks(document) {
    return searchDocument(document, matchLink)
}


function searchDocument(document, matcher) {
    let matches = [];

    // Helper function to recursively search for matches
    function recurse(doc) {
        if (Array.isArray(doc)) {
            for (const item of doc) {
                recurse(item);
            }
        } else if (typeof doc === 'object' && doc !== null) {
            const result = matcher(doc);
            if (result) {
                matches.push(result); // Collect matching substructure
            } else {
                for (const key of Object.keys(doc)) {
                    recurse(doc[key]);
                }
            }
            
        }
    }

    recurse(document); // Start the recursive search
    return matches; // Return all matching substructures
}

customElements.define("saved-urls", SavedUrls);


