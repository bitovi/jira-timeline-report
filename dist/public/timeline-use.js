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
import showdown from "./showdown.js";
var POLL = false;
var TimelineUse = /** @class */ (function (_super) {
    __extends(TimelineUse, _super);
    function TimelineUse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TimelineUse.prototype.connectedCallback = function () {
        this.update();
        this.converter = new showdown.Converter({ tables: true });
        if (POLL) {
            setInterval(this.update.bind(this), 3000);
        }
    };
    TimelineUse.prototype.update = function () {
        var _this = this;
        fetch("./timeline-use.md").then(function (r) { return r.text(); }).then(function (text) {
            _this.innerHTML = _this.converter.makeHtml(text);
        });
    };
    return TimelineUse;
}(HTMLElement));
customElements.define("timeline-use", TimelineUse);
