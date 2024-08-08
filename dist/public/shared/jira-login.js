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
var JiraLogin = /** @class */ (function (_super) {
    __extends(JiraLogin, _super);
    function JiraLogin() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    JiraLogin.prototype.login = function () {
        var _this = this;
        this.isResolved = false;
        this.isPending = true;
        this.jiraHelpers.getAccessToken().then(function () {
            _this.isLoggedIn = true;
            _this.isResolved = true;
            _this.isPending = false;
        });
    };
    JiraLogin.prototype.logout = function () {
        this.isPending = true;
        this.jiraHelpers.clearAuthFromLocalStorage();
        this.isLoggedIn = false;
        this.isResolved = false;
        this.isPending = false;
    };
    JiraLogin.prototype.connected = function () {
        // imperative is easier here ...
        var _this = this;
        // if someone had a token, always automatically log them in
        if (this.jiraHelpers.hasAccessToken()) {
            if (this.jiraHelpers.hasValidAccessToken()) {
                this.isLoggedIn = true;
                this.isResolved = true;
                this.isPending = false;
            }
            else {
                this.jiraHelpers.getAccessToken().then(function () {
                    _this.isLoggedIn = true;
                    _this.isResolved = true;
                    _this.isPending = false;
                });
            }
        }
        else {
            this.isLoggedIn = false;
            this.isResolved = true;
            this.isPending = false;
        }
    };
    JiraLogin.view = "\n    {{# if(this.isPending) }}\n        <button\n            class=\"p-1 block pointer bg-orange-400 text-white rounded-lg font-bitovipoppins font-lg font-bold\"\n            style=\"border: none\">\n            Connecting\n        </button>\n    {{ else }}\n        {{# if(this.isLoggedIn) }}\n            <button\n                class=\"p-1 block pointer bg-orange-400 text-white rounded-lg font-bitovipoppins font-lg font-bold\"\n                style=\"border: none\"\n                on:click=\"this.logout()\">\n                Log Out\n            </button>\n        {{ else }}\n            <button\n                class=\"p-1 block pointer bg-orange-400 text-white rounded-lg font-bitovipoppins font-lg font-bold\"\n                style=\"border: none\"\n                on:click=\"this.login()\">\n                Connect to Jira\n            </button>\n        {{/ if }}\n    {{/ if }}\n    {{# not(this.isResolved) }}\n\n    {{/ not}}\n\n   \n    ";
    JiraLogin.props = {
        jiraHelpers: type.Any,
        isLoggedIn: false,
        isResolved: false,
        isPending: true
    };
    return JiraLogin;
}(StacheElement));
export default JiraLogin;
customElements.define("jira-login", JiraLogin);
