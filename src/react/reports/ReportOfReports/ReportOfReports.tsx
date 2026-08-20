import type { FC } from 'react';
import type { Reports } from '../../../jira/reports';
import type {
  InlineReportNode,
  InlineValueNode,
  LayoutNode,
  LayoutPath,
  SavedReportNode,
  SectionNode,
} from './model/sections';

import React, { useCallback, useMemo } from 'react';

import { reports as REPORTS } from '../../../configuration/reports';
import { useAllReports } from '../../services/reports';
import { useReportLayout } from '../../services/report-layout';
import { appendNode, inlineValueNode, savedReportNode, sectionTitleAt, setSectionTitleAt } from './model/sections';
import { isExpressionError, parseExpression } from './model/expression';
import { derivedKindOf, issueKeyOf } from './model/accessors';
import { selectableReports } from './model/selectable-reports';
import { useInlineExpression, type InlineExpressionState } from './hooks/useInlineExpression';
import { useLatestComment } from './hooks/useLatestComment';
import { AddContentRow } from './components/AddContentRow';
import { AddReportModal } from './components/AddReportModal';
import { ChildReport } from './components/ChildReport';
import { ChildQueryGroupsProvider } from './components/ChildQueryGroups';
import { CollapseToggle } from './components/CollapseToggle';
import { DocumentEditingProvider, useDocumentEditing, useNodeRow } from './components/DocumentEditing';
import { IndentLevel } from './components/IndentLevel';
import { InlineValue } from './components/InlineValue';
import { CommentBody, CommentRow } from './components/CommentReport';
import { MissingReportNote } from './components/MissingReportNote';
import { NodeControls } from './components/NodeControls';
import { NodeRow } from './components/NodeRow';
import { SectionTitle, UNTITLED_SECTION } from './components/SectionTitle';
import type { ChildReportProps } from './components/ChildReport';

export interface ReportOfReportsProps {
  /** The saved report currently open, if any — it can't be embedded in itself. */
  currentReportId?: string | null;
  /**
   * Forwarded to every embedded {@link ChildReport}. Its own defaults (the real `routeData`,
   * registry, and loading-state hook) apply in production; tests inject fakes here.
   */
  childReportProps?: Partial<Omit<ChildReportProps, 'report' | 'inlineQuery'>>;
}

/**
 * Composes other saved reports into a single document. See spec/016-report-of-reports.
 *
 * The document tree is held by `ReportLayoutProvider` (seeded from the open saved report's
 * `sections`) and each embedded child owns its own config and fetch. Unlike every other report this
 * one takes no `*Obs` props — it has no JQL and no primary issues of its own, which is why the shell
 * passes `selfManagesData` to `ReportArea`.
 */
export const ReportOfReports: FC<ReportOfReportsProps> = (props) => (
  <DocumentEditingProvider>
    <Document {...props} />
  </DocumentEditingProvider>
);

/** The document itself, inside the editing provider so it can read where the picker was opened. */
const Document: FC<ReportOfReportsProps> = ({ currentReportId, childReportProps }) => {
  const reports = useAllReports();
  const { sections, setSections } = useReportLayout();
  const { pickerPath, closeReportPicker, hoverNode } = useDocumentEditing();

  const addableReports = useMemo(() => selectableReports(reports, currentReportId), [reports, currentReportId]);

  const handleSelect = (reportId: string) => {
    // `pickerPath` is the container the picker was opened from — `[]` for the document root, which is
    // also `appendNode`'s default. Reports are allowed at every level, so there's nothing to check.
    setSections(appendNode(sections, savedReportNode(reportId), pickerPath ?? []));
    closeReportPicker();
  };

  // The same three lines with a value node instead of a saved-report one — and deliberately **no**
  // `beginEditing`: the modal already collected the work item and the field, which is the whole point of
  // moving authoring into it. See spec/016-report-of-reports/009-value-report-modal Phase 6.
  const handleAddValue = (expression: string) => {
    setSections(appendNode(sections, inlineValueNode(expression), pickerPath ?? []));
    closeReportPicker();
  };

  // No frame of any kind: not a box per node, and not one around the whole document either. Nesting
  // is carried entirely by indent and a hairline rail from here down, so the only borders on the page
  // belong to the embedded reports themselves. See spec/016-report-of-reports/004-redesign §1.
  //
  // Nothing is hovered while the pointer is in the document but outside every row — each node's own
  // handler stops the event before it reaches this one, so this only fires in the gaps.
  return (
    /* Most embedded reports in a document ask Jira the same question — a "Q3 status" document is
       typically one JQL shown several ways — but each child runs its own complete fetch cascade, so
       N such reports hammer Jira N times and earn a 429. The provider groups the children that share
       a query and publishes the union of the fields each group needs, which is what makes their
       requests byte-identical and lets `getRawIssues` collapse them onto one. It widens only what is
       LOADED: every report still renders exactly the columns it was saved with, and still receives
       exactly the work items it would have fetched alone.
       See spec/016-report-of-reports/005-optimize/001-request-dedupe. */
    <ChildQueryGroupsProvider sections={sections} reports={reports}>
      {/* `ror-document` is a styling hook, not a layout class: fullscreen.css uses it to keep the
          document off the screen edges once `.fullish-vh`'s gutter is reclaimed. */}
      <div
        className="ror-document flex flex-col py-4"
        onMouseOver={() => hoverNode(null)}
        onMouseLeave={() => hoverNode(null)}
      >
        {sections.map((node, index) => (
          <LayoutNodeView
            key={node.id}
            node={node}
            path={[index]}
            reports={reports}
            childReportProps={childReportProps}
          />
        ))}

        <AddContentRow path={[]} />

        {/* One picker for the whole document rather than one per add row. `[]` is a valid path — the
            document root — and truthy, so "open" is `!== null`, never a truthiness test. */}
        <AddReportModal
          isOpen={pickerPath !== null}
          reports={addableReports}
          // What the add row that opened this belongs to. `undefined` at the document root, which is
          // also what a null `pickerPath` gives — the modal is closed then anyway.
          destination={pickerPath ? sectionTitleAt(sections, pickerPath) : undefined}
          onSelect={handleSelect}
          onAddValue={handleAddValue}
          onClose={closeReportPicker}
        />
      </div>
    </ChildQueryGroupsProvider>
  );
};

