
import { expect, test } from 'vitest'
import { rollbackIssue } from './rollback.js'


export const Time = {
    _2000: new Date(2000,0),
    _2001: new Date(2001,0),
    _2002: new Date(2002,0),
    _2003: new Date(2003,0),
    _2004: new Date(2004,0),
    _2005: new Date(2005,0),
    _2006: new Date(2006,0),
    _2007: new Date(2007,0),
    oneHourAgo: new Date(new Date() - 1000*60*60)
}


// I'm not sure this is always going to do what's expected for everyone in every timezone
export function toYY_MM_DD(date){
    return date.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })
}




export function makeStartDateChangelog(from, to, when = new Date()){
    return {
        "created": when.toISOString(),
        "items": [
            {
                "field": "Start date",
                "from": toYY_MM_DD(from),
                "to": toYY_MM_DD(to),
            }
        ]
    }
};

test('start date rollback', () => {

    const exampleRawIssue = {
        "key": "STORE-8",
        "changelog": [makeStartDateChangelog(Time._2001, Time._2007)],
        "fields": {
            "Start date": toYY_MM_DD(Time._2007),
            Created: Time._2000
        }
    }

    const result = rollbackIssue(exampleRawIssue,{}, Time.oneHourAgo);


    expect(result).toStrictEqual({
        "key": "STORE-8",
        "fields": {
            "Start date": toYY_MM_DD(Time._2001),
            Created: Time._2000
        },
        rollbackMetadata: {rolledbackTo: Time.oneHourAgo}
    });

});


test('IssueParentAssociation rollback', () => {

    const exampleRawIssue = {
        "key": "STORE-8",
        "changelog": [{
            "created": new Date().toISOString(),
            items: [{
                "field": "IssueParentAssociation",
                "to": "10277",
                "toString": "IMP-143"
            }]
        }],
        "fields": {
            "Parent": {key: "IMP-1"},
            Created: Time._2000
        }
    }

    const result = rollbackIssue(exampleRawIssue,{}, Time.oneHourAgo);


    expect(result).toStrictEqual({
        "key": "STORE-8",
        "fields": {
            "Parent": {key: "IMP-143", "id": "10277"},
            Created: Time._2000
        },
        rollbackMetadata: {rolledbackTo: Time.oneHourAgo}
    });

});