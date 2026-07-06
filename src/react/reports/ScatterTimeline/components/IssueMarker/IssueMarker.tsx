import React from 'react';
import type { PlottedIssue } from '../../types';

export interface IssueMarkerProps {
  item: PlottedIssue;
  /**
   * Which side of the status marker the label sits on. Defaults to `'left'` (label extends
   * leftward from the due-date point, matching the legacy layout). When the label would clip
   * off the left edge of the grid (`item.overflowsLeft`), the container passes `'right'` so
   * the label extends rightward instead — the marker itself stays on the due date.
   */
  labelSide?: 'left' | 'right';
}

/**
 * A single plotted issue: a truncated text label next to a circular status marker.
 *
 * The marker is anchored to the issue's (rounded) due date. The label flows to the left of
 * the marker by default; when `labelSide` is `'right'` it flows to the right so early-due
 * long labels don't clip off the grid's left edge.
 */
export const IssueMarker: React.FC<IssueMarkerProps> = ({ item, labelSide = 'left' }) => {
  const label = item.issue.names?.shortVersion || item.issue.summary;
  const radius = item.markerRadius;
  const diameter = radius * 2;

  // Anchor the container so the marker lands exactly on the (rounded) due date. For a
  // left-side label the container's right edge is pinned at the due date and the label
  // flows leftward; for a right-side label the container's left edge is pinned instead.
  const anchorStyle: React.CSSProperties =
    labelSide === 'left' ? { right: `${item.endPercentFromRight}%` } : { left: `${item.rightPercentEnd}%` };

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    // Vertically center the marker within its row so there's equal space above and below
    // (previously pinned at top: 4px, which left a larger gap below than above).
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 100,
    // Reserve room for the marker on whichever side it sits.
    ...(labelSide === 'left' ? { paddingRight: `${radius}px` } : { paddingLeft: `${radius}px` }),
    ...anchorStyle,
  };

  const url = item.issue.url;

  const inner = (
    <>
      <div
        className={`truncate ${item.textSize} bg-white border border-neutral-80 rounded px-0.5`}
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: item.textSize ? '260px' : '300px',
          // Pad the marker's side more so the label text doesn't slide under the dot.
          paddingLeft: labelSide === 'left' ? `${radius}px` : `${radius * 1.5}px`,
          paddingRight: labelSide === 'left' ? `${radius * 1.5}px` : `${radius}px`,
        }}
        title={label}
      >
        {label}
      </div>
      <div
        className={`${item.statusColorClass} rounded-full border border-white absolute`}
        style={{
          height: `${diameter}px`,
          width: `${diameter}px`,
          // Pin the dot to the marker side; vertically center it on the label.
          ...(labelSide === 'left' ? { right: 0 } : { left: 0 }),
          top: '50%',
          marginTop: `-${radius}px`,
          zIndex: 101,
        }}
        data-testid="status-marker"
      />
    </>
  );

  // When the issue links out to Jira, render an anchor so it opens in a new tab and supports
  // right-click / open-in-new-window. Falls back to a plain div when there's no URL.
  if (url) {
    return (
      <a
        className="release-timeline-item gap-1 no-underline text-inherit"
        style={containerStyle}
        data-label-side={labelSide}
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        {inner}
      </a>
    );
  }

  return (
    <div className="release-timeline-item gap-1" style={containerStyle} data-label-side={labelSide}>
      {inner}
    </div>
  );
};