interface LayoutNodeViewProps {
  node: LayoutNode;
  path: LayoutPath;
  reports: Reports;
  childReportProps?: Partial<Omit<ChildReportProps, 'report' | 'inlineQuery'>>;
}

/**
 * Dispatches one document node to the view for its type. A pure dispatcher: each view runs hooks of
 * its own, which can't happen in a component that returns early per node type.
 */
const LayoutNodeView: FC<LayoutNodeViewProps> = ({ node, path, reports, childReportProps }) => {
  if (node.type === 'section') {
    return <SectionView node={node} path={path} reports={reports} childReportProps={childReportProps} />;
  }

  if (node.type === 'inline-value') {
    // Two presets of one node type, told apart by the expression's accessor — there is no second node
    // type, and nothing in the stored document distinguishes them. The branch is here rather than
    // inside `InlineValueView` for the same reason this dispatcher exists at all: the two read
    // different hooks, and a hook can't be called conditionally.
    // See spec/016-report-of-reports/007-latest-comment-report Phase 4.
    return derivedKindOf(node.params.expression) === 'latest-comment' ? (
      <LatestCommentView node={node} path={path} />
    ) : (
      <InlineValueView node={node} path={path} />
    );
  }

  if (node.type === 'saved-report') {
    return <SavedReportView node={node} path={path} reports={reports} childReportProps={childReportProps} />;
  }

  if (node.type === 'inline-report') {
    return <InlineReportView node={node} path={path} childReportProps={childReportProps} />;
  }

  return <UnknownView node={node} path={path} />;
};

/**
 * One section: a row carrying its caret, editable title, and controls, then its children and its own
 * add row indented one level beneath it.
 *
 * No `print-avoid-break` here, deliberately — a section can easily be taller than a page, and
 * `break-inside: avoid` on something page-sized is worse than nothing. It stays on the reports.
 *
 * While an "Add Report" / "Add Section" button somewhere in the document is pointed at, the section
 * that button adds into is tinted — the whole of it, so what's about to gain a node is what lights
 * up. Indent alone stops answering "where does this land?" once sections nest, and the two buttons
 * of a deep section sit a few pixels from the ones belonging to its parent. It's a background rather
 * than a border for the reason nothing else here has one: the only frames on the page belong to the
 * embedded reports (.../004-redesign §1). Nothing tints for the document root's own pair — the whole
 * page is not a highlight, and "no section lit" is exactly what adding at the top level means.
 *
 * `color-bg-section` carries the themeable section background (Theme panel → Report of Reports),
 * defaulting to white so sections still read as unframed. Every section reads the same variable, so
 * a nested one repaints its parent's color rather than showing depth — depth is the indent rails'
 * job. The add-target tint above still wins, since Tailwind's utilities layer comes after colors.css.
 * See spec/016-report-of-reports/008-theme.
 */
