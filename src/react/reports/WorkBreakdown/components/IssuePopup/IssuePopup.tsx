import React, { useEffect, useRef } from 'react';
import { Popper } from '@atlaskit/popper';
import type { IssueOrRelease } from '../../types';
import { buildIssuePopupViewModel, buildExploreUrl } from '../../helpers';

export interface IssuePopupProps {
  /** The issue whose rollup status/dates are shown. */
  issue: IssueOrRelease;
  /** The clicked element the popup is anchored to. */
  anchorEl: HTMLElement;
  /** Called when the popup should close (✕, Escape, or an outside click). */
  onClose: () => void;
}

/**
 * A popup showing an issue's overall rollup status/dates plus a per-work-type breakdown,
 * anchored to the clicked card/row via `@atlaskit/popper`. Replaces the legacy CanJS
 * `showTooltip` popup for the Work Breakdown report — see spec/006-work-breakdown-improvements/popup.html.
 */
export const IssuePopup: React.FC<IssuePopupProps> = ({ issue, anchorEl, onClose }) => {
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target) || anchorEl.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorEl, onClose]);

  const vm = buildIssuePopupViewModel(issue);
  const exploreUrl = buildExploreUrl(window.location.href, issue.key);
  const issueTypeLabel = issue.type?.toLowerCase() ?? 'issue';
  const hasNoRollupData = vm.workTypeRows.every((row) => !row.hasWork) && !vm.dateRangeLabel;

  return (
    <Popper referenceElement={anchorEl} placement="bottom-start">
      {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => (
        <div ref={ref} style={style} className="z-50">
          <div
            ref={popupRef}
            className="w-[360px] overflow-hidden rounded-[10px] border border-neutral-40 bg-white text-[13px] shadow-lg"
          >
            <div className={`flex items-center gap-2 px-3 py-2.5 ${vm.colorClass}`}>
              {issue.type && (
                <span className="shrink-0 rounded bg-white/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {issue.type}
                </span>
              )}
              <span className="shrink-0 text-[11px] font-semibold opacity-85">{issue.key}</span>
              {issue.url ? (
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-bold text-white no-underline hover:underline"
                >
                  {issue.summary}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{issue.summary}</span>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="h-[22px] w-[22px] shrink-0 rounded border-0 bg-white/20 leading-none text-white hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-neutral-20 bg-neutral-10 px-3 py-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${vm.colorClass}`}
              >
                {vm.statusLabel}
              </span>
              {vm.dateRangeLabel ? (
                <>
                  <span className="text-neutral-40">·</span>
                  <span className="text-xs text-neutral-300">{vm.dateRangeLabel}</span>
                </>
              ) : (
                <span className="text-xs text-neutral-300">No target dates yet</span>
              )}
              {vm.wasLabel && (
                <span
                  className={`text-[11px] font-semibold ${vm.wasKind === 'improved' ? 'color-text-ahead' : 'color-text-blocked'}`}
                >
                  {vm.wasLabel}
                </span>
              )}
            </div>

            {vm.warningMessage && (
              <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-2 py-1.5 text-xs text-orange-800">
                <span>⚠️</span>
                <span>{vm.warningMessage}</span>
              </div>
            )}

            <div className="px-1 pb-1.5 pt-1">
              {hasNoRollupData ? (
                <div className="px-2 py-3.5 text-xs text-neutral-300">
                  This {issueTypeLabel} has no children or estimates yet, so there&rsquo;s nothing to roll up.
                </div>
              ) : (
                vm.workTypeRows.map((row) =>
                  row.hasWork ? (
                    <div key={row.type} className="flex gap-2.5 border-t border-neutral-20 px-2 py-2 first:border-t-0">
                      <span
                        className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[11px] font-bold ${row.colorClass}`}
                      >
                        {row.symbol.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-neutral-800">
                            {row.label}
                          </span>
                          {row.dateRangeLabel && <span className="text-xs text-neutral-300">{row.dateRangeLabel}</span>}
                          {row.wasLabel && (
                            <span
                              className={`text-[11px] font-semibold ${row.wasKind === 'improved' ? 'color-text-ahead' : 'color-text-blocked'}`}
                            >
                              {row.wasLabel}
                            </span>
                          )}
                          <span
                            className={`ml-auto text-[11px] font-bold uppercase tracking-wide ${row.statusTextClass}`}
                          >
                            {row.statusLabel}
                          </span>
                        </div>
                        {(row.start || row.due) && (
                          <div className="mt-1.5 flex gap-2">
                            {row.start && (
                              <div className="min-w-0 flex-1 rounded-md bg-neutral-10 px-2 py-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-300">
                                  Start
                                </div>
                                <div className="my-0.5 text-xs font-bold">{row.start.date}</div>
                                {row.start.url && (
                                  <a
                                    href={row.start.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-[11.5px] text-blue-400 no-underline hover:underline"
                                  >
                                    {row.start.summary}
                                  </a>
                                )}
                                {row.start.message && (
                                  <div className="mt-0.5 font-mono text-[10.5px] text-neutral-300">
                                    {row.start.message}
                                  </div>
                                )}
                              </div>
                            )}
                            {row.due && (
                              <div className="min-w-0 flex-1 rounded-md bg-neutral-10 px-2 py-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-300">
                                  Due
                                </div>
                                <div className="my-0.5 text-xs font-bold">{row.due.date}</div>
                                {row.due.url && (
                                  <a
                                    href={row.due.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-[11.5px] text-blue-400 no-underline hover:underline"
                                  >
                                    {row.due.summary}
                                  </a>
                                )}
                                {row.due.message && (
                                  <div className="mt-0.5 font-mono text-[10.5px] text-neutral-300">
                                    {row.due.message}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={row.type} className="flex items-center gap-2.5 px-2 py-2 text-xs text-neutral-300">
                      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border border-dashed border-neutral-40 text-[11px] font-bold text-neutral-40">
                        {row.symbol.toUpperCase()}
                      </span>
                      <span>
                        No {row.label} work on this {issueTypeLabel}
                      </span>
                    </div>
                  ),
                )
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-neutral-20 bg-neutral-10 px-3 py-2">
              {issue.url ? (
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-400 no-underline hover:underline"
                >
                  Open in Jira ↗
                </a>
              ) : (
                <span />
              )}
              <a href={exploreUrl} className="text-xs font-semibold text-blue-400 no-underline hover:underline">
                Explore children →
              </a>
            </div>
          </div>
        </div>
      )}
    </Popper>
  );
};
