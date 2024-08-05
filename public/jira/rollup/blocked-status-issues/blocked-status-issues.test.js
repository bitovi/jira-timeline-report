// sum.test.js
import { expect, test, describe, it } from 'vitest'
import { rollupBlockedIssuesForGroupedHierarchy } from './blocked-status-issues';



describe('rollupBlockedIssuesForGroupedHierarchy', () => {
    // due, dueTo {message, reference} .... {start,startFrom}
    // alt: {start, end, startedFrom, endedBy}

    it("does the basics", ()=>{
        let i7;

        const issuesAndReleases = [
            [
                {key: "o-1", parentKey: null, derivedStatus: {statusType: "foo"}}
            ],
            [
                {key: "m-2", parentKey: "o-1", derivedStatus: {statusType: "foo"}},
                {key: "m-3", parentKey: "o-1", derivedStatus: {statusType: "foo"}}
            ],
            [
                {key: "i-4", parentKey: "m-2", derivedStatus: {statusType: "foo"}},
                {key: "i-5", parentKey: "m-2", derivedStatus: {statusType: "foo"}},
                {key: "i-6", parentKey: "m-3", derivedStatus: {statusType: "foo"}},
                i7 = {key: "i-7", parentKey: "m-3", derivedStatus: {statusType: "blocked"},
                        reportingHierarchy: {childKeys: [], depth: 2, parentKeys: ["m-3"]}}
            ]
        ].reverse()

        const results = rollupBlockedIssuesForGroupedHierarchy(issuesAndReleases);
        

        expect(results).toStrictEqual([
            {
                rollupData: [
                    [],
                    [],
                    [],
                    [i7]
                ], metadata: {}
            },
            {
                rollupData: [
                    [],
                    [i7]
                ], metadata: {}
            },
            {
                rollupData: [
                    [i7]
                ], metadata: {}
            },
        ]);

    });

    

    
});