const SectionView: FC<LayoutNodeViewProps & { node: SectionNode }> = ({ node, path, reports, childReportProps }) => {
  const { sections, setSections } = useReportLayout();
  const { editingNodeId, beginEditing, endEditing, isCollapsed, toggleCollapsed, isAddTarget } = useDocumentEditing();
  const { hoverProps, rowProps } = useNodeRow(node, path);

  const label = node.params.title || 'section';
  const collapsed = isCollapsed(node.id);
  const count = node.children.length;
  const isTarget = isAddTarget(path);

  return (
    <section
      data-add-target={isTarget}
      className={`color-bg-section flex flex-col rounded transition-colors duration-150 ${
        isTarget ? 'bg-blue-101' : ''
      }`}
      {...hoverProps}
    >
      <NodeRow
        {...rowProps}
        caret={
          <CollapseToggle
            isCollapsed={collapsed}
            label={node.params.title || UNTITLED_SECTION}
            onToggle={() => toggleCollapsed(node.id)}
          />
        }
        controls={<NodeControls path={path} label={label} nodeId={node.id} hasChildren={count > 0} />}
      >
        <SectionTitle
          title={node.params.title}
          depth={path.length}
          isEditing={editingNodeId === node.id}
          onEdit={() => beginEditing(node.id)}
          onConfirm={(title) => {
            endEditing();
            // Just an edit to the tree — it surfaces "Save report" like any other, and saves with it.
            setSections(setSectionTitleAt(sections, path, title));
          }}
          onCancel={endEditing}
        />
      </NodeRow>
      {/* Collapsed content stays mounted and is hidden in CSS: unmounting would remount every
          ChildReport inside, and a remounted child refetches from Jira. It also lets print unhide it
          (src/css/print.css), so collapsing to tidy up doesn't silently drop content from the PDF. */}
      <div className={collapsed ? 'collapsed-content' : ''} hidden={collapsed}>
        <IndentLevel>
          {node.children.map((child, index) => (
            <LayoutNodeView
              key={child.id}
              node={child}
              path={[...path, index]}
              reports={reports}
              childReportProps={childReportProps}
            />
          ))}
          <AddContentRow path={path} label={label} isEmpty={count === 0} />
        </IndentLevel>
      </div>
    </section>
  );
};

/**
 * One embedded report: a row carrying its caret, name, and controls, then the report itself at the same
 * indent. A report is a row *plus* content, not a row — nothing sensible fits a chart into 40px.
 *
 * The caret collapses the chart and leaves the row, exactly as a section's collapses its children —
 * that's what makes a tall document skimmable, since a chart is most of what there is to scroll past.
 * A row with nothing beneath it (a value, or a report that's gone) has no caret and reserves no space
 * for one.
 *
 * Its name is read-only: it's the saved report's real name, and renaming belongs on the Saved Reports
 * page, so the row deliberately offers no hit area and no text cursor.
 *
 * `print-avoid-break` (src/css/print.css) keeps a page break from landing inside a child.
 */
const SavedReportView: FC<LayoutNodeViewProps & { node: SavedReportNode }> = ({
  node,
  path,
  reports,
  childReportProps,
}) => {
  const { isCollapsed, toggleCollapsed } = useDocumentEditing();
  const { setNodeOverrideOn } = useReportLayout();
  const { hoverProps, rowProps } = useNodeRow(node, path);

  // Keyed by node id rather than by `path`, which is a fresh array on every render and would defeat
  // ChildReport's memo — the memo that keeps a document from reconciling every embedded chart each
  // time the pointer crosses a row. See spec/016-report-of-reports/006-url-state Phase 2.
  const onParamChange = useCallback(
    (key: string, serialized: string | undefined) => setNodeOverrideOn(node.id, key, serialized),
    [setNodeOverrideOn, node.id],
  );

  const { reportId } = node.params;
  const report = reports[reportId];
  // Deliberately not "Report not found": the label names the node in every control, and two missing
  // reports have to be tellable apart.
  const label = report ? report.name : `missing report ${reportId}`;
  const collapsed = isCollapsed(node.id);

  return (
    <div
      {...hoverProps}
      {...(report
        ? { 'data-testid': 'report-card', 'data-report-name': report.name }
        : { 'data-testid': 'missing-report', 'data-report-id': reportId })}
      className="flex flex-col print-avoid-break"
    >
      <NodeRow
        {...rowProps}
        caret={
          report && (
            <CollapseToggle isCollapsed={collapsed} label={report.name} onToggle={() => toggleCollapsed(node.id)} />
          )
        }
        controls={<NodeControls path={path} label={label} nodeId={node.id} />}
      >
        <h3 className={`truncate text-base font-semibold ${report ? '' : 'text-slate-500'}`}>
          {report ? report.name : 'Report not found'}
        </h3>
      </NodeRow>
      {/* Rows sit flush against each other — they're a list. A chart is content, and needs the air.
          Collapsed, it stays mounted and hides in CSS for the reason a section's children do: a
          remounted ChildReport refetches from Jira, and print puts it back (src/css/print.css). */}
      {report ? (
        <div className={`pb-4 ${collapsed ? 'collapsed-content' : ''}`} hidden={collapsed}>
          <ChildReport
            report={report}
            overrides={node.params.overrides}
            onParamChange={onParamChange}
            {...childReportProps}
          />
        </div>
      ) : (
        <MissingReportNote reportId={reportId} />
      )}
    </div>
  );
};

