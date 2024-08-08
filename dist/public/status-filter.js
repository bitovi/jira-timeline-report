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
import { StacheElement, type, ObservableObject, ObservableArray } from "./can.js";
import { updateUrlParam } from "./shared/state-storage.js";
import "./shared/autocomplete/autocomplete.js";
var StatusFilter = /** @class */ (function (_super) {
    __extends(StatusFilter, _super);
    function StatusFilter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    StatusFilter.view = "\n    <auto-complete \n        data:from=\"this.statuses\" \n        selected:bind=\"this.selectedStatuses\"\n        inputPlaceholder:raw=\"Search for statuses\"></auto-complete>\n    \n    ";
    StatusFilter.props = {
        statuses: {
            get default() {
                return [];
            }
        },
        param: String,
        selectedStatuses: {
            value: function (_a) {
                var _this = this;
                var resolve = _a.resolve, lastSet = _a.lastSet, listenTo = _a.listenTo;
                var updateValue = function (value) {
                    if (!value) {
                        value = "";
                    }
                    else if (Array.isArray(value)) {
                        value = value.join(",");
                    }
                    updateUrlParam(_this.param, value, "");
                    currentValue = value === "" ? [] : value.split(",");
                    resolve(currentValue);
                };
                var currentValue;
                updateValue(new URL(window.location).searchParams.get(this.param));
                listenTo(lastSet, function (value) {
                    updateValue(value);
                });
            }
        }
    };
    return StatusFilter;
}(StacheElement));
export { StatusFilter };
customElements.define("status-filter", StatusFilter);
