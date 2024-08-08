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
var SimpleTooltip = /** @class */ (function (_super) {
    __extends(SimpleTooltip, _super);
    function SimpleTooltip() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(SimpleTooltip, "observedAttributes", {
        get: function () { return ['for']; },
        enumerable: false,
        configurable: true
    });
    SimpleTooltip.prototype.attributeChangedCallback = function (name, oldValue, newValue) {
    };
    SimpleTooltip.prototype.connectedCallback = function () {
        this.enteredElement = this.enteredElement.bind(this);
        this.leftElement = this.leftElement.bind(this);
        this.forElement = this.getAttribute("for");
        this.style.display = "none";
        this.style.position = "absolute";
    };
    SimpleTooltip.prototype.disconnectedCallback = function () {
        if (this._forElement) {
            this._forElement.removeEventListener("mouseenter", this.enteredElement);
            this._forElement.removeEventListener("mouseenter", this.leftElement);
        }
    };
    Object.defineProperty(SimpleTooltip.prototype, "forElement", {
        set: function (element) {
            if (typeof element === "string") {
                element = document.querySelectorAll(element);
            }
            if (this._forElement) {
                this._forElement.removeEventListener("mouseenter", this.enteredElement);
                this._forElement.removeEventListener("mouseenter", this.leftElement);
            }
            if (element) {
                element.addEventListener("mouseenter", this.enteredElement);
                element.addEventListener("mouseenter", this.leftElement);
            }
            this._forElement = element;
        },
        enumerable: false,
        configurable: true
    });
    SimpleTooltip.prototype.enteredElement = function (event, html) {
        if (arguments.length > 1) {
            this.innerHTML = html;
            var rect = event.currentTarget.getBoundingClientRect();
            this.style.top = (window.scrollY + rect.bottom) + "px";
            this.style.left = (window.scrollX + rect.left) + "px";
            this.style.display = "";
        }
    };
    SimpleTooltip.prototype.belowElement = function (element, DOM) {
        if (arguments.length > 1) {
            this.innerHTML = "";
            this.appendChild(DOM);
            this.style.top = "-1000px";
            this.style.left = "-1000px";
            this.style.display = "";
            var height = this.clientHeight;
            var rect = element.getBoundingClientRect();
            var top_1 = (window.scrollY + rect.bottom);
            var bottom = top_1 + height;
            if (bottom >= window.innerHeight) {
                this.style.top = (rect.top - height) + "px";
            }
            else {
                this.style.top = top_1 + "px";
            }
            this.style.left = (window.scrollX + rect.left) + "px";
        }
    };
    SimpleTooltip.prototype.belowElementInScrollingContainer = function (element, DOM) {
        // find if there's a scrolling container and move ourselves to that 
        var container = findScrollingContainer(element);
        this.innerHTML = "";
        container.appendChild(this);
        // find the relative position 
        this.style.top = "-1000px";
        this.style.left = "-1000px";
        if (typeof DOM === "string") {
            this.innerHTML = DOM;
        }
        else {
            this.appendChild(DOM);
        }
        this.style.display = "";
        // where is the container on the page
        var containerRect = container.getBoundingClientRect(), 
        // where is the element we are positioning next to on the page
        elementRect = element.getBoundingClientRect(), 
        // how big is the tooltip
        tooltipRect = this.getBoundingClientRect();
        var containerStyles = window.getComputedStyle(container);
        // how much room is there 
        // where would the tooltip's bottom reach in the viewport 
        var bottomInWindow = elementRect.bottom + tooltipRect.height;
        // if the tooltip wouldn't be visible "down"
        if (bottomInWindow > window.innerHeight) {
            var viewPortPosition = (elementRect.top - tooltipRect.height);
            var posInContainer = viewPortPosition - containerRect.top - parseFloat(containerStyles.borderTopWidth, 10);
            var posInContainerAccountingForScrolling = posInContainer + container.scrollTop;
            this.style.top = (posInContainerAccountingForScrolling) + "px";
        }
        else {
            var topFromContainer = elementRect.bottom - containerRect.top - parseFloat(containerStyles.borderTopWidth, 10);
            this.style.top = (topFromContainer + container.scrollTop) + "px";
        }
        var leftFromContainer = elementRect.left - containerRect.left;
        this.style.left = leftFromContainer + "px";
    };
    SimpleTooltip.prototype.centeredBelowElement = function (element, html) {
        if (arguments.length > 1) {
            this.style.top = "-1000px";
            this.style.left = "-1000px";
            this.innerHTML = html;
            this.style.display = "";
            debugger;
            var tooltipRect = this.getBoundingClientRect();
            var rect = element.getBoundingClientRect();
            this.style.top = (window.scrollY + rect.bottom) + "px";
            this.style.left = (window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2)) + "px";
        }
    };
    SimpleTooltip.prototype.topRightOnElementBottomRight = function (element, html) {
        if (arguments.length > 1) {
            this.style.top = "-1000px";
            this.style.left = "-1000px";
            if (typeof html === "string") {
                this.innerHTML = html;
            }
            else {
                this.innerHTML = "";
                this.appendChild(html);
            }
            this.style.display = "";
            var tooltipRect = this.getBoundingClientRect();
            var rect = element.getBoundingClientRect();
            this.style.top = (window.scrollY + rect.bottom) + "px";
            this.style.left = (window.scrollX + rect.left + (rect.width) - (tooltipRect.width)) + "px";
        }
    };
    SimpleTooltip.prototype.leftElement = function (event) {
        this.style.display = "none";
    };
    return SimpleTooltip;
}(HTMLElement));
customElements.define("simple-tooltip", SimpleTooltip);
export default SimpleTooltip;
function findScrollingContainer(element) {
    var cur = element.parentElement;
    while (cur && cur.scrollHeight === cur.clientHeight) {
        cur = cur.parentElement;
    }
    if (!cur) {
        return document.body;
    }
    else {
        return cur;
    }
}