/**
 * What to call an inline report on its row. It has no saved report and so no name of its own — the
 * report type is the only thing there is to say about it, and it is the thing that distinguishes the
 * two children the secondary-slot migration produces ("Gantt Chart" above "Cards").
 *
 * Read straight off the query rather than through `ChildReportConfig`, which is the child's business:
 * this is a label. Falls back the same way route-data's clamp does — an absent or unrecognized type
 * renders as the first entry in `REPORTS`, which is what the child below will actually show.
 */
const inlineReportLabel = (query: string): string => {
  const raw = new URLSearchParams(query).get('primaryReportType');

  return (REPORTS.find((report) => report.key === raw) ?? REPORTS[0]).name;
};

/**
 * One inline report: a whole report configured in the document rather than referred out to a saved
 * one. Structurally the same row-plus-content as {@link SavedReportView} — caret, name, controls,
 * then the report at the same indent — and it renders through the very same `ChildReport`.
 *
 * Two differences, both because there is no saved record behind it. Its name comes from its report
 * type rather than a report's name, and it can never be "not found", so there is no missing-report
 * branch and the caret is unconditional. Its edits are recorded straight into the node's query
 * instead of as overrides — see `setInlineReportParam`.
 *
 * The document offers no way to *create* one: the migration writes them, and they are otherwise
 * reachable only by hand-editing the `sections` param. See spec/018-card-report/alt-plan.md
 * § Accepted costs.
 */
const InlineReportView: FC<{
  node: InlineReportNode;
  path: LayoutPath;
  childReportProps?: Partial<Omit<ChildReportProps, 'report' | 'inlineQuery'>>;
}> = ({ node, path, childReportProps }) => {
  const { isCollapsed, toggleCollapsed } = useDocumentEditing();
  const { setInlineReportParamOn } = useReportLayout();
  const { hoverProps, rowProps } = useNodeRow(node, path);

  // Keyed by node id rather than by `path`, for the reason `SavedReportView`'s copy of this is:
  // a path is a fresh array every render and would defeat `ChildReport`'s memo.
  const onParamChange = useCallback(
    (key: string, serialized: string | undefined) => setInlineReportParamOn(node.id, key, serialized),
    [setInlineReportParamOn, node.id],
  );

  const label = inlineReportLabel(node.params.query);
  const collapsed = isCollapsed(node.id);

  return (
    <div {...hoverProps} data-testid="report-card" data-report-name={label} className="flex flex-col print-avoid-break">
      <NodeRow
        {...rowProps}
        caret={<CollapseToggle isCollapsed={collapsed} label={label} onToggle={() => toggleCollapsed(node.id)} />}
        controls={<NodeControls path={path} label={label} nodeId={node.id} />}
      >
        <h3 className="truncate text-base font-semibold">{label}</h3>
      </NodeRow>
      <div className={`pb-4 ${collapsed ? 'collapsed-content' : ''}`} hidden={collapsed}>
        <ChildReport inlineQuery={node.params.query} onParamChange={onParamChange} {...childReportProps} />
      </div>
    </div>
  );
};

/**
 * What a value node is called in its own controls — _"Move SUNNYSUSHI-54 Status up"_,
 * _"Delete "SUNNYSUSHI-54 Status"?"_.
 *
 * **Not the expression.** The controls used to be labelled with it, which put
 * `Delete "(issue = SUNNYSUSHI-54).status"?` in front of the user. That was defensible while the row
 * was editable and the expression was something you typed; now it is an internal storage format that
 * nothing else displays, and a confirm dialog is the worst place to leak one — see
 * .../009-value-report-modal § The node stops being editable.
 *
 * Built from the two things the user actually chose in the modal. The field name is only known once
 * the expression resolves, so an erroring or still-loading node degrades to just its work item, and one
 * with neither — a blank node from an older document — to a bare word rather than an empty label.
 */
