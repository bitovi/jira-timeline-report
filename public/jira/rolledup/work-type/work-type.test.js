// sum.test.js
import { expect, test } from 'vitest'
import { rollupDatesByWorkStatus } from './work-type.js'



test('rollupDatesByWorkStatus', () => {
    const _2000 = new Date(2000,0),
        _2001 = new Date(2001,0),
        _2002 = new Date(2002,0),
        _2003 = new Date(2003,0),
        _2004 = new Date(2004,0),
        _2005 = new Date(2005,0),
        _2006 = new Date(2006,0),
        _2007 = new Date(2007,0);
    
    let o1, m2, m3, i4, i5, i6, i7
    const results = rollupDatesByWorkStatus([
    
        o1 = {key: "o-1", parentKey: null, rollupDates: {start: _2000, due: _2007}, derivedStatus: {workType: "dev"}},
            m2 = {key: "m-2", parentKey: "o-1", rollupDates: {start: _2001, due: _2004}, derivedStatus: {workType: "dev"}},
                i4 = {key: "i-4", parentKey: "m-2", rollupDates: {start: _2000, due: _2002}, derivedStatus: {workType: "design"}},
                i5 = {key: "i-5", parentKey: "m-2", rollupDates: {start: _2002, due: _2004}, derivedStatus: {workType: "design"}},
            m3 = {key: "m-3", parentKey: "o-1", rollupDates: {start: _2003, due: _2007}, derivedStatus: {workType: "qa"}},
                i6 = {key: "i-6", parentKey: "m-3", rollupDates: {start: _2003, due: _2004}, derivedStatus: {workType: "qa"}},
                i7 = {key: "i-7", parentKey: "m-3", rollupDates: {start: _2004, due: _2007}, derivedStatus: {workType: "qa"}}
        
    ]);
    const filteredResults = results.map(({workTypeRollups})=>{
        const cleaned = {};
        for(const prop in workTypeRollups) {
            let {start, due} = workTypeRollups[prop];
            let data = cleaned[prop] = {};
            if(start) {
                data.start = start;
            }
            if(due) {
                data.due = due;
            }
        }
        return cleaned;
    });

    expect(filteredResults).toStrictEqual([
        {
            children: {start: _2001, due: _2007},
            dev: {start: _2001, due: _2004},
            qa: {start: _2003, due: _2007 }
        },
        {
            children: {start: _2000, due: _2004},
            design: {start: _2000, due: _2004},
        },
        {children: {}},
        {children: {}},
        {
            children: {start: _2003, due: _2007},
            qa: {start: _2003, due: _2007},
        },
        {children: {}},
        {children: {}},
    ])

    
})