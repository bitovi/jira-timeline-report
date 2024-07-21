// sum.test.js
import { expect, test, describe, it } from 'vitest'
import { rollupDates } from './dates.js';

describe('rollupDates', () => {
    // due, dueTo {message, reference} .... {start,startFrom}
    // alt: {start, end, startedFrom, endedBy}

    const _2000 = new Date(2000,0),
        _2001 = new Date(2001,0),
        _2002 = new Date(2002,0),
        _2003 = new Date(2003,0),
        _2004 = new Date(2004,0),
        _2005 = new Date(2005,0),
        _2006 = new Date(2006,0),
        _2007 = new Date(2007,0);

    it("childrenFirstThenParent is the default", ()=>{

        const issuesAndReleases = [
            [
                {key: "o-1", parentKey: null, derivedTiming: {}}
            ],
            [
                {key: "m-2", parentKey: "o-1", derivedTiming: {}},
                {key: "m-3", parentKey: "o-1", derivedTiming: {}}
            ],
            [
                {key: "i-4", parentKey: "m-2", derivedTiming: {start: _2000, startFrom: "2000", due: _2002}},
                {key: "i-5", parentKey: "m-2", derivedTiming: {}},
                {key: "i-6", parentKey: "m-3", derivedTiming: {}},
                {key: "i-7", parentKey: "m-3", derivedTiming: {start: _2001, due: _2003, dueTo: "2003"}}
            ]
        ].reverse()

        const results = rollupDates(issuesAndReleases, []);

        expect(results).toStrictEqual([
            {
                rollupData: [
                    {start: _2000, startFrom: "2000", due: _2002},
                    {},
                    {},
                    {start: _2001, due: _2003, dueTo: "2003"}
                ], metadata: {}
            },
            {
                rollupData: [
                    {start: _2000, startFrom: "2000", due: _2002},
                    {start: _2001, due: _2003, dueTo: "2003"}
                ], metadata: {}
            },
            {
                rollupData: [
                    {start: _2000, startFrom: "2000", due: _2003, dueTo: "2003"}
                ], metadata: {}
            },
        ]);

    });

    it("widestRange works as expected", ()=>{

        const issuesAndReleases = [
            [
                {key: "o-1", parentKey: null, derivedTiming: {start: _2003, due: _2004}}
            ],
            [
                {key: "m-2", parentKey: "o-1", derivedTiming: {start: _2000, due: _2002}},
                {key: "m-3", parentKey: "o-1", derivedTiming: {start: _2003, due: _2005}}
            ],
            [
                {key: "i-4", parentKey: "m-2", derivedTiming: {start: _2001, due: _2002}},
                {key: "i-5", parentKey: "m-2", derivedTiming: {start: _2002, due: _2003}},
                {key: "i-6", parentKey: "m-3", derivedTiming: {start: _2000, due: _2004}},
                {key: "i-7", parentKey: "m-3", derivedTiming: {start: _2001, due: _2002}}
            ]
        ].reverse()

        const results = rollupDates(issuesAndReleases, ["widestRange","widestRange","widestRange"]);

        expect(results).toStrictEqual([
            {
                rollupData: [
                    {start: _2001, due: _2002},
                    {start: _2002, due: _2003},
                    {start: _2000, due: _2004},
                    {start: _2001, due: _2002}
                ], metadata: {}
            },
            {
                rollupData: [
                    {start: _2000, due: _2003},
                    {start: _2000, due: _2005}
                ], metadata: {}
            },
            {
                rollupData: [
                    {start: _2000, due: _2005}
                ], metadata: {}
            },
        ]);

    })

    
});