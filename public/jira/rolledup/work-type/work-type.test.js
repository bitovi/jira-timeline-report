// sum.test.js
import { expect, test } from "vitest";
import { rollupDatesByWorkType, rollupWorkTypeDates } from "./work-type.js";
import {
  addReportingHierarchy,
  addChildrenFromGroupedHierarchy,
} from "../../rollup/rollup";

function maintainOrderByKey(source, updated) {
  const keyToIndex = {};
  for (let i = 0; i < source.length; i++) {
    keyToIndex[source[i].key] = i;
  }
  const ordered = [];
  for (let issue of updated) {
    const index = keyToIndex[issue.key];
    if (typeof index !== "number") {
      throw "something bad";
    }
    ordered[index] = issue;
  }
  return ordered;
}

test("rollupWorkTypeDates all with dates", () => {
  const _2000 = new Date(2000, 0),
    _2001 = new Date(2001, 0),
    _2002 = new Date(2002, 0),
    _2003 = new Date(2003, 0),
    _2004 = new Date(2004, 0),
    _2005 = new Date(2005, 0),
    _2006 = new Date(2006, 0),
    _2007 = new Date(2007, 0);
  const result = rollupWorkTypeDates(
    [
      [
        {
          key: "o-1",
          parentKey: null,
          derivedTiming: { start: _2000, due: _2007 },
          derivedStatus: { workType: "dev" },
          type: "outcome",
        },
      ],
      [
        {
          key: "m-2",
          parentKey: "o-1",
          derivedTiming: { start: _2001, due: _2004 },
          derivedStatus: { workType: "dev" },
          type: "milestone",
        },
        {
          key: "m-3",
          parentKey: "o-1",
          derivedTiming: { start: _2003, due: _2007 },
          derivedStatus: { workType: "qa" },
          type: "milestone",
        },
      ],
      [
        {
          key: "i-4",
          parentKey: "m-2",
          derivedTiming: { start: _2000, due: _2002 },
          derivedStatus: { workType: "design" },
          type: "initiative",
        },
        {
          key: "i-5",
          parentKey: "m-2",
          derivedTiming: { start: _2002, due: _2004 },
          derivedStatus: { workType: "design" },
          type: "initiative",
        },
        {
          key: "i-6",
          parentKey: "m-3",
          derivedTiming: { start: _2003, due: _2004 },
          derivedStatus: { workType: "qa" },
          type: "initiative",
        },
        {
          key: "i-7",
          parentKey: "m-3",
          derivedTiming: { start: _2004, due: _2007 },
          derivedStatus: { workType: "qa" },
          type: "initiative",
        },
      ],
    ].reverse()
  );

  const prefiltered = result.map((r) => r.rollupData).reverse();

  const combinedRollupData = prefiltered.map((items) =>
    items.map((i) => i.combined)
  );

  // test an initiative
  expect(combinedRollupData[2][0]).toStrictEqual({
    design: {
      issueKeys: ["i-4"],
      start: _2000,
      due: _2002,
    },
  });

  // test an milestone

  expect(combinedRollupData[1][0]).toStrictEqual({
    design: {
      issueKeys: ["i-4", "i-5"],
      start: _2000,
      due: _2004,
    },
    dev: {
      issueKeys: ["m-2"],
      start: _2001,
      due: _2004,
    },
  });
});

test("rollupWorkTypeDates only leaf dates", () => {
  const _2000 = new Date(2000, 0),
    _2001 = new Date(2001, 0),
    _2002 = new Date(2002, 0),
    _2003 = new Date(2003, 0),
    _2004 = new Date(2004, 0),
    _2005 = new Date(2005, 0),
    _2006 = new Date(2006, 0),
    _2007 = new Date(2007, 0);
  const result = rollupWorkTypeDates(
    [
      [
        {
          key: "o-1",
          parentKey: null,
          derivedTiming: {},
          derivedStatus: { workType: "dev" },
          type: "outcome",
        },
      ],
      [
        {
          key: "m-2",
          parentKey: "o-1",
          derivedTiming: {},
          derivedStatus: { workType: "dev" },
          type: "milestone",
        },
        {
          key: "m-3",
          parentKey: "o-1",
          derivedTiming: {},
          derivedStatus: { workType: "qa" },
          type: "milestone",
        },
      ],
      [
        {
          key: "i-4",
          parentKey: "m-2",
          derivedTiming: { start: _2000, due: _2002 },
          derivedStatus: { workType: "design" },
          type: "initiative",
        },
        {
          key: "i-5",
          parentKey: "m-2",
          derivedTiming: { start: _2002, due: _2004 },
          derivedStatus: { workType: "design" },
          type: "initiative",
        },
        {
          key: "i-6",
          parentKey: "m-3",
          derivedTiming: { start: _2003, due: _2004 },
          derivedStatus: { workType: "qa" },
          type: "initiative",
        },
        {
          key: "i-7",
          parentKey: "m-3",
          derivedTiming: { start: _2004, due: _2007 },
          derivedStatus: { workType: "qa" },
          type: "initiative",
        },
      ],
    ].reverse()
  );

  const prefiltered = result.map((r) => r.rollupData).reverse();

  const combinedRollupData = prefiltered.map((items) =>
    items.map((i) => i.combined)
  );

  // test an initiative
  expect(combinedRollupData[2][0]).toStrictEqual({
    design: {
      issueKeys: ["i-4"],
      start: _2000,
      due: _2002,
    },
  });

  // test an milestone

  expect(combinedRollupData[1][0]).toStrictEqual({
    design: {
      issueKeys: ["i-4", "i-5"],
      start: _2000,
      due: _2004,
    },
  });

  expect(combinedRollupData[0][0]).toStrictEqual({
    design: {
      issueKeys: ["i-4", "i-5"],
      start: _2000,
      due: _2004,
    },
    qa: {
      issueKeys: ["i-6", "i-7"],
      start: _2003,
      due: _2007,
    },
  });
});

