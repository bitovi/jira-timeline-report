var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { TimelineReport } from "../timeline-report.js";
import "../shared/saved-urls.js";
import "../shared/select-cloud.js";
import "../shared/velocities-from-issue.js";
import JiraLogin from "../shared/jira-login.js";
import JiraOIDCHelpers from "../jira-oidc-helpers";
import { getHostedRequestHelper } from "../request-helpers/hosted-request-helper.js";
import { getConnectRequestHelper } from "../request-helpers/connect-request-helper.js";
export default function mainHelper(config, host) {
    return __awaiter(this, void 0, void 0, function () {
        var requestHelper, jiraHelpers, loginComponent, savedUrls, selectCloud, velocitiesConfiguration, listener;
        return __generator(this, function (_a) {
            if (host === 'jira') {
                requestHelper = getConnectRequestHelper();
            }
            else {
                requestHelper = getHostedRequestHelper(config);
            }
            jiraHelpers = JiraOIDCHelpers(config, requestHelper, host);
            loginComponent = new JiraLogin().initialize({ jiraHelpers: jiraHelpers });
            savedUrls = document.querySelector("saved-urls");
            savedUrls.loginComponent = loginComponent;
            savedUrls.jiraHelpers = jiraHelpers;
            selectCloud = document.querySelector("select-cloud");
            if (selectCloud) {
                selectCloud.loginComponent = loginComponent;
                selectCloud.jiraHelpers = jiraHelpers;
            }
            velocitiesConfiguration = document.querySelector("velocities-from-issue");
            velocitiesConfiguration.jiraHelpers = jiraHelpers;
            velocitiesConfiguration.isLoggedIn = loginComponent.isLoggedIn;
            loginComponent.listenTo("isLoggedIn", function (_a) {
                var value = _a.value;
                velocitiesConfiguration.isLoggedIn = value;
            });
            listener = function (_a) {
                var value = _a.value;
                if (value) {
                    loginComponent.off("isResolved", listener);
                    mainElement.style.display = "none";
                    var report = new TimelineReport().initialize({ jiraHelpers: jiraHelpers, loginComponent: loginComponent, mode: "TEAMS", velocitiesConfiguration: velocitiesConfiguration });
                    report.className = "block";
                    document.body.append(report);
                }
            };
            loginComponent.on("isResolved", listener);
            login.appendChild(loginComponent);
            if (host === 'jira') {
                login.style.display = "none";
            }
            return [2 /*return*/, loginComponent];
        });
    });
}
