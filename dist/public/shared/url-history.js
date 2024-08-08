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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { StacheElement, type } from "../can.js";
function getSavedSettings() {
    var json = localStorage.getItem("savedSettings") || "[]";
    try {
        var data = JSON.parse(json);
        return data.map(function (datum) {
            return __assign(__assign({}, datum), { search: new URLSearchParams(datum.search) });
        });
    }
    catch (e) {
        localStorage.removeItem("savedSettings");
        return [];
    }
}
// this doesn't work deep for now
function areSearchParamsEqual(params1, params2) {
    var keys1 = __spreadArray([], params1.keys(), true).sort();
    var keys2 = __spreadArray([], params2.keys(), true).sort();
    if (keys1.length !== keys2.length)
        return false;
    for (var _i = 0, keys1_1 = keys1; _i < keys1_1.length; _i++) {
        var key = keys1_1[_i];
        if (params1.get(key) !== params2.get(key)) {
            return false;
        }
    }
    return true;
}
function addSavedSetting(searchParams, name) {
    var saved = getSavedSettings();
    var index = saved.findIndex(function (saved) { return areSearchParamsEqual(searchParams, saved.search); });
    if (index >= 0) {
        saved.splice(index, 1);
    }
    saved.unshift({ name: name, search: searchParams });
    if (saved.length > 10) {
        saved.splice(10);
    }
    updateSavedSettings(saved);
}
function updateSavedSettings(saved) {
    var jsonable = saved.map(function (searchParams) {
        return __assign(__assign({}, searchParams), { search: searchParams.search.toString() });
    });
    var json = JSON.stringify(jsonable);
    localStorage.setItem("savedSettings", json);
}
function deleteSavedSetting(index) {
    var current = getSavedSettings();
    if (index >= 0) {
        current.splice(index, 1);
    }
    updateSavedSettings(current);
}
function makeDefaultSavedSetting(index) {
    var current = getSavedSettings();
    current.forEach(function (setting) {
        delete setting.isDefault;
    });
    current[index].isDefault = true;
    updateSavedSettings(current);
}
function getDefaultConfigurationName() {
    var numbers = [];
    var savedConfigurations = getSavedSettings();
    for (var _i = 0, savedConfigurations_1 = savedConfigurations; _i < savedConfigurations_1.length; _i++) {
        var name_1 = savedConfigurations_1[_i].name;
        var results = name_1.match(/^My Configuration(?: (\d+))?$/);
        if (results) {
            if (results[1] !== undefined) {
                numbers[+results[1]] = true;
            }
            else {
                numbers[0] = true;
            }
        }
    }
    if (numbers.length === 0) {
        return "My Configuration";
    }
    else {
        return "My Configuration " + numbers.length;
    }
}
function setDefaultConfiguration() {
    var defaultConfiguration = getSavedSettings().find(function (configuration) { return configuration.isDefault; });
    if (defaultConfiguration && new URLSearchParams(window.location.search).size === 0) {
        window.history.replaceState(null, "", "?" + defaultConfiguration.search.toString());
    }
}
setDefaultConfiguration();
function onPushstate(callback) {
    (function (history) {
        var pushState = history.pushState;
        history.pushState = function (state) {
            callback && callback();
            return pushState.apply(history, arguments);
        };
    })(window.history);
    // a bad form of teardown ...
    return function () {
        callback = null;
    };
}
var UrlHistory = /** @class */ (function (_super) {
    __extends(UrlHistory, _super);
    function UrlHistory() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UrlHistory.prototype.saveCurrentConfiguration = function () {
        var result = prompt("What do you want to name this configuration?", getDefaultConfigurationName());
        if (result !== null) {
            addSavedSetting(new URLSearchParams(window.location.search), result);
        }
        this.dispatch("updated");
    };
    UrlHistory.prototype.prettyOptions = function (options) {
        return options.name;
    };
    UrlHistory.prototype.deleteConfiguration = function (index) {
        deleteSavedSetting(index);
        this.dispatch("updated");
    };
    UrlHistory.prototype.makeDefault = function (index) {
        makeDefaultSavedSetting(index);
        this.dispatch("updated");
    };
    UrlHistory.prototype.currentUrlClass = function (configuration) {
        if (areSearchParamsEqual(new URLSearchParams(window.location.search), configuration.search)) {
            return "font-bold";
        }
        else {
            return "";
        }
    };
    UrlHistory.view = "\n        <div class=\"flex align-baseline justify-between\">\n            <h3 class=\"h3\">Saved Configurations</h3>\n            <div class=\"mt-8\">\n                <button class=\"bg-gray-300 hover:bg-gray-400 text-gray-800 py-1 px-2 rounded inline-flex items-center\" on:click=\"this.saveCurrentConfiguration()\">\n                    <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\" class=\"w-5 h-5 inline-block\">\n                        <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z\" />\n                    </svg> Save current configuration\n                </button>\n            </div>\n        </div>\n       {{# eq(this.availableConfigurations.length , 0) }}\n        <p>There are no saved configurations.</p>\n       {{ else }}\n        <div class=\"grid gap-2 my-2\" style=\"grid-template-columns: auto auto auto;\">\n            <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 1 / span 1; grid-row: 1 / span 1;\">Name</div>   \n            <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 2 / span 1; grid-row: 1 / span 1;\">Default Configuration</div>\n            <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 3 / span 1; grid-row: 1 / span 1;\">Delete</div>\n            <div class=\"border-b-2 border-neutral-40\" style=\"grid-column: 1 / span 3; grid-row: 1 / span 1;\"></div>\n            {{# for(configuration of this.availableConfigurations) }}\n\n                <div>\n                    <a href=\"?{{configuration.search.toString()}}\" class=\"link {{this.currentUrlClass(configuration)}}\">{{ configuration.name }}</a>\n                </div>\n                <div>\n                    <input type=\"radio\" checked:from=\"configuration.isDefault\" on:click=\"this.makeDefault(scope.index)\">\n                </div>\n                <div>\n                    <button on:click=\"this.deleteConfiguration(scope.index)\">\u274C</button>\n                </div>\n\n            {{/ for }}\n        </div>\n        {{/ eq }}\n        <div>\n            Global Config\n        </div>\n        <div>\n            Got it: {{this.globalConfigurationsPromise.value.length}}\n        </div>\n        {{# for(link of this.globalConfigurationsPromise.value) }}\n        <div>\n            <a href=\"{{link.href}}\" class=\"link\">{{link.text}}</a>\n        </div>\n        {{/ }}\n    ";
    UrlHistory.props = {
        availableConfigurations: {
            value: function (_a) {
                var resolve = _a.resolve, listenTo = _a.listenTo;
                resolve(getSavedSettings());
                listenTo("updated", function () {
                    resolve(getSavedSettings());
                });
            }
        },
        get globalConfigurationsPromise() {
            return this.jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields({
                jql: "summary ~ \"Jira Timeline Report Configuration\"",
                fields: ["summary", "Description"]
            }).then(function (issues) {
                var first = issues.find(function (issue) { return issue.fields.Summary === "Jira Timeline Report Configuration"; });
                if (first) {
                    var description = first.fields.Description.content;
                    return findLinks(description);
                }
                else {
                    return [];
                }
            });
        },
        get defaultSearch() {
            var defaultConfig = this.availableConfigurations.find(function (config) { return config.isDefault; });
            return defaultConfig === null || defaultConfig === void 0 ? void 0 : defaultConfig.search;
        }
        /*availableOptions: {
            value({listenTo, resolve}) {
                resolve( getSavedSettings() );

                let timer;
                // no changes after 3 min
                const teardown = onPushstate(()=>{
                    const search = window.location.search;
                    console.log("new search");
                    clearTimeout(search);
                    timer = setTimeout(()=> {
                        console.log("adding", search);
                        addSavedSetting(new URLSearchParams(search));
                        const newValue = getSavedSettings();
                        console.log("resolving", newValue.map( v => v.toString() ))
                        resolve( newValue );
                    }, 3 * 60 * 1000);
                })

                return teardown;
            }
        }*/
    };
    return UrlHistory;
}(StacheElement));
export default UrlHistory;
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
customElements.define("url-history", UrlHistory);
