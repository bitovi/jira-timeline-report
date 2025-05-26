import type { DerivedIssue } from "../../../../jira/derived/derive";
import {runMonteCarlo} from "./monte-carlo";

import type {BatchDatas, BatchIssueData} from "./monte-carlo";

import type {LinkedIssue} from "./link-issues";

import {insertSortedArrayInPlace, average, mostCommonNumber, last, groupBy} from "../../../../utils/array/array-helpers";


// TODO: could this be some simple interface?
export type UncertaintyWeight = number | "average";
export type StatsUIData = ReturnType<StatsAnalyzer['dataForUI']>;
export type MinimalSimulationIssueResult = StatsUIData['endDaySimulationResult'];
export type SimulationIssueResult = StatsUIData['simulationIssueResults'][number];

type SetStateAction<T> = T | ((prevState: T) => T);
type StateSetter<T> = (action: SetStateAction<T>) => void;
// All of this is to not have to import react ... this module can be free from it ...



// React.Dispatch<React.SetStateAction<ReturnType<StatsAnalyzer['dataForUI']>>>;
type SetUIState = StateSetter<StatsUIData>;



export type SimulationData = BatchIssueData & {
    sourceIssue: DerivedIssue,
    linkedIssue: LinkedIssue
}


export type MinimalSimulationIssue = {
    linkedIssue: {
        summary: string,
        key: string
    },
    startDays: number[],
    dueDays: number[],
    daysOfWork: number[],
    trackNumbers: number[]
}

export class StatsAnalyzer {

    simulationIssues: SimulationData[];
    lastDays: number[];
    percentComplete: number;
    uncertaintyWeight: number | "average";
    setUIState: SetUIState;

    constructor({
        issues,
        uncertaintyWeight,
        setUIState
    }: {
        issues: DerivedIssue[],
        uncertaintyWeight: number | "average",
        setUIState: SetUIState
    }) {
        const {linkedIssues, runBatchAndLoop} = runMonteCarlo(issues, {
            onBatch: this.onBatch.bind(this),
            onComplete: this.onComplete.bind(this)
        });
        // initialize data for each linkedIssue
        this.simulationIssues = linkedIssues.map( (linkedIssue, i) => {
            return {
                sourceIssue: issues[i],
                linkedIssue,
                startDays: [],
                dueDays: [],
                daysOfWork: [],
                trackNumbers: []
            }
        });
        this.lastDays = [];
        this.percentComplete = 0;
        this.uncertaintyWeight = uncertaintyWeight;
        this.setUIState = setUIState;
        runBatchAndLoop();
    }
    updateUncertaintyWeight(uncertaintyWeight: number | "average"){
        
        if(this.uncertaintyWeight !== uncertaintyWeight) {
            this.uncertaintyWeight = uncertaintyWeight;
            this.setUIState(this.dataForUI());
        }
        
    }

    onBatch({batchData, percentComplete}: {batchData: BatchDatas, percentComplete: number}) {
        this.percentComplete = percentComplete;

        for( let i = 0; i < this.simulationIssues.length; i++) {
            const simulationIssue = this.simulationIssues[i];
            const batchForIssue = batchData.batchIssueData[i];
            insertSortedArrayInPlace(simulationIssue.daysOfWork, batchForIssue.daysOfWork);
            insertSortedArrayInPlace(simulationIssue.dueDays, batchForIssue.dueDays);
            insertSortedArrayInPlace(simulationIssue.startDays, batchForIssue.startDays);
            insertSortedArrayInPlace(simulationIssue.trackNumbers, batchForIssue.trackNumbers);
        }
        insertSortedArrayInPlace(this.lastDays, batchData.lastDays);
        

        this.setUIState(this.dataForUI());
    }
    onComplete(){
        this.percentComplete = 100;
        this.setUIState(this.dataForUI());
    }
    dataForUI(){

        const endDaySimulation: MinimalSimulationIssue = {
            linkedIssue: {
                summary: "Due Date",
                key: "[~DUE DATE~]"
            },
            startDays: [0],
            dueDays: this.lastDays,
            daysOfWork: [0],
            trackNumbers: [0]
        };

        // lets calculate the stats based on the uncertainty threshold
        // while we're at it, lets also get the last run data ...
        const simulationIssueResults = this.simulationIssues.map( simulationIssue => {
            return getUncertaintyThresholdData(simulationIssue, this.uncertaintyWeight);
        });

        const endDaySimulationResult = getUncertaintyThresholdData(endDaySimulation, this.uncertaintyWeight)
        

        // lets get it ready for teams ...
        const teamGroups = groupBy(simulationIssueResults, simulationIssueResult => simulationIssueResult.linkedIssue.team.name);
        const teams = Object.entries(teamGroups).map( ([teamName, simulationIssueResults]) => {
            const tracks = groupByTrack(simulationIssueResults);
            return {
                team: teamName,
                tracks: tracks
            };
        } )

        return {
            percentComplete: this.percentComplete,
            uncertaintyWeight: this.uncertaintyWeight,
            endDaySimulationResult,
            simulationIssueResults,
            teams
        }
    }
}
type MinimalSimulationIssueFields = {
    startDays: number[];
    dueDays: number[];
    daysOfWork: number[];
    trackNumbers: number[];
};



function getUncertaintyThresholdData<T extends MinimalSimulationIssueFields>(
    simulationIssue: T,
    uncertaintyWeight: UncertaintyWeight
): T & {
    startDayBottom: number;
    dueDayBottom: number;
    dueDayTop: number;
    adjustedDaysOfWork: number;
    startDateWithTimeEnoughToFinish: number;
    mostCommonTrack: number;
} {
    const startDayAverage = average(simulationIssue.startDays);
    const dueDayAverage = average(simulationIssue.dueDays);
    const length = simulationIssue.dueDays.length;

    let startDayBottom: number,
        dueDayBottom: number,
        dueDayTop: number,
        adjustedDaysOfWork: number;

    if (typeof uncertaintyWeight === "number") {
        const uncertaintyIndex = Math.min(
            Math.round((length * uncertaintyWeight) / 100),
            length - 1
        );
        const confidenceIndex = Math.max(length - 1 - uncertaintyIndex, 0);

        startDayBottom = simulationIssue.startDays[confidenceIndex];
        dueDayBottom = simulationIssue.dueDays[confidenceIndex];
        dueDayTop = simulationIssue.dueDays[uncertaintyIndex];
        adjustedDaysOfWork = simulationIssue.daysOfWork[uncertaintyIndex];
    } else {
        startDayBottom = startDayAverage;
        dueDayBottom = dueDayAverage;
        dueDayTop = dueDayAverage;
        adjustedDaysOfWork = average(simulationIssue.daysOfWork);
    }

    return {
        ...simulationIssue,
        startDayBottom,
        dueDayBottom,
        dueDayTop,
        adjustedDaysOfWork,
        startDateWithTimeEnoughToFinish: dueDayTop - adjustedDaysOfWork,
        mostCommonTrack: mostCommonNumber(simulationIssue.trackNumbers) || 0,
    };
}


function groupByTrack<T extends { mostCommonTrack: number }>(items: T[]): T[][] {
    const trackMap = new Map<number, T[]>();

    for (const item of items) {
        const track = item.mostCommonTrack;
        if (!trackMap.has(track)) {
            trackMap.set(track, []);
        }
        trackMap.get(track)!.push(item);
    }

    // Convert to an array of arrays, indexed by track number
    const maxTrack = Math.max(...trackMap.keys());
    const result: T[][] = [];

    for (let i = 0; i <= maxTrack; i++) {
        result[i] = trackMap.get(i) ?? [];
    }

    return result;
}