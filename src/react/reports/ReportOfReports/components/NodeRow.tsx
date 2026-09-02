import type { FC, ReactNode } from 'react';

import React from 'react';

export interface NodeRowProps {
  /**
   * The node's id, published to the DOM so a test can hover the row a control belongs to.
   */
  nodeId?: string;
  /**
   * The row's leading caret. Only sections pass one; everything else omits it and reserves no space
   * for a control it will never have.
   */
  caret?: ReactNode;
  /** The row's label: an editable section title, a report's name, an inline value. */
  children: ReactNode;
  /** The reorder / remove cluster. It hides itself — the row only places it. */
  controls?: ReactNode;
  /**
   * A depth-1 node's own row — the card's header. Everything else (including a depth-1 report at the
   * document root) gets the nested row's tighter padding. See spec/029-report-of-reports-redesign §3.
   */
  isTopLevel?: boolean;
  /** Clicking anywhere on the row (outside `controls`/`caret`) fires this — toggling collapse. */
  onClick?: () => void;
}

/**
 * One row of the document outline: a title flush on its indent, a control cluster, and the caret last
 * and right-aligned.
 *
 * Every node in the document gets exactly one of these, and it's the whole of the node's *chrome* —
 * a report's chart and a section's children render beneath it, not inside it. Pure and prop-driven
 * like `SectionTitle` and `InlineValue`, so it stories without a document (or Jira) around it.
 * See spec/016-report-of-reports/004-redesign and spec/029-report-of-reports-redesign §3.
 *
 * The title's wrapper is `grow min-w-0` so it always fills the space the controls and caret don't
 * take — opacity, not layout, is what hides the controls at rest, so that space stays reserved and
 * nothing shifts when they fade in.
 *
 * **No background tint at rest or on hover** — "you're on this row" is carried by the title/chevron
 * darkening (their own callers own that color) and "you're in this section" by the section's own
 * background tint, not by a band behind the row. See spec/029-report-of-reports-redesign, "hover
 * reveals the section you're in".
 *
 * **The whole row toggles collapse on click** — not just the caret. `controls` and `caret` sit inside
 * their own `stopPropagation` wrapper so a click on Move Up/Down, Delete, or the caret itself doesn't
 * *also* bubble up and toggle the row (the caret's own click already does that once, on purpose; the
 * wrapper is what stops it from firing a second time via bubbling). `display: contents` on that
 * wrapper keeps it invisible to layout, so `controls` and `caret` remain direct flex children of the
 * row exactly as before.
 */
export const NodeRow: FC<NodeRowProps> = ({ nodeId, caret, children, controls, isTopLevel, onClick }) => (
  <div
    data-node-row=""
    data-node-id={nodeId}
    onClick={onClick}
    className={[
      'flex items-center rounded-lg transition-colors duration-150 cursor-pointer',
      isTopLevel ? 'gap-[10px] px-6 py-4' : 'gap-[9px] px-2 py-[5px] -ml-2',
    ].join(' ')}
  >
    <div className="min-w-0 grow">{children}</div>
    <div className="contents" onClick={(event) => event.stopPropagation()}>
      {controls}
      {caret}
    </div>
  </div>
);

/**
 * Font size for a document row's title, driven purely by level (`path.length`) — a section and a
 * report at the same level render at the identical size, per spec/029-report-of-reports-redesign
 * "indent and size are driven by level, not by node kind". Weight, color, and tracking are the only
 * things node kind is allowed to change; size never branches on it. Shared by `SectionTitle`'s
 * `headingFor` and `reportTitleClassName` below so both scales stay in lockstep by construction.
 */
export const levelFontSizeClassName = (depth: number): string => {
  if (depth <= 1) {
    return 'text-[20px]';
  }

  if (depth === 2) {
    return 'text-[17px]';
  }

  if (depth === 3) {
    return 'text-[13.5px]';
  }

  return 'text-[12.5px]';
};

/**
 * Typography for a report row's title — every embedded report, inline value, and comment row shares
 * this (spec/029-report-of-reports-redesign §4). It belongs here rather than to `SectionTitle` because
 * it's a peer of the row rather than of the heading: reports don't own a heading level.
 *
 * Size comes from `levelFontSizeClassName`, the same scale a section title at that depth uses — a
 * report one level under the top-level card reads at the card's own L2 size (17px), not a fixed small
 * size, because indent and size are level-driven, not kind-driven. The tracking is what's left to mark
 * it as a *report* rather than a section: kind may only change weight, color, and tracking. Color is
 * left to the caller, since a missing or unsupported node keeps the existing muted treatment rather
 * than this scale's grey.
 */
export const reportTitleClassName = (depth: number): string =>
  `truncate font-semibold tracking-[0.045em] ${levelFontSizeClassName(depth)}`;

/**
 * A report row's title color: the themeable `--report-title-text-color` at rest, darkened to
 * `#002A2D` while the row is hovered — the "which row you're on" signal, layered at a different scope
 * than the section's own hover background tint and the chevron's own darken. Only for a title in its
 * normal state; a caller with a more specific state (an error, a missing report) keeps its own muted
 * color instead of taking this. See spec/029-report-of-reports-redesign, "hover reveals the section
 * you're in".
 */
export const reportTitleColorClassName = (isRowHovered?: boolean): string =>
  isRowHovered ? 'text-[#002A2D]' : 'text-[var(--report-title-text-color)]';

export default NodeRow;
