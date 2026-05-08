import React from 'react';
// @ts-expect-error react-dom types not installed; pattern used across this codebase
import { createPortal } from 'react-dom';
import { getInProgressDate } from './metrics';
import type { MetricsIssue } from './adapter';

export interface ModalIssueRow {
  key: string;
  url?: string;
  summary: string;
  type: string;
  status: string;
  statusCategory: string; // 'done' | 'indeterminate' | 'new'
  inProgressDate: string;
  doneDate: string;
  cycleTime: number | null;
  doneDateMs: number | null;
  age: number | null;
}

interface IssueDebugModalProps {
  issues: ModalIssueRow[];
  highlightKeys?: Set<string>;
  sle?: number | null;
  onClose: () => void;
}

export function buildModalRows(
  derivedIssues: { key: string; url?: string; summary: string; type: string; status?: string }[],
  metricsIssues: MetricsIssue[],
  statusCategoryMap: Map<string, string>,
  wipAgeByKey: Map<string, number>,
): ModalIssueRow[] {
  return derivedIssues.map((derived, idx) => {
    const metrics = metricsIssues[idx];
    const statusCategory = metrics.fields.resolutiondate ? 'done' : 'indeterminate';
    const inProgressDate = getInProgressDate(metrics, statusCategoryMap);
    const doneDate = metrics.fields.resolutiondate ? new Date(metrics.fields.resolutiondate) : null;
    const cycleTime =
      inProgressDate && doneDate
        ? Math.floor((doneDate.getTime() - inProgressDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : null;
    return {
      key: derived.key,
      url: derived.url,
      summary: derived.summary,
      type: derived.type,
      status: derived.status ?? '—',
      statusCategory,
      inProgressDate: inProgressDate
        ? inProgressDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '—',
      doneDate: doneDate
        ? doneDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '—',
      cycleTime,
      doneDateMs: doneDate ? doneDate.getTime() : null,
      age: wipAgeByKey.get(derived.key) ?? null,
    };
  });
}

export const IssueDebugModal: React.FC<IssueDebugModalProps> = ({ issues, highlightKeys, sle, onClose }) => {
  const isWip = issues.length > 0 && issues.every((r) => r.statusCategory === 'indeterminate');
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          border: '1px solid #d1d5db',
          width: '100%',
          maxWidth: '900px',
          maxHeight: 'calc(100vh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">
            {isWip ? 'Work in Progress' : 'Completed Issues'} ({issues.length})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-2 mr-1">
            ×
          </button>
        </div>

        <div className="overflow-auto flex-1 min-h-0">
          <table className="text-sm" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '100px' }} />
              <col /> {/* Summary: fills remaining space */}
              <col style={{ width: '80px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '120px' }} />
              {isWip ? (
                <col style={{ width: '85px' }} />
              ) : (
                <>
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '90px' }} />
                </>
              )}
            </colgroup>
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Key</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Summary</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Type</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Category</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">In Progress</th>
                {isWip ? (
                  <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Age</th>
                ) : (
                  <>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Done Date</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Cycle Time</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {issues.map((row) => {
                const exceedsSle = isWip && sle != null && row.age != null && row.age > sle;
                const isHighlighted = (highlightKeys?.has(row.key) ?? false) || exceedsSle;
                return (
                  <tr
                    key={row.key}
                    className={`border-t border-gray-100 hover:bg-gray-50 ${isHighlighted ? 'bg-red-50' : ''}`}
                  >
                    <td
                      className="px-3 py-2 font-mono whitespace-nowrap overflow-hidden"
                      style={{ textOverflow: 'ellipsis' }}
                    >
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                          {row.key}
                        </a>
                      ) : (
                        <span className="text-blue-700">{row.key}</span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 text-gray-700"
                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    >
                      {row.summary}
                    </td>
                    <td
                      className="px-3 py-2 text-gray-600 overflow-hidden"
                      style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {row.type}
                    </td>
                    <td
                      className="px-3 py-2 text-gray-600 overflow-hidden"
                      style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {row.status}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          row.statusCategory === 'done'
                            ? 'bg-green-100 text-green-700'
                            : row.statusCategory === 'indeterminate'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {row.statusCategory === 'indeterminate'
                          ? 'In Progress'
                          : row.statusCategory === 'done'
                            ? 'Done'
                            : 'To Do'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.inProgressDate}</td>
                    {isWip ? (
                      <td
                        className={`px-3 py-2 whitespace-nowrap font-medium ${exceedsSle ? 'text-red-600' : 'text-gray-800'}`}
                      >
                        {row.age !== null ? `${row.age}d` : '—'}
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.doneDate}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.cycleTime !== null ? (
                            <span className="text-gray-800">{row.cycleTime}d</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
};
