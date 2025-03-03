import React, { useEffect, useRef } from 'react';

import {calculateReportStatuses} from "../../../../jira/rolledup/work-status/work-status";

import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { WithPercentComplete } from '../../../../jira/rollup/percent-complete/percent-complete';

type EverythingIssue = ReturnType<typeof calculateReportStatuses>[number] & DerivedIssue & WithPercentComplete;



function timingMethod(issue: EverythingIssue){
  const derivedTiming = issue.derivedTiming;
  if (!issue.team.spreadEffortAcrossDates && derivedTiming.datesDaysOfWork != null) {
    return "dates"
  } 
  // else look for estimate
  else if (derivedTiming.isStoryPointsMedianValid) {
    return "points-and-confidence"
  } else if (derivedTiming.isStoryPointsValid) {
    return "points"
  } 
  // if no estimate, look back at dates
  else if(derivedTiming.datesDaysOfWork != null) {
    return "dates"
  } else {
    return "unknown"
  }
}


interface MyDialogProps {
  /** Whether the dialog should appear open */
  isOpen: boolean;
  /** Callback fired when the dialog has closed (e.g. ESC key or close() call) */
  onClose?: () => void;
  issue: EverythingIssue;
  children: EverythingIssue[];
  allIssuesOrReleases: Array<EverythingIssue>;
}


function CalculationBox(
  {addedClasses, currentValue, oldValue, title} : 
  {addedClasses: string, currentValue: string | number, oldValue?: string | undefined | null, title: string}) {
  return <div className={"flex-col justify-items-center px-1 py-3 rounded-md border "+(addedClasses || "")}>
  <div className="text-sm font-semibold">{title}</div>
  <div className="flex justify-center gap-1 items-baseline">
    <div>{currentValue}</div>
    {oldValue !== undefined ? 
      `<div class="bg-neutral-801 rounded-sm text-xs text-white px-1">${oldValue}</div>` : ``
    }
    
  </div>
</div>
}

function percent(numerator: number, denominator: number){
  return (
    Math.round(
      (numerator * 100) /
      denominator
    ) + "%" );
}

function EquationMath({character}: {character: string}) {
  return <div className="self-center justify-self-center">{character}</div>
}
function EquationEqual() {
  return <EquationMath character="="></EquationMath>
}