/*
test('rollupDatesByWorkStatus with issues', () => {
    const _2000 = new Date(2000,0),
        _2001 = new Date(2001,0),
        _2002 = new Date(2002,0),
        _2003 = new Date(2003,0),
        _2004 = new Date(2004,0),
        _2005 = new Date(2005,0),
        _2006 = new Date(2006,0),
        _2007 = new Date(2007,0);
    
    let o1, m2, m3, i4, i5, i6, i7;

    const source = [
    
        o1 = {key: "o-1", parentKey: null, rollupDates: {start: _2000, due: _2007}, derivedStatus: {workType: "dev"}, type: "outcome"},
            m2 = {key: "m-2", parentKey: "o-1", rollupDates: {start: _2001, due: _2004}, derivedStatus: {workType: "dev"}, type: "milestone"},
                i4 = {key: "i-4", parentKey: "m-2", rollupDates: {start: _2000, due: _2002}, derivedStatus: {workType: "design"}, type: "initiative"},
                i5 = {key: "i-5", parentKey: "m-2", rollupDates: {start: _2002, due: _2004}, derivedStatus: {workType: "design"}, type: "initiative"},
            m3 = {key: "m-3", parentKey: "o-1", rollupDates: {start: _2003, due: _2007}, derivedStatus: {workType: "qa"}, type: "milestone"},
                i6 = {key: "i-6", parentKey: "m-3", rollupDates: {start: _2003, due: _2004}, derivedStatus: {workType: "qa"}, type: "initiative"},
                i7 = {key: "i-7", parentKey: "m-3", rollupDates: {start: _2004, due: _2007}, derivedStatus: {workType: "qa"}, type: "initiative"}
        
    ]


    const sourceIssues = addReportingHierarchy(source, [{type: "outcome"}, {type: "milestone"},{type: "initiative"}]);
    
    const results = rollupDatesByWorkType(sourceIssues);
    const sorted = maintainOrderByKey(source, results);

    const filteredResults = sorted.map(({key, workTypeRollups})=>{
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
        //cleaned.key = key;
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
            design: {start: _2000, due: _2004}
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

    
});



test('rollupDatesByWorkStatus with release', () => {
    const _2000 = new Date(2000,0),
        _2001 = new Date(2001,0),
        _2002 = new Date(2002,0),
        _2003 = new Date(2003,0),
        _2004 = new Date(2004,0),
        _2005 = new Date(2005,0),
        _2006 = new Date(2006,0),
        _2007 = new Date(2007,0);
    
    let o1, m2, m3, i4, i5, i6, i7;

    const source = [
    
        o1 = {key: "r-1", parentKey: null, rollupDates: {start: _2000, due: _2007}, derivedStatus: {workType: "dev"}, type: "release"},
            m2 = {key: "i-2", parentKey: "r-1", rollupDates: {start: _2001, due: _2004}, derivedStatus: {workType: "dev"}, type: "initiative"},
                i4 = {key: "e-4", parentKey: "i-2", rollupDates: {start: _2000, due: _2002}, derivedStatus: {workType: "design"}, type: "epic"},
                i5 = {key: "e-5", parentKey: "i-2", rollupDates: {start: _2002, due: _2004}, derivedStatus: {workType: "design"}, type: "epic"},
            m3 = {key: "i-3", parentKey: "r-1", rollupDates: {start: _2003, due: _2007}, derivedStatus: {workType: "dev"}, type: "initiative"},
                i6 = {key: "e-6", parentKey: "i-3", rollupDates: {start: _2003, due: _2004}, derivedStatus: {workType: "qa"}, type: "epic"},
                i7 = {key: "e-7", parentKey: "i-3", rollupDates: {start: _2004, due: _2007}, derivedStatus: {workType: "qa"}, type: "epic"}
        
    ]


    const sourceIssues = addReportingHierarchy(source, [{type: "release"}, {type: "initiative"},{type: "epic"}]);
    
    const results = rollupDatesByWorkType(sourceIssues);
    const sorted = maintainOrderByKey(source, results);

    const filteredResults = sorted.map(({key, workTypeRollups})=>{
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
        //cleaned.key = key;
        return cleaned;
    });

    expect(filteredResults).toStrictEqual([
        {
            design: {start: _2000, due: _2004},
            qa: {start: _2003, due: _2007},
        },
        {
            design: {start: _2000, due: _2004}
        },
        {children: {}},
        {children: {}},
        {
            qa: {start: _2003, due: _2007},
        },
        {children: {}},
        {children: {}},
    ])

    
})*/