const inlineValueLabel = (expression: string, state: InlineExpressionState): string => {
  const parsed = parseExpression(expression);
  const key = isExpressionError(parsed) ? null : issueKeyOf(parsed.jql);
  const field = state.status === 'ok' ? state.field.name : null;

  return [key, field].filter(Boolean).join(' ') || 'value';
};

/**
 * One inline value: the expression is resolved by `useInlineExpression` and handed to `InlineValue`,
 * which stays pure and renders only the row's label.
 *
 * It's content, not chrome, so nothing here is `print-hidden` (the controls hide themselves).
 * See spec/016-report-of-reports/003-self-reports.
 */
const InlineValueView: FC<{ node: InlineValueNode; path: LayoutPath }> = ({ node, path }) => {
  const { hoverProps, rowProps } = useNodeRow(node, path);
  const state = useInlineExpression(node.params.expression);

  const label = inlineValueLabel(node.params.expression, state);

  return (
    <div className="flex flex-col" {...hoverProps}>
      <NodeRow {...rowProps} controls={<NodeControls path={path} label={label} nodeId={node.id} />}>
        <InlineValue expression={node.params.expression} state={state} />
      </NodeRow>
    </div>
  );
};

/**
 * One latest-comment value: the same `inline-value` node as above, whose accessor happens to be
 * `latestComment`.
 *
 * It reads `useLatestComment` instead of `useInlineExpression` and renders a report-shaped node — a row
 * plus content beneath it — because a comment is a block of rich text rather than one value in a pill.
 * Content beneath the row means it gets a caret, per 004-redesign's rule.
 *
 * **The row is the work item key** whenever the JQL is a single equality — which is what the modal
 * writes and what practically every one of these is. `issueKeyOf` is the whole of that distinction, and
 * it is now purely about what to title the row: a hand-written query, reachable only from a document
 * saved earlier, titles itself with its JQL. The *fetch* always goes through the JQL either way.
 *
 * It's content, not chrome, so nothing here is `print-hidden` (the controls and caret hide themselves)
 * and the body stays mounted while collapsed so print can restore it.
 * See spec/016-report-of-reports/007-latest-comment-report Phase 4.
 */
const LatestCommentView: FC<{ node: InlineValueNode; path: LayoutPath }> = ({ node, path }) => {
  const { isCollapsed, toggleCollapsed } = useDocumentEditing();
  const { hoverProps, rowProps } = useNodeRow(node, path);

  // `isLatestCommentExpression` already proved this parses, so the error branch is unreachable — it's
  // here to satisfy the type rather than to handle anything.
  const parsed = parseExpression(node.params.expression);
  const jql = isExpressionError(parsed) ? '' : parsed.jql;

  const key = issueKeyOf(jql);
  const target = key ?? jql;

  // Nothing targeted yet means asking Jira nothing: a blank key leaves the JQL as `issue =`, which is
  // not a query, and a freshly created node must not fire a request that can only fail.
  const state = useLatestComment(target.trim() ? jql : '');

  const label = target || 'latest comment';
  const collapsed = isCollapsed(node.id);

  return (
    <div {...hoverProps} data-testid="latest-comment-node" className="flex flex-col print-avoid-break">
      <NodeRow
        {...rowProps}
        caret={<CollapseToggle isCollapsed={collapsed} label={label} onToggle={() => toggleCollapsed(node.id)} />}
        controls={<NodeControls path={path} label={label} nodeId={node.id} />}
      >
        <CommentRow target={target} />
      </NodeRow>
      <div className={`pb-2 ${collapsed ? 'collapsed-content' : ''}`} hidden={collapsed}>
        <CommentBody target={target} state={state} emptyNote="No updates found." testId="latest-comment" />
      </div>
    </div>
  );
};

/**
 * A node written by a newer client. It degrades to a labelled row rather than blanking the document,
 * and `parseSections` kept the original so saving writes it back untouched.
 */
const UnknownView: FC<{ node: Extract<LayoutNode, { type: 'unknown' }>; path: LayoutPath }> = ({ node, path }) => {
  const { hoverProps, rowProps } = useNodeRow(node, path);

  const originalType = node.params.originalType || 'unknown';

  return (
    <div {...hoverProps} data-testid="report-card" data-report-name="" className="flex flex-col print-avoid-break">
      <NodeRow {...rowProps} controls={<NodeControls path={path} label={originalType} nodeId={node.id} />}>
        <h3 className="truncate text-base font-semibold text-slate-500">{`Unsupported content (${originalType})`}</h3>
      </NodeRow>
    </div>
  );
};

export default ReportOfReports;