function SelfCalculationBox({issue}: {issue: EverythingIssue}) {
  const issueTimingMethod = timingMethod(issue);
  return <>
  <p className="py-2">Calculation method: {issueTimingMethod}</p>
  <div className="grid gap-2" style={ {gridTemplateColumns: "repeat(5, auto)"} }>

    <CalculationBox {...{
      title: "Completed working days", 
      currentValue: Math.round(issue.derivedTiming.completedDaysOfWork), 
      //oldValue: "{{this.issue.issueLastPeriod.derivedTiming.completedDaysOfWork}}", 
      addedClasses: ""
    }}></CalculationBox>
    <EquationEqual/>
    <CalculationBox { ...{
        title: "Completed percent", 
        currentValue: percent(issue.derivedTiming.completedDaysOfWork, issue.derivedTiming.totalDaysOfWork || 0), 
        addedClasses: "border-[#F5CD47] bg-[#FFF7D6]"} }></CalculationBox>
    <div className="self-center justify-self-center">x</div>
    <CalculationBox {...{
        title: "Total working days", 
        currentValue: Math.round( issue.derivedTiming.totalDaysOfWork || 0), 
        addedClasses: "border-[#94C748] bg-[#EFFFD6]"} }></CalculationBox>


    <CalculationBox {...{
        title: "Completed percent", 
        currentValue: percent(issue.derivedTiming.completedDaysOfWork, issue.derivedTiming.totalDaysOfWork || 0), 
        addedClasses: "border-[#F5CD47] bg-[#FFF7D6]"}}></CalculationBox>
    <EquationEqual/>
    {issue.derivedTiming.datesDaysOfWork ?
      <>
        <CalculationBox { ...{
          title: "Start date – Now", 
          currentValue: issue.derivedTiming.datesCompletedDaysOfWork + " days", 
          addedClasses: ""} }></CalculationBox>
        <div className="self-center justify-self-center">÷</div>
        <CalculationBox { ... {
          title: "Start date – End date", 
          currentValue: issue.derivedTiming.datesDaysOfWork+" days", 
          addedClasses: ""} }></CalculationBox>
      </>
      :
      <div style={{gridColumn: "3 / span 3"}}>
        <CalculationBox { ... {
          title: "No Dates", 
          currentValue: "0", 
          addedClasses: ""} }></CalculationBox>
      </div>
    }

    <CalculationBox {...{
        title: "Total working days", 
        currentValue: Math.round( issue.derivedTiming.totalDaysOfWork || 0), 
        addedClasses: "border-[#94C748] bg-[#EFFFD6]"} }></CalculationBox>
    <div className="self-center">=</div>
    {(() => {
        switch (issueTimingMethod) {
          case "points-and-confidence":
            return <>
              <CalculationBox { ... {
                title: "Adjusted estimate", 
                currentValue: Math.round( issue.derivedTiming.deterministicTotalPoints), 
                addedClasses: "border-[#6CC3E0] bg-[#E7F9FF]"}}></CalculationBox>
              <div className="self-center justify-self-center">÷</div>
              <CalculationBox { ... {
                title: "Points per day per parallel track", 
                currentValue: issue.team.pointsPerDayPerTrack, 
                addedClasses: "border-[#9F8FEF] bg-[#F3F0FF]"} }></CalculationBox>
            </>;
          case "dates":
            return <>
              <CalculationBox { ... {
                title: "Start date – End date", 
                currentValue: issue.derivedTiming.datesDaysOfWork+" days", 
                addedClasses: ""} }></CalculationBox>
              <div style={{gridColumn: "4 / span 2"}}></div>
            </>;
          default:
            return <div style={{gridColumn: "3 / span 3"}}>TBD</div>;
        }
    })()}

    { issueTimingMethod === "points-and-confidence"? 
      <>
        <CalculationBox { ... {
          title: "Adjusted estimate", 
          currentValue: Math.round( issue.derivedTiming.deterministicTotalPoints), 
          addedClasses: "border-[#6CC3E0] bg-[#E7F9FF]"}}></CalculationBox>
        <div className="self-center justify-self-center">=</div>
        <CalculationBox { ... {
          title: "Median estimate", 
          currentValue: issue.derivedTiming.defaultOrStoryPointsMedian, 
          addedClasses: ""} }></CalculationBox>
        <div className="self-center justify-self-center">*</div>
        <CalculationBox { ... {
          title: "LOGNORMINV × Confidence", 
          currentValue: issue.derivedTiming.usedConfidence+"%", 
          addedClasses: ""} }></CalculationBox>
      </> : 
      <></> 
    }
    { issueTimingMethod === "points-and-confidence" ?
      <>
        <CalculationBox { ... {
          title: "Points per day per parallel track", 
          currentValue: issue.team.pointsPerDayPerTrack, 
          addedClasses: "border-[#9F8FEF] bg-[#F3F0FF]"} }></CalculationBox>
        <div className="self-center justify-self-center">=</div>

        <div className="flex justify-evenly" style={{gridColumn: "3 / span 3"}}>
          <CalculationBox { ... {
            title: "Velocity per sprint", 
            currentValue: issue.team.velocity, 
            addedClasses: ""} }></CalculationBox>
          
          <div className="self-center justify-self-center">÷</div>
          <CalculationBox { ... {
            title: "Parallel work tracks", 
            currentValue: issue.team.parallelWorkLimit, 
            addedClasses: ""} }></CalculationBox>
          <div className="self-center justify-self-center">÷</div>
          <CalculationBox { ... {
            title: "Days per sprint", 
            currentValue: issue.team.daysPerSprint, 
            addedClasses: ""} }></CalculationBox>
        </div>
      </> : <></>
    }
  </div>
  </>
}

function getPercentComplete(issue: EverythingIssue) {
  return Math.round(
    (issue.completionRollup.completedWorkingDays * 100) /
      issue.completionRollup.totalWorkingDays
  ) + "%"
}

function SelfAndChildrenValues({issue, children}: {issue: EverythingIssue, children: EverythingIssue[]}){
  return <div className="grid gap-2" style={{gridTemplateColumns: "auto repeat(4, auto)"}}>

            <div className="font-bold">Summary</div>
            <div className="font-bold">Percent Complete</div>
            <div className="font-bold">Completed Working Days</div>
            <div className="font-bold">Remaining Working Days</div>
            <div className="font-bold">Total Working Days</div>
        
            <div className="truncate max-w-96" style={{gridRow: 2}}>{ issue.summary }</div>
            <div className="text-right" style={{gridRow: 2}}>{ getPercentComplete( issue ) }</div>
            <div className="text-right" style={{gridRow: 2}}>{Math.round( issue.completionRollup.completedWorkingDays)}</div>
            <div className="text-right" style={{gridRow: 2}}>{Math.round( issue.completionRollup.remainingWorkingDays)}</div>
            <div className="text-right" style={{gridRow: 2}}>{Math.round( issue.completionRollup.totalWorkingDays)}</div>
        
            {children.map( (child, index) => (
              <>
                <div className="pl-4 truncate max-w-96" style={{gridRow: 3 + index}}>
                  <a href={child.url} className="link">{child.summary}</a>
                </div>
                <div className="text-right" style={{gridRow: 3 + index}}>{ getPercentComplete( child ) }</div>
                <div className="text-right" style={{gridRow: 3 + index}}>{Math.round( child.completionRollup.completedWorkingDays)}</div>
                <div className="text-right" style={{gridRow: 3 + index}}>{Math.round( child.completionRollup.remainingWorkingDays)}</div>
                <div className="text-right" style={{gridRow: 3 + index}}>{Math.round( child.completionRollup.totalWorkingDays)}</div>
              </>
            ) ) }
   </div>
}

export default function PercentComplete({ isOpen, onClose, issue, children }: MyDialogProps) {
  
  const dialogRef = useRef<HTMLDialogElement>(null);
  /*
  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (!dialogNode) return;

    if (isOpen) {
      dialogNode.showModal();
    } else if (dialogNode.open) {
      dialogNode.close();
    }
  }, [isOpen]);*/

  /** Called when the native `close` event fires, e.g. ESC or programmatic close() */
  const handleCloseEvent = () => {
    onClose?.();
  };

  const issueTimingMethod = timingMethod(issue);

  return (
    <dialog ref={(element) => {
      // @ts-ignore
        dialogRef.current = element;
        element?.showModal()
      }} onClose={handleCloseEvent} className="p-4">
        
        <div className="flex justify-between gap-2 pb-2">
          <div className="text-xl font-medium">Remaining Work Calculation Summary</div>
          <button
            className="px-2"
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            X
          </button>
        </div>
        <p className="py-2 flex gap-1">{ issue.issue.fields['Issue Type']?.iconUrl ? 
            <img src={issue.issue.fields['Issue Type']?.iconUrl}/> : 
            issue.type} {issue.summary}</p>
        <p className="py-2">Calculation Source: {issue.completionRollup.source}</p>

        {
          issue.completionRollup.source === "self"?
          <SelfCalculationBox issue={issue}></SelfCalculationBox> : <></>
        }

        {
          issue.completionRollup.source === "average" /*&& !this.children.length */?
          <CalculationBox { ... {
            title: issue.type+ " average days", 
            currentValue: Math.round( issue.completionRollup.totalWorkingDays), 
            addedClasses: "border-[#94C748] bg-[#EFFFD6]"} }></CalculationBox>
          : <></>
        }

        {
          issue.completionRollup.source === "children" ?
          <SelfAndChildrenValues { ... {
            issue,
            children
          }}></SelfAndChildrenValues> : <></>
        }


      
    </dialog>
  );
}