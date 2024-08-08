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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { StacheElement, type, ObservableObject, fromAttribute } from "../../can.js";
import SimpleTooltip from "../simple-tooltip.js";
// create global tooltip reference
var TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);
var AutoCompleteSuggestions = /** @class */ (function (_super) {
    __extends(AutoCompleteSuggestions, _super);
    function AutoCompleteSuggestions() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AutoCompleteSuggestions.view = "\n        \n        <ul class=\"max-h-80 overflow-y-auto\">\n            {{# if(this.data.length) }}\n                {{# for(item of this.data) }}\n                    <li class=\"px-2 hover:bg-blue-75 cursor-pointer\" on:click=\"this.add(item)\">{{item}}</li>\n                {{/ for }}\n            {{ else }}\n                <li>No matches</li>\n            {{/ if }}\n        </ul>\n    ";
    return AutoCompleteSuggestions;
}(StacheElement));
customElements.define("auto-complete-suggestions", AutoCompleteSuggestions);
var AutoComplete = /** @class */ (function (_super) {
    __extends(AutoComplete, _super);
    function AutoComplete() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AutoComplete.prototype.remove = function (item, event) {
        event.preventDefault();
        this.selected = this.selected.filter(function (selectedItem) {
            return selectedItem != item;
        });
    };
    AutoComplete.prototype.add = function (item) {
        this.selected = __spreadArray(__spreadArray([], this.selected, true), [item], false);
        this.querySelector("input").value = "";
        this.stopShowingSuggestions();
    };
    AutoComplete.prototype.suggestItems = function (searchTerm) {
        var _this = this;
        var matches = this.data.filter(function (item) {
            return item.toLowerCase().includes(searchTerm) && !_this.selected.includes(item);
        });
        this.showingSuggestions = true;
        // this could be made more efficient, but is probably ok
        TOOLTIP.belowElementInScrollingContainer(this, new AutoCompleteSuggestions().initialize({
            searchTerm: searchTerm,
            data: matches,
            add: this.add.bind(this)
        }));
    };
    AutoComplete.prototype.connected = function () {
        var _this = this;
        // handle when someone clicks off the element
        this.listenTo(window, "click", function (event) {
            // if we aren't showing, don't worry about it
            if (!_this.showingSuggestions) {
                return;
            }
            // do nothing if the input was clicked on
            if (_this.querySelector("input") === event.target) {
                return;
            }
            // do nothing if the TOOLTIP was clicked
            if (TOOLTIP.contains(event.target)) {
                return;
            }
            _this.stopShowingSuggestions();
        });
    };
    AutoComplete.prototype.stopShowingSuggestions = function () {
        TOOLTIP.leftElement();
        this.showingSuggestions = false;
    };
    AutoComplete.view = "\n        <div class=\"flex gap-2 align-middle flex-wrap\">\n            {{# for(item of this.selected) }}\n                <div class=\"border-neutral-800 border-solid border rounded-md whitespace-nowrap\">\n                    <label class=\"inline p-1\">{{item}}</label>\n                    <button class=\"text-red-500 text-sm py-1 px-2 bg-neutral-30 font-semibold rounded-r shadow-sm hover:bg-neutral-40\" on:click=\"this.remove(item, scope.event)\">x</button>\n                </div>\n            {{/ for }}\n            <input class=\"form-border rounded-md px-1 placeholder:italic placeholder:text-slate-400\" \n                placeholder=\"{{this.inputPlaceholder}}\"\n                on:focus=\"this.suggestItems(scope.element.value)\"\n                on:input=\"this.suggestItems(scope.element.value)\">\n        </div>\n    ";
    AutoComplete.props = {
        data: { type: type.Any },
        selected: { type: type.Any },
        showingSuggestions: { type: Boolean, default: false }
    };
    return AutoComplete;
}(StacheElement));
customElements.define("auto-complete", AutoComplete);
export default AutoComplete;
