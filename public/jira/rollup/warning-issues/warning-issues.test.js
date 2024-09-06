// sum.test.js
import { expect, test, describe, it } from 'vitest'
import { rollupWarningIssuesForGroupedHierarchy } from './warning-issues';



describe('rollupWarningIssuesForGroupedHierarchy', () => {
    // due, dueTo {message, reference} .... {start,startFrom}
    // alt: {start, end, startedFrom, endedBy}

    it("does the basics", ()=>{
        let i7;

        const issuesAndReleases = [
            [
                {key: "o-1", parentKey: null, labels: ["foo"]}
            ],
            [
                {key: "m-2", parentKey: "o-1", labels: ["foo"]},
                {key: "m-3", parentKey: "o-1", labels: ["foo"]}
            ],
            [
                {key: "i-4", parentKey: "m-2", labels: ["foo"]},
                {key: "i-5", parentKey: "m-2", labels: ["foo"]},
                {key: "i-6", parentKey: "m-3", labels: ["foo"]},
                i7 = {key: "i-7", parentKey: "m-3", labels: ["WARNING"],
                        reportingHierarchy: {childKeys: [], depth: 2, parentKeys: ["m-3"]}}
            ]
        ].reverse()

        const results = rollupWarningIssuesForGroupedHierarchy(issuesAndReleases);
        

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