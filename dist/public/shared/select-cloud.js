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
import { StacheElement, type, stache } from "../can.js";
import SimpleTooltip from "./simple-tooltip.js";
var resourceSelection = stache("<div class=\"\">\n    {{# for(resource of this.resources) }}\n        <button class=\"link block\" on:click=\"this.setResource(resource)\">{{resource.name}}</button>\n    {{/ for }}\n</div>");
var pillClass = "text-center inline-flex items-center mr-8 bg-gray-100 rounded-lg pt-1 pr-1 font-bitovipoppins font-lg";
var SelectCloud = /** @class */ (function (_super) {
    __extends(SelectCloud, _super);
    function SelectCloud() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SelectCloud.prototype.showResources = function () {
        var _this = this;
        var div = document.createElement("div");
        this.alternateResources.then(function (resources) {
            // come back acround and fix this
            _this.simpleTooltip.belowElementInScrollingContainer(_this, resourceSelection({
                resources: resources,
                setResource: function (resource) {
                    localStorage.setItem("scopeId", resource.id);
                    window.location.reload();
                }
            }));
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
    SelectCloud.prototype.connected = function () {
        var simpleTooltip = new SimpleTooltip();
        this.parentNode.append(simpleTooltip);
        this.simpleTooltip = simpleTooltip;
    };
    SelectCloud.view = "\n        {{# if(this.alternateResources.isPending) }}\n            <div class=\"".concat(pillClass, "\"> ... </div>\n        {{/ if }}\n        {{# if(this.alternateResources.value.length)}}\n            <button class=\"").concat(pillClass, " pl-2 hover:bg-gray-200\"\n                on:click=\"this.showResources()\">\n                {{# if(this.currentResource.value.name) }}<span>{{this.currentResource.value.name}}</span>{{/if}}\n                <svg class=\"w-2.5 h-2.5 ms-2\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 10 6\">\n                <path stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m1 1 4 4 4-4\"/>\n                </svg>\n            </button>\n        {{/ if }}\n        {{# and(not(this.alternateResources.value.length), this.currentResource.value.name) }}\n            <div class=\"").concat(pillClass, " pl-2\">\n                {{this.currentResource.value.name}}\n            </div>\n        {{/and}}\n\n    ");
    SelectCloud.props = {
        jiraHelpers: type.Any,
        loginComponent: type.Any,
        get canQuery() {
            var _a;
            return this.jiraHelpers && ((_a = this.loginComponent) === null || _a === void 0 ? void 0 : _a.isLoggedIn);
        },
        get accessibleResources() {
            if (this.canQuery) {
                return this.jiraHelpers.fetchAccessibleResources().then(function (resources) {
                    var currentCloudId = localStorage.getItem("scopeId");
                    return resources.map(function (resource) {
                        return __assign(__assign({}, resource), { isCurrent: resource.id === currentCloudId });
                    });
                });
            }
            else {
                return Promise.resolve([]);
            }
        },
        get currentResource() {
            return this.accessibleResources.then(function (resources) {
                return resources.find(function (r) { return r.isCurrent; });
            });
        },
        get alternateResources() {
            return this.accessibleResources.then(function (resources) {
                return resources.filter(function (r) { return !r.isCurrent; });
            });
        }
    };
    return SelectCloud;
}(StacheElement));
export default SelectCloud;
customElements.define("select-cloud", SelectCloud);
