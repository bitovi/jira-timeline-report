
export const calculationKeysToNames = {
    parentFirstThenChildren: function(parent, child){
        return `From ${parent.type}, then ${child.plural}`
    },
    childrenOnly: function(parent, child){
        return `From ${child.plural}`
    },
    childrenFirstThenParent: function(parent, child){
        return `From ${child.plural}, then ${parent.type}`
    },
    widestRange: function(parent, child){
        return `From ${parent.type} or ${child.plural} (earliest to latest)`
    },
    parentOnly: function(parent, child){
        return `From ${parent.type}`
    }
}

export function createBaseLevels(issueHierarchy) {
    return issueHierarchy.map((issue)=> {
        return {
            type: issue.name,
            source: issue,
            plural: issue.name+"s",
            hierarchyLevel: issue.hierarchyLevel
        }
    });
}

export function calculationsForLevel(parent, child, selected, last){
    if(!last) {
        return Object.keys(calculationKeysToNames).map( calculationName => {
            return {
                parent: parent.type,
                child: child.type,
                calculation: calculationName,
                name:  calculationKeysToNames[calculationName](parent, child),
                selected: selected ? selected === calculationName : "widestRange" === calculationName
            }
        })
    } else {
        return [{
            parent: parent.type,
            child: null,
            calculation: "parentOnly",
            name:  calculationKeysToNames.parentOnly(parent),
            selected: true
        }];
    }
}

/*
return {
    child: issueTypeName, 
    parent: issueType.type, 
    calculation: calculationName, name: calculationKeysToNames[calculationName](issueType, typeToIssueType[issueTypeName]) }
*/

/**
* 
* @param {TimingCalculationsMap} issueTypeMap 
* @param {string} primaryIssueType 
* @param {Array<TimingCalculation>} timingCalculations 
* @returns 
*/
// TODO: this is a duplicate function, any change needs to find the other one
export function getTimingLevels(issueHierarchy, timingCalculations){


    const baseLevels = createBaseLevels(issueHierarchy);

    return baseLevels.map( (level, i)=> {
        const child = baseLevels[i+1];
        const isLast = i === baseLevels.length - 1;

        return {
            ...level,
            childType: child ? child.type : null,
            calculations: calculationsForLevel(level, child, timingCalculations[level.type], isLast)
        }
    });
    
}