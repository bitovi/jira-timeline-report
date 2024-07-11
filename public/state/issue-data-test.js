import { ObservableObject, value } from "../can.js";
import {rawIssuesRequestData, derivedIssuesRequestData} from "./issue-data.js";

import { test } from "../test/test.js";

const ResolverObservable = (function(){
    class T extends ObservableObject {
        static props = {
            value: {
                value({listenTo, resolve}) {}
            }
        };
    }

    let t = new T()
    t.listenTo("value", function(){});
    // resolver, context, initialValue, {resetUnboundValueInGet}
    return t._computed.value.compute.constructor;
})();




function completeCallback(fn) {
    let done;
    const donePromise = new Promise((resolve) => {
        done =  resolve;
    })
    return function(assert){
        fn(assert, done);
        return donePromise;
    };
}

test("rawIssuesRequestData", completeCallback( function(assert, done){
    const jql = value.with(""),
        isLoggedIn = value.with(true),
        serverInfo = value.with({
            "baseUrl": "https://mistech.atlassian.net"
        }),
        teamData = value.with([
            {name: "JBM", velocity: 13, tracks: 2, sprintLength: 15}
        ]),
        loadChildren = value.with(true),
        jiraHelpers = {
            fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: function(){
                return Promise.resolve([{key: "TEST-123"}])
            },
            fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: function(){
                return Promise.resolve([{key: "TEST-321"}])
            }
        }

    
    const requestData = new ResolverObservable(function(hooks){
        return rawIssuesRequestData({
            jql,
            isLoggedIn,
            serverInfo,
            teamData,
            loadChildren,
            jiraHelpers
        }, hooks)
    })
    
    let change;
    const assertNextChange = (fn)=> { change = fn; }
    requestData.on(function(arg){

        change();
    })

    assert.equal(requestData.value.issuesPromise, null, "no jql, no data")
    
    assertNextChange(()=> assert.equal(typeof requestData.value.issuesPromise, "object", "jql data") );
    jql.value = "Something";

    
    done();
}));

test("derivedIssuesRequestData", completeCallback( async function(assert, done){
    const rawIssuesRequestData = value.with({
        issuesPromise: Promise.resolve([{key: "TEST-123", fields: {
            
            CONFIDENCE: 20
        }}]),
        progressData: {}
    })
    const configurationPromise = value.with(null)


        
    
    const derivedIssuesData = new ResolverObservable(function(hooks){
        return derivedIssuesRequestData({
            rawIssuesRequestData,
            configurationPromise
        }, hooks)
    })
    

    assert.equal(derivedIssuesData.value.issuesPromise.__isAlwaysPending, true, "no configuration, still waiting")
    
    configurationPromise.value = {
        getConfidence({fields}){
            return fields.CONFIDENCE;
        }
    };
    assert.equal(derivedIssuesData.value.issuesPromise.__isAlwaysPending, undefined, "configuration means data")

    /** @type {Array<import("../shared/issue-data/issue-data.js").DerivedWorkIssue>} */
    const issues = await derivedIssuesData.value.issuesPromise;
    assert.equal(issues[0].confidence, 20, "got confidence correct")
    done();
}));




