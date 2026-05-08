import React, { FC, ReactNode, useRef, useMemo } from 'react';
import Range from '@atlaskit/range';
import { Label } from '@atlaskit/form';
import SelectReportType from './components/SelectReportType';
import SelectIssueType from './components/SelectIssueType';
import CompareSlider from './components/CompareSlider';
import Filters from './components/Filters';
import ViewSettings from './components/ViewSettings';
import { usePrimaryReportType } from './hooks/usePrimaryReportType';
import AutoSchedulerControls from './components/AutoSchedulerControls';
import { useRouteData } from '../hooks/useRouteData/useRouteData';
import { ChecklistDropdown } from '../reports/FlowMetrics/ChecklistDropdown';
import type { DerivedIssue } from '../../jira/derived/derive';

// Returns the number of days back that the `updated >= ...` clause covers.
// Handles both Jira relative format (-50d) and absolute format ("YYYY-MM-DD").
// Returns null if no such clause exists.
function getUpdatedDaysFromJql(jql: string): number | null {
  // Relative: updated >= -50d
  const rel = /\bupdated(?:Date)?\s*>=\s*-(\d+)d\b/i.exec(jql);
  if (rel) return parseInt(rel[1], 10);
  // Absolute: updated >= "2026-03-05"
  const abs = /\bupdated(?:Date)?\s*>=\s*["'](\d{4}-\d{2}-\d{2})["']/i.exec(jql);
  if (abs) return Math.ceil((Date.now() - new Date(abs[1]).getTime()) / 86400000);
  return null;
}

// Replaces an existing `updated >= ...` clause (relative or absolute format),
// or inserts one before ORDER BY, or appends it to the end.
// Uses Jira's relative format (-Nd) so the query stays human-readable.
function setUpdatedDateInJql(jql: string, days: number): string {
  const clause = `updated >= -${days}d`;
  // Match both -Nd and "YYYY-MM-DD" forms
  const existing = /\bupdated(?:Date)?\s*>=\s*(?:-\d+d\b|["'][^"']*["'])/i;
  if (existing.test(jql)) return jql.replace(existing, clause);
  const trimmed = jql.trim();
  const orderByMatch = /\s+order\s+by\s+/i.exec(trimmed);
  if (orderByMatch) {
    return trimmed.slice(0, orderByMatch.index) + ` AND ${clause}` + trimmed.slice(orderByMatch.index);
  }
  return trimmed ? `${trimmed} AND ${clause}` : clause;
}

// Shared logic for both cycle-time sliders. During drag, only the days route
// data key updates (keeping graphs live). On release:
//   - No updated clause in JQL → add one for the selected range.
//   - Existing clause covers fewer days than selected → expand it and refetch.
//   - Existing clause already covers the selected range → do nothing.
function useCycleTimeSlider(routeDataKey: string) {
  const [days, setDays] = useRouteData<number>(routeDataKey);
  const [jql, setJql] = useRouteData<string>('jql');
  const effectiveDays = days ?? 30;
  // Updated synchronously in handleSliderChange so handleRelease always reads
  // the correct value even before the React re-render has flushed.
  const latestDays = useRef(effectiveDays);

  const sinceDate = new Date(Date.now() - effectiveDays * 86400000);
  const sinceDateISO = [
    sinceDate.getFullYear(),
    String(sinceDate.getMonth() + 1).padStart(2, '0'),
    String(sinceDate.getDate()).padStart(2, '0'),
  ].join('-');

  const maybeExpandJql = (requestedDays: number) => {
    const currentJql = jql ?? '';
    // If updated/updatedDate appears more than once the user is likely filtering
    // between two dates — leave the query untouched.
    if ((currentJql.match(/\bupdated(?:Date)?\b/gi) ?? []).length > 1) return;
    const existingDays = getUpdatedDaysFromJql(currentJql);
    if (existingDays === null || requestedDays > existingDays) {
      setJql(setUpdatedDateInJql(currentJql, requestedDays));
    }
  };

  const handleSliderChange = (val: number) => {
    const newDays = 366 - val;
    latestDays.current = newDays;
    setDays(newDays);
  };

  const handleRelease = () => maybeExpandJql(latestDays.current);

  // Date picker commits immediately (no drag), so update JQL right away.
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    const newDays = Math.max(1, Math.min(365, Math.round((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000)));
    latestDays.current = newDays;
    setDays(newDays);
    maybeExpandJql(newDays);
  };

  return {
    effectiveDays,
    sliderVal: 366 - effectiveDays,
    sinceDateISO,
    handleSliderChange,
    handleRelease,
    handleDateChange,
  };
}

const FlowMetricsCycleTimeSlider: FC = () => {
  const { effectiveDays, sliderVal, sinceDateISO, handleSliderChange, handleRelease, handleDateChange } =
    useCycleTimeSlider('flowMetricsCycleTimeRange');
  return (
    <div className="h-[62px]" onPointerUp={handleRelease}>
      <div className="flex justify-between text-neutral-801 text-xs">
        <div>
          Cycle Time Since{' '}
          <input
            type="date"
            className="text-xs rounded bg-neutral-201 py-1 px-2 leading-3 hover:bg-neutral-301 cursor-pointer"
            value={sinceDateISO}
            onChange={handleDateChange}
          />
        </div>
        <label className="pt-1">
          <span className="font-semibold">{effectiveDays} </span>
          {effectiveDays === 1 ? 'day' : 'days'}
        </label>
      </div>
      <div className="h-8 flex items-center">
        <Range min={1} max={365} value={sliderVal} onChange={handleSliderChange} />
      </div>
    </div>
  );
};

const FlowMetricsProjectSelector: FC = () => {
  const [derivedIssues] = useRouteData<DerivedIssue[] | undefined>('derivedIssues');
  const [projectFilter, setProjectFilter] = useRouteData<string[] | undefined>('flowMetricsProjectFilter');

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    for (const issue of derivedIssues ?? []) {
      if (issue.projectKey) projects.add(issue.projectKey);
    }
    return [...projects].sort();
  }, [derivedIssues]);

  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Teams</Label>
      <ChecklistDropdown options={projectOptions} value={projectFilter} onChange={setProjectFilter} minWidth={160} />
    </div>
  );
};

