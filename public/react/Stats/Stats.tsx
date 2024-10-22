import type { FC } from "react";
import React, { useState, useEffect } from "react";

import type { DerivedIssue } from "../../jira/derived/derive";

import { jStat } from 'jstat';

type CanObservable<Value> = {
    value: Value;
    on: (handler: any)=> {},
    off: (handler: any) => {}
}

type RolledUpIssue = DerivedIssue & {
    completionRollup: {totalWorkingDays: number},
    historicalAdjustedEstimatedTime: Array<{historicalAdjustedEstimatedTime: number, teamName: String}>
}

type GetInnerType<T> = T extends CanObservable<infer U> ? U : never;

function round(number: any, decimals: number = 0) {
    return typeof number === "number" && !isNaN(number) ? parseFloat(number.toFixed(decimals)) : "∅"
}

function getLogNormalData(values: Array<number>) {
    const logData = values.map(Math.log);
    const logMean : number = jStat.mean(logData);
    const stdDev: number = jStat.stdev(logData, true);

    const sortedData = values.slice().sort((a, b) => a - b);
    const n = sortedData.length;
    const median = n % 2 === 0
        ? (sortedData[n / 2 - 1] + sortedData[n / 2]) / 2
        : sortedData[Math.floor(n / 2)];
    return {logMean, stdDev, median, mean: jStat.mean(values), sum: values.reduce(sumNumbers, 0)};
}
function sumNumbers(acc: number, cur: number) {
    return acc+cur;
}

function getNormalData(values: Array<number>) {
    const mean : number = jStat.mean(values);
    const stdDev: number = jStat.stdev(values, true);
    const sortedData = values.slice().sort((a, b) => a - b);
    const n = sortedData.length;
    const median = n % 2 === 0
        ? (sortedData[n / 2 - 1] + sortedData[n / 2]) / 2
        : sortedData[Math.floor(n / 2)];
    return {mean, stdDev, median, sum: values.reduce(sumNumbers, 0)};
}

const NormalDataOutput : FC<ReturnType<typeof getNormalData>> = ({mean, stdDev, median, sum}) => {
    return (
        <>
            <td className="pl-2 border-l border-black">{round( sum ) } </td>
            <td>{round( mean ) } </td>
            <td>{round(median)} </td>
            <td>{round(stdDev, 3)}</td>
        </>
    )
}

function getTeamNames(issues: Array<RolledUpIssue>) {
    const teamNames = new Set();
    for(let issue of issues) {
        for(let teamRecord of issue.historicalAdjustedEstimatedTime) {
            teamNames.add(teamRecord.teamName);
        }
    }
    return [...teamNames] as Array<string>;
}



const ConfigurationPanel: FC<{primaryIssuesOrReleasesObs: CanObservable<Array<RolledUpIssue>>}> = ({ primaryIssuesOrReleasesObs }) => {
    const issues = useCanObservable(primaryIssuesOrReleasesObs);

    const allTeamNames = getTeamNames(issues)

    return (
        <div className="">
            <div>{issues.length} items</div>
            <table className="w-full">
                <thead>
                <tr>
                    <th>Issue</th>
                    {allTeamNames.map( teamName => {
                        return <td key={teamName}>{teamName}</td>
                    })}
                    
                </tr>
                </thead>
                <tbody>
            {issues.map( (issue) => {
                return <tr className="my-3 text-lg" key={issue.key}>
                    <td>{issue.summary}</td>
                    {allTeamNames.map( teamName => {
                        return <td key={issue.key+"/"+teamName}>num</td>
                    })}

                </tr>
            })}
                </tbody>
            </table>
        </div>
    );
};


function useCanObservable<T>(observable: CanObservable<T>) {
    
    const [value, setValue] = useState<T>(observable.value);

    useEffect(() => {
        const handler = ({value}: {value: T}) => {
            setValue(value);
        };

        observable.on(handler);

        // Cleanup on unmount.
        return () => {
            observable.off(handler);
        };
    }, [observable]);


    return value;
}

function calculateBusinessDays(ranges: Array<{startDate: Date | null, dueDate: Date | null}>) {
    const businessDays = new Set(); // Use a Set to ensure unique business days
  
    ranges.forEach(({ startDate, dueDate }) => {
        if(!startDate || !dueDate) {
            return;
        }
        let current = new Date(startDate);

        while (current <= dueDate) {
            const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday

            // Only add weekdays (Monday to Friday)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                businessDays.add(current.toDateString());
            }

            // Move to the next day
            current.setDate(current.getDate() + 1);
        }
    });
  
    return businessDays.size; // Return the total number of unique business days
  }


export default ConfigurationPanel;