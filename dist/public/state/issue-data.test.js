// @vitest-environment jsdom
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
import { ObservableObject, value } from "../can.js";
import { rawIssuesRequestData, derivedIssuesRequestData } from "./issue-data.js";
var ResolverObservable = (function () {
    var T = /** @class */ (function (_super) {
        __extends(T, _super);
        function T() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        T.props = {
            value: {
                value: function (_a) {
                    var listenTo = _a.listenTo, resolve = _a.resolve;
                }
            }
        };
        return T;
    }(ObservableObject));
    var t = new T();
    t.listenTo("value", function () { });
    // resolver, context, initialValue, {resetUnboundValueInGet}
    return t._computed.value.compute.constructor;
})();
function completeCallback(fn) {
    var done;
    var donePromise = new Promise(function (resolve) {
        done = resolve;
    });
    return function (assert) {
        fn(assert, done);
        return donePromise;
    };
}
import { expect, test } from 'vitest';
test("rawIssuesRequestData", function (assert) {
    var jql = value.with(""), isLoggedIn = value.with(true), serverInfo = value.with({
        "baseUrl": "https://mistech.atlassian.net"
    }), teamData = value.with([
        { name: "JBM", velocity: 13, tracks: 2, sprintLength: 15 }
    ]), loadChildren = value.with(true), jiraHelpers = {
        fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: function () {
            return Promise.resolve([{ key: "TEST-123" }]);
        },
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: function () {
            return Promise.resolve([{ key: "TEST-321" }]);
        }
    };
    var requestData = new ResolverObservable(function (hooks) {
        return rawIssuesRequestData({
            jql: jql,
            isLoggedIn: isLoggedIn,
            serverInfo: serverInfo,
            teamData: teamData,
            loadChildren: loadChildren,
            jiraHelpers: jiraHelpers
        }, hooks);
    });
    expect(requestData.value.issuesPromise).toBeInstanceOf(Promise);
    jql.value = "Something";
    expect(typeof requestData.value.issuesPromise).toBe("object");
});
test("derivedIssuesRequestData", function (assert) {
    return __awaiter(this, void 0, void 0, function () {
        var rawIssuesRequestData, configurationPromise, derivedIssuesData, issues;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rawIssuesRequestData = value.with({
                        issuesPromise: Promise.resolve([{ key: "TEST-123", fields: {
                                    CONFIDENCE: 20
                                } }]),
                        progressData: {}
                    });
                    configurationPromise = value.with(null);
                    derivedIssuesData = new ResolverObservable(function (hooks) {
                        return derivedIssuesRequestData({
                            rawIssuesRequestData: rawIssuesRequestData,
                            configurationPromise: configurationPromise
                        }, hooks);
                    });
                    expect(derivedIssuesData.value.issuesPromise.__isAlwaysPending).toBe(true);
                    configurationPromise.value = {
                        getConfidence: function (_a) {
                            var fields = _a.fields;
                            return fields.CONFIDENCE;
                        }
                    };
                    expect(derivedIssuesData.value.issuesPromise.__isAlwaysPending).toBe(undefined);
                    return [4 /*yield*/, derivedIssuesData.value.issuesPromise];
                case 1:
                    issues = _a.sent();
                    expect(issues[0].confidence).toBe(20);
                    return [2 /*return*/];
            }
        });
    });
});