const TimeInStatusCycleTimeSlider: FC = () => {
  const { effectiveDays, sliderVal, sinceDateISO, handleSliderChange, handleRelease, handleDateChange } =
    useCycleTimeSlider('timeInStatusDateRange');
  return (
    <div className="h-[62px]" onPointerUp={handleRelease}>
      <div className="flex justify-between text-neutral-801 text-xs">
        <div>
          Time in Status Since{' '}
          <input
            type="date"
            className="text-xs rounded bg-neutral-201 py-1 px-2 leading-3 hover:bg-neutral-301 cursor-pointer"
            value={sinceDateISO}
            onChange={handleDateChange}
          />
        </div>
        <label className="pt-1">
          <span className="font-semibold">{effectiveDays} </span>
          {effectiveDays === 1 ? 'day' : 'days'}
        </label>
      </div>
      <div className="h-8 flex items-center">
        <Range min={1} max={365} value={sliderVal} onChange={handleSliderChange} />
      </div>
    </div>
  );
};

const TimeInStatusProjectSelector: FC = () => {
  const [derivedIssues] = useRouteData<DerivedIssue[] | undefined>('derivedIssues');
  const [projectFilter, setProjectFilter] = useRouteData<string[] | undefined>('timeInStatusProjectFilter');

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    for (const issue of derivedIssues ?? []) {
      if (issue.projectKey) projects.add(issue.projectKey);
    }
    return [...projects].sort();
  }, [derivedIssues]);

  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Teams</Label>
      <ChecklistDropdown options={projectOptions} value={projectFilter} onChange={setProjectFilter} minWidth={160} />
    </div>
  );
};

export const ReportControlsWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      <div className="pt-1">
        <SelectReportType />
      </div>
      <div className="pt-1">
        <SelectIssueType />
      </div>
      {children}
    </>
  );
};

export const ReportControls: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  if (primaryReportType === 'estimation-progress' || primaryReportType === 'grouper') {
    return (
      <>
        <SelectReportType />
        <SelectIssueType />
      </>
    );
  }

  if (primaryReportType === 'estimate-analysis') {
    return (
      <>
        <SelectReportType />
        <SelectIssueType />
      </>
    );
  }

  if (primaryReportType === 'auto-scheduler') {
    return (
      <ReportControlsWrapper>
        <AutoSchedulerControls />
      </ReportControlsWrapper>
    );
  }

  if (primaryReportType === 'flow-metrics') {
    return (
      <>
        <div className="pt-1">
          <SelectReportType />
        </div>
        <div className="pt-1">
          <FlowMetricsProjectSelector />
        </div>
        <div className="flex-grow px-2">
          <FlowMetricsCycleTimeSlider />
        </div>
        <div className="self-end pb-1">
          <ViewSettings />
        </div>
      </>
    );
  }

  if (primaryReportType === 'time-in-status') {
    return (
      <>
        <div className="pt-1">
          <SelectReportType />
        </div>
        <div className="pt-1">
          <TimeInStatusProjectSelector />
        </div>
        <div className="flex-grow px-2">
          <TimeInStatusCycleTimeSlider />
        </div>
        <div className="self-end pb-1">
          <ViewSettings />
        </div>
      </>
    );
  }

  return (
    <ReportControlsWrapper>
      <div className="flex-grow px-2">
        <CompareSlider />
      </div>
      <div className="self-end pb-1">
        <Filters />
      </div>

      {primaryReportType !== 'table' ? (
        <div className="self-end pb-1">
          <ViewSettings />
        </div>
      ) : null}
    </ReportControlsWrapper>
  );
};

export default ReportControls;
