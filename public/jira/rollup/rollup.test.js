// sum.test.js
import { expect, test } from 'vitest'
import { rollupGroupedHierarchy, sum } from './rollup.js'



test('rollupGroupedHierarchy', () => {

    const results = rollupGroupedHierarchy([
        [
            {key: "o-1", parentKey: null, myValue: 0.5}
        ],
        [
            {key: "m-2", parentKey: "o-1", myValue: 1},
            {key: "m-3", parentKey: "o-1", myValue: 2}
        ],
        [
            {key: "i-4", parentKey: "m-2", myValue: 4},
            {key: "i-5", parentKey: "m-2", myValue: 8},
            {key: "i-6", parentKey: "m-3", myValue: 16},
            {key: "i-7", parentKey: "m-3", myValue: 32}
        ]
    ].reverse(), {
        createRollupDataFromParentAndChild(parent, childrenRollupValues) {
            
            const childrenValue = childrenRollupValues.length ? 
                    sum( childrenRollupValues.map( child => child.sumValue ) ) : 0;
            
            const parentValue = parent.myValue;
            return {sumValue: parentValue+ childrenValue};
        }
    });

    expect(results).toStrictEqual([
        {
            rollupData: [
                {sumValue: 4}, {sumValue: 8}, {sumValue: 16}, {sumValue: 32}
            ], metadata: {}
        },
        {
            rollupData: [
                {sumValue: 13}, {sumValue: 50}
            ], metadata: {}
        },
        {
            rollupData: [
                {sumValue: 63.5}
            ], metadata: {}
        },
    ])

    
})