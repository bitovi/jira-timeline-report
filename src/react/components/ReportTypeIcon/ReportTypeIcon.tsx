import type { FC, ReactNode } from 'react';
import type { ReportTypeTone } from '../ReportListing/report-type-meta';

import React from 'react';

export interface ReportTypeIconProps {
  tone: ReportTypeTone;
  label?: string;
  size?: number;
}

// Tinted tile colors per tone, copied from the mockup's `:root` token values
// (spec/023-report-modal/mockups/add-report-modal.html).
const toneStyles: Record<ReportTypeTone, { background: string; color: string }> = {
  gantt: { background: '#e9f2ff', color: '#0c66e4' },
  scatter: { background: '#eceafa', color: '#6e5dc6' },
  estprogress: { background: '#fff3eb', color: '#a54800' },
  scheduler: { background: '#eceafc', color: '#4c4fce' },
  estanalysis: { background: '#fdeef6', color: '#ae4787' },
  table: { background: '#dffcf0', color: '#22a06b' },
  flow: { background: '#e3f7f9', color: '#206b74' },
  tis: { background: '#fff7d6', color: '#7f5f01' },
  cards: { background: '#e7f9fc', color: '#1d7f8c' },
  ror: { background: '#fff3eb', color: '#a54800' },
  neutral: { background: '#eef1f5', color: '#44546f' },
};

// Inline SVGs, one per tone, copied verbatim from the legend in
// spec/023-report-modal/mockups/add-report-modal.html.
const toneIcons: Record<ReportTypeTone, ReactNode> = {
  gantt: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="5" width="11" height="3" rx="1.5" />
      <rect x="7" y="10.5" width="12" height="3" rx="1.5" />
      <rect x="5" y="16" width="9" height="3" rx="1.5" />
    </svg>
  ),
  scatter: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="15" r="2" />
      <circle cx="11" cy="8" r="2" />
      <circle cx="15" cy="16" r="2" />
      <circle cx="19" cy="6" r="2" />
    </svg>
  ),
  estprogress: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="8" width="18" height="8" rx="4" stroke="currentColor" strokeWidth={2} />
      <rect x="5" y="10" width="9" height="4" rx="2" fill="currentColor" />
    </svg>
  ),
  scheduler: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="17" width="2.5" height="4" rx="0.5" />
      <rect x="6" y="12" width="2.5" height="9" rx="0.5" />
      <rect x="9" y="7" width="2.5" height="14" rx="0.5" />
      <rect x="12" y="7" width="2.5" height="14" rx="0.5" />
      <rect x="15" y="12" width="2.5" height="9" rx="0.5" />
      <rect x="18" y="17" width="2.5" height="4" rx="0.5" />
    </svg>
  ),
  estanalysis: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 20V10M9 20V6M14 20v-7" strokeLinecap="round" />
      <circle cx="17" cy="9" r="3.5" />
      <path d="M19.5 11.5L22 14" strokeLinecap="round" />
    </svg>
  ),
  table: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M10 5v14" />
    </svg>
  ),
  flow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l6 6-6 6M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  tis: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 13V9M12 13l3 2M10 2h4" strokeLinecap="round" />
    </svg>
  ),
  cards: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="5" width="7" height="7" rx="1.5" />
      <rect x="13" y="5" width="7" height="7" rx="1.5" />
      <rect x="4" y="14" width="7" height="5" rx="1.5" />
      <rect x="13" y="14" width="7" height="5" rx="1.5" />
    </svg>
  ),
  ror: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="8" y="3" width="13" height="16" rx="2" />
      <path d="M11 8h7M11 12h7M11 16h4" strokeLinecap="round" />
      <path d="M5 6v13a2 2 0 0 0 2 2h9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // Generic document — the fallback for an unrecognized report type.
  neutral: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M15 3v4h4M8 12h8M8 16h8" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * The shared tinted icon tile for a report type. The single source of truth for how a
 * `primaryReportType` looks — used by the Add Report modal, the Saved Reports page, and the
 * report-type dropdown so a type looks identical everywhere. See spec/023-report-modal.
 */
export const ReportTypeIcon: FC<ReportTypeIconProps> = ({ tone, label, size = 32 }) => {
  const iconSize = Math.round(size / 2);

  return (
    <span
      className="inline-grid flex-none place-items-center rounded-md"
      style={{ width: size, height: size, ...toneStyles[tone] }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span style={{ width: iconSize, height: iconSize }}>{toneIcons[tone]}</span>
    </span>
  );
};

export default ReportTypeIcon;
