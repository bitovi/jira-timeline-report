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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { StacheElement, type, ObservableObject } from "../can.js";
//import SimpleTooltip from "./simple-tooltip.js";
// ["velocity","tracks","sprint length"];
var TeamConfiguration = /** @class */ (function (_super) {
    __extends(TeamConfiguration, _super);
    function TeamConfiguration() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TeamConfiguration.getTeamConfiguration = function (jiraHelpers) {
        var getIssues = jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields({
            jql: "summary ~ \"Jira Auto Scheduler Configuration\"",
            fields: ["summary", "Description"]
        });
        return Promise.all([jiraHelpers.getServerInfo(), getIssues]).then(function (_a) {
            var serverInfo = _a[0], issues = _a[1];
            var first = issues.find(function (issue) { return issue.fields.Summary === "Jira Auto Scheduler Configuration"; });
            if (first) {
                //const description = first.fields.Description.content,
                //    teamConfiguration = searchDocument(description, matchTeamTable);
                return new TeamConfiguration({ issue: __assign(__assign({}, first), { url: serverInfo.baseUrl + "/browse/" + first.key }) });
            }
            else {
                return new TeamConfiguration({ issue: null });
            }
        });
    };
    Object.defineProperty(TeamConfiguration.prototype, "_issueConfig", {
        get: function () {
            if (this.issue) {
                var teamConfigurationArray = searchDocument(this.issue.fields.Description.content, matchTeamTable);
                if (teamConfigurationArray.length) {
                    return normalizeTeamConfigurationArray(teamConfigurationArray[0]);
                }
            }
        },
        enumerable: false,
        configurable: true
    });
    TeamConfiguration.prototype.getVelocityForTeam = function (team) {
        var _a, _b, _c, _d, _e;
        if ((_b = (_a = this.temporaryData) === null || _a === void 0 ? void 0 : _a[team]) === null || _b === void 0 ? void 0 : _b.velocity) {
            return this.temporaryData[team].velocity;
        }
        else if ((_d = (_c = this._issueConfig) === null || _c === void 0 ? void 0 : _c[team]) === null || _d === void 0 ? void 0 : _d.velocity) {
            return (_e = this._issueConfig) === null || _e === void 0 ? void 0 : _e[team].velocity;
        }
        else {
            return 21;
        }
    };
    TeamConfiguration.prototype.setVelocityForTeam = function (team, value) {
        if (this.temporaryData[team]) {
            this.temporaryData[team] = __assign(__assign({}, this.temporaryData[team]), { velocity: value });
        }
        else {
            this.temporaryData[team] = { name: team, velocity: value };
        }
    };
    TeamConfiguration.prototype.updateConfiguration = function () {
        console.log("TODO", this.temporaryData, this._issueConfig);
    };
    TeamConfiguration.prototype.getDaysPerSprintForTeam = function (team) {
        return 10;
    };
    TeamConfiguration.prototype.getTracksForTeam = function (team) {
        var _a, _b, _c, _d, _e;
        if ((_b = (_a = this.temporaryData) === null || _a === void 0 ? void 0 : _a[team]) === null || _b === void 0 ? void 0 : _b.tracks) {
            return this.temporaryData[team].tracks;
        }
        else if ((_d = (_c = this._issueConfig) === null || _c === void 0 ? void 0 : _c[team]) === null || _d === void 0 ? void 0 : _d.tracks) {
            return (_e = this._issueConfig) === null || _e === void 0 ? void 0 : _e[team].tracks;
        }
        else {
            return 1;
        }
    };
    TeamConfiguration.prototype.addTrackForTeam = function (team) {
        var newTracks = this.getTracksForTeam(team) + 1;
        if (this.temporaryData[team]) {
            this.temporaryData[team] = __assign(__assign({}, this.temporaryData[team]), { tracks: newTracks });
        }
        else {
            this.temporaryData[team] = { name: team, tracks: newTracks };
        }
    };
    TeamConfiguration.prototype.removeTrackForTeam = function (team) {
        var newTracks = Math.max(this.getTracksForTeam(team) - 1, 1);
        if (this.temporaryData[team]) {
            this.temporaryData[team] = __assign(__assign({}, this.temporaryData[team]), { tracks: newTracks });
        }
        else {
            this.temporaryData[team] = { name: team, tracks: newTracks };
        }
    };
    TeamConfiguration.props = {
        temporaryData: { get default() { return new ObservableObject(); } }
    };
    return TeamConfiguration;
}(ObservableObject));
var aliases = {
    "velocities": "velocity",
    "track": "tracks", "parallel epics": "tracks",
    "sprint length": "sprintLength", "sprint days": "sprintLength",
    "team": "name"
};
var propertiesToTurnIntoNumbers = ["velocity", "tracks", "sprint length"];
function normalizeTeamConfigurationArray(teamConfigurationArray) {
    var normalizedTeamData = {};
    for (var _i = 0, teamConfigurationArray_1 = teamConfigurationArray; _i < teamConfigurationArray_1.length; _i++) {
        var team = teamConfigurationArray_1[_i];
        var record = {};
        for (var prop in team) {
            var propToSet = prop in aliases ? aliases[prop] : prop;
            record[propToSet] = propertiesToTurnIntoNumbers.includes(propToSet) ?
                +team[prop] : team[prop];
        }
        normalizedTeamData[record.name] = record;
    }
    return normalizedTeamData;
}
var VelocitiesFromIssue = /** @class */ (function (_super) {
    __extends(VelocitiesFromIssue, _super);
    function VelocitiesFromIssue() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /*
    showSavedReports(){
        const div = document.createElement("div");
        this.globalConfigurationsPromise.then(({links, issue,serverInfo}) => {
            // come back acround and fix this
            
            let html = ``
            if(!issue) {
                html += `<a href="https://github.com/bitovi/jira-timeline-report/blob/main/docs/saved-reports.md" class="link block">Create Saved Reports</a>`
            } else {
                html += `
                <div class="divide-y divide-gray-100">
                    <div class="py-2">
                        ${
                            links.map(link => {
                                return `
                                    <a href="${link.href}" class="${
                                        unescape(link.href) === unescape(window.location) ? "" : "link"
                                    } block py-1">${link.text}</a>
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
    */
    VelocitiesFromIssue.prototype.connected = function () {
        //const simpleTooltip = new SimpleTooltip();
        //this.parentNode.append(simpleTooltip);
        //this.simpleTooltip = simpleTooltip;
    };
    VelocitiesFromIssue.view = "\n        {{# if(this.canQuery) }}\n            <div class=\"mr-8 hover:bg-gray-200 bg-gray-100 rounded-lg font-bitovipoppins font-lg\">\n                {{# if(this.teamConfigurationPromise.isPending) }}\n                    <span class=\"px-2 py-1\">Loading ...</span>\n                {{/ }}\n\n                {{# if(this.teamConfigurationPromise.isResolved) }}\n                    \n                    {{# if(this.teamConfigurationPromise.value.issue) }}\n\n                        <a class=\"px-2 py-1\" href=\"{{this.teamConfigurationPromise.value.issue.url}}\" target=\"_blank\">\n                            Configuration Issue\n                        </a>\n                    {{ else }}\n                            <a class=\"px-2 py-1\" href=\"https://github.com/bitovi/jira-auto-scheduler/blob/main/docs/saved-configuration.md\" target=\"_blank\">\n                            Create Configuration\n                            </a>\n                    {{/ if }}\n\n                {{/ }}\n            </div>\n        {{/ if}}\n\n    ";
    VelocitiesFromIssue.props = {
        jiraHelpers: type.Any,
        isLoggedIn: Boolean,
        get canQuery() {
            return this.jiraHelpers && this.isLoggedIn;
        },
        get teamConfigurationPromise() {
            if (this.canQuery) {
                return TeamConfiguration.getTeamConfiguration(this.jiraHelpers);
            }
            else {
                return Promise.resolve(new TeamConfiguration({ issue: null }));
            }
        }
    };
    return VelocitiesFromIssue;
}(StacheElement));
export { VelocitiesFromIssue };
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
function isParagraph(frag) { return frag.type === "paragraph"; }
function getTextFromParagraph(p) {
    return p.content.filter(function (text) { return text.type === "text"; }).map(function (text) { return text.text; });
}
function getTextFromWithinCell(cell) {
    return cell.content.filter(isParagraph)
        .map(getTextFromParagraph).flat().join(" ");
}
function matchTeamTable(fragment) {
    if (fragment.type !== "table") {
        return false;
    }
    if (fragment.content[0].type !== "tableRow") {
        return false;
    }
    var headerRow = fragment.content[0];
    var headerTitles = headerRow.content.map(function (header) {
        // gets the first text from each header cell
        return getTextFromWithinCell(header).toLowerCase();
    });
    if (!headerTitles.includes("team")) {
        return false;
    }
    var records = [];
    // build objects from other table content 
    for (var i = 1; i < fragment.content.length; i++) {
        var row = fragment.content[i];
        var record = {};
        // loop
        for (var c = 0; c < row.content.length; c++) {
            var name_1 = headerTitles[c];
            var cell = row.content[c];
            record[name_1] = getTextFromWithinCell(cell);
        }
        records.push(record);
    }
    return records;
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
customElements.define("velocities-from-issue", VelocitiesFromIssue);
