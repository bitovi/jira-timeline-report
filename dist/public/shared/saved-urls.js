var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { StacheElement, type } from "../can.js";
import SimpleTooltip from "./simple-tooltip.js";
function makeConnectLink(originalLink) {
    var linkUrl = new URL(originalLink);
    var appParams = new URLSearchParams(location.search);
    var linkParams = linkUrl.searchParams;
    return "".concat(appParams.get('xdm_e'), "/plugins/servlet/ac/bitovi.timeline-report/deeplink?").concat(Array.from(linkParams)
        .map(function (_a) {
        var name = _a[0], value = _a[1];
        return "ac.".concat(name, "=").concat(encodeURIComponent(value));
    })
        .join('&'));
}
function makeLocalLink(originalLink) {
    var linkUrl = new URL(originalLink);
    linkUrl.host = location.host;
    linkUrl.port = location.port;
    linkUrl.protocol = location.protocol;
    return linkUrl.toString();
}
var SavedUrls = /** @class */ (function (_super) {
    __extends(SavedUrls, _super);
    function SavedUrls() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SavedUrls.prototype.showSavedReports = function () {
        var _this = this;
        var div = document.createElement("div");
        this.globalConfigurationsPromise.then(function (_a) {
            // come back acround and fix this
            var links = _a.links, issue = _a.issue, serverInfo = _a.serverInfo;
            var html = "";
            if (!issue) {
                html += "<a href=\"https://github.com/bitovi/jira-timeline-report/blob/main/docs/saved-reports.md\" class=\"link block\">Create Saved Reports</a>";
            }
            else {
                html += "\n                <div class=\"divide-y divide-gray-100\">\n                    <div class=\"py-2\">\n                        ".concat(links.map(function (link) {
                    var isConnect = window.location.pathname.startsWith('/connect');
                    var localHref = isConnect
                        ? makeConnectLink(link.href)
                        : makeLocalLink(link.href);
                    return "\n                                    <a href=\"".concat(localHref, "\" class=\"").concat(unescape(makeLocalLink(link.href)) === unescape(window.location) ? "" : "link", " block py-1\" ").concat(isConnect ? 'target="_top"' : "", ">").concat(link.text, "</a>\n                                ");
                }).join(""), "\n                    </div>\n                    <div class=\"py-2\">\n                        <a href=\"").concat(serverInfo.baseUrl, "/browse/").concat(issue.key, "\" class=\"link block\">Update Saved Reports</a>\n                    </div>\n                </div>");
            }
            _this.simpleTooltip.belowElementInScrollingContainer(_this, html);
            // wait for this click event to clear the event queue
            setTimeout(function () {
                var handler = function () {
                    _this.simpleTooltip.leftElement();
                    window.removeEventListener("click", handler);
                };
                window.addEventListener("click", handler);
            }, 13);
        });
    };
    SavedUrls.prototype.connected = function () {
        var simpleTooltip = new SimpleTooltip();
        this.parentNode.append(simpleTooltip);
        this.simpleTooltip = simpleTooltip;
    };
    SavedUrls.view = "\n        {{# if(this.canQuery) }}\n            <button class=\"text-center inline-flex items-center mr-8 hover:bg-gray-200 bg-gray-100 rounded-lg pt-1 pr-1 pl-2 font-bitovipoppins font-lg\"\n                on:click=\"this.showSavedReports()\">\n                Saved Reports <svg class=\"w-2.5 h-2.5 ms-2\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 10 6\">\n                <path stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m1 1 4 4 4-4\"/>\n                </svg>\n            </button>\n        {{/ if}}\n\n    ";
    SavedUrls.props = {
        jiraHelpers: type.Any,
        loginComponent: type.Any,
        get canQuery() {
            var _a;
            return this.jiraHelpers && ((_a = this.loginComponent) === null || _a === void 0 ? void 0 : _a.isLoggedIn);
        },
        get globalConfigurationsPromise() {
            if (this.canQuery) {
                return Promise.all([
                    this.jiraHelpers.getServerInfo(),
                    this.jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields({
                        jql: "summary ~ \"Jira Timeline Report Configuration\"",
                        fields: ["summary", "Description"]
                    })
                ])
                    .then(function (_a) {
                    var serverInfo = _a[0], issues = _a[1];
                    var first = issues.find(function (issue) { return issue.fields.Summary === "Jira Timeline Report Configuration"; });
                    if (first) {
                        var description = first.fields.Description.content;
                        return { issue: first, links: findLinks(description), serverInfo: serverInfo };
                    }
                    else {
                        return { links: [] };
                    }
                });
            }
            else {
                return Promise.resolve([]);
            }
        }
    };
    return SavedUrls;
}(StacheElement));
export default SavedUrls;
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
    var isText = fragment.type === "text";
    if (!isText) {
        return false;
    }
    var marks = ((fragment === null || fragment === void 0 ? void 0 : fragment.marks) || []);
    var link = marks.find(function (mark) { return mark.type === "link"; });
    var strong = marks.find(function (mark) { return mark.type === "strong"; });
    if (link) {
        return {
            text: fragment.text,
            href: link.attrs.href,
            default: !!strong
        };
    }
}
function findLinks(document) {
    return searchDocument(document, matchLink);
}
function searchDocument(document, matcher) {
    var matches = [];
    // Helper function to recursively search for matches
    function recurse(doc) {
        if (Array.isArray(doc)) {
            for (var _i = 0, doc_1 = doc; _i < doc_1.length; _i++) {
                var item = doc_1[_i];
                recurse(item);
            }
        }
        else if (typeof doc === 'object' && doc !== null) {
            var result = matcher(doc);
            if (result) {
                matches.push(result); // Collect matching substructure
            }
            else {
                for (var _a = 0, _b = Object.keys(doc); _a < _b.length; _a++) {
                    var key = _b[_a];
                    recurse(doc[key]);
                }
            }
        }
    }
    recurse(document); // Start the recursive search
    return matches; // Return all matching substructures
}
customElements.define("saved-urls", SavedUrls);
