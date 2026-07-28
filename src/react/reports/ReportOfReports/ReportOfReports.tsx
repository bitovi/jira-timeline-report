import type { FC } from 'react';
import type { Reports } from '../../../jira/reports';
import type { LayoutNode, LayoutPath, SectionNode } from './model/sections';

import React, { useMemo } from 'react';

import { useAllReports } from '../../services/reports';
import { useReportLayout } from '../../services/report-layout';
import { appendNode, savedReportNode, setSectionTitleAt } from './model/sections';
import { selectableReports } from './model/selectable-reports';
import { AddContentRow } from './components/AddContentRow';
import { AddReportModal } from './components/AddReportModal';
import { ChildReport } from './components/ChildReport';
import { DocumentEditingProvider, useDocumentEditing } from './components/DocumentEditing';
import { MissingReportCard } from './components/MissingReportCard';
import { NodeControls } from './components/NodeControls';
import { SectionTitle } from './components/SectionTitle';
import type { ChildReportProps } from './components/ChildReport';

export interface ReportOfReportsProps {
  /** The saved report currently open, if any — it can't be embedded in itself. */
  currentReportId?: string | null;
  /**
   * Forwarded to every embedded {@link ChildReport}. Its own defaults (the real `routeData`,
   * registry, and loading-state hook) apply in production; tests inject fakes here.
   */
  childReportProps?: Partial<Omit<ChildReportProps, 'report'>>;
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
  const { pickerPath, closeReportPicker } = useDocumentEditing();

  const addableReports = useMemo(() => selectableReports(reports, currentReportId), [reports, currentReportId]);

  const handleSelect = (reportId: string) => {
    // `pickerPath` is the container the picker was opened from — `[]` for the document root, which is
    // also `appendNode`'s default. Reports are allowed at every level, so there's nothing to check.
    setSections(appendNode(sections, savedReportNode(reportId), pickerPath ?? []));
    closeReportPicker();
  };

  return (
    <div className="flex flex-col gap-4 py-4">
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
        onSelect={handleSelect}
        onClose={closeReportPicker}
      />
    </div>
  );
};

interface LayoutNodeViewProps {
  node: LayoutNode;
  path: LayoutPath;
  reports: Reports;
  childReportProps?: Partial<Omit<ChildReportProps, 'report'>>;
}

/** Renders one document node, with its own reorder / remove controls. */
const LayoutNodeView: FC<LayoutNodeViewProps> = ({ node, path, reports, childReportProps }) => {
  if (node.type === 'section') {
    return <SectionView node={node} path={path} reports={reports} childReportProps={childReportProps} />;
  }

  if (node.type === 'saved-report') {
    const { reportId } = node.params;
    const report = reports[reportId];

    if (!report) {
      return (
        <MissingReportCard
          reportId={reportId}
          controls={<NodeControls path={path} label={`missing report ${reportId}`} />}
        />
      );
    }

    return (
      <Card name={report.name} title={report.name} controls={<NodeControls path={path} label={report.name} />}>
        <ChildReport report={report} {...childReportProps} />
      </Card>
    );
  }

  // A node written by a newer client. It degrades to a labelled placeholder rather than blanking
  // the document, and `parseSections` kept the original so saving writes it back untouched.
  const originalType = node.params.originalType || 'unknown';

  return (
    <Card
      name=""
      title={`Unsupported content (${originalType})`}
      controls={<NodeControls path={path} label={originalType} />}
    />
  );
};

/**
 * One section: its editable title, its children, and its own add row.
 *
 * A component of its own rather than a branch of `LayoutNodeView`, because hooks have to run
 * unconditionally and `LayoutNodeView` returns early per node type.
 *
 * No `print-avoid-break` here, deliberately — a section can easily be taller than a page, and
 * `break-inside: avoid` on something page-sized is worse than nothing. It stays on the cards.
 */
const SectionView: FC<LayoutNodeViewProps & { node: SectionNode }> = ({ node, path, reports, childReportProps }) => {
  const { sections, setSections } = useReportLayout();
  const { editingSectionId, beginEditingSection, endEditingSection } = useDocumentEditing();

  // A box rather than a left rule, because the section's own add row sits inside it: the border is
  // what shows which container a new report or section is about to land in. Only from depth 2 down —
  // a top-level section has nothing to sit inside, and boxing it would just frame the whole document.
  const nesting = path.length > 1 ? ' border border-neutral-301 rounded p-4' : '';

  return (
    <section className={`flex flex-col gap-4${nesting}`}>
      <div className="flex items-start gap-4">
        <SectionTitle
          title={node.params.title}
          depth={path.length}
          isEditing={editingSectionId === node.id}
          onEdit={() => beginEditingSection(node.id)}
          onConfirm={(title) => {
            endEditingSection();
            // Just an edit to the tree — it surfaces "Save report" like any other, and saves with it.
            setSections(setSectionTitleAt(sections, path, title));
          }}
          onCancel={endEditingSection}
        />
        <NodeControls path={path} label={node.params.title || 'section'} />
      </div>
      {node.children.map((child, index) => (
        <LayoutNodeView
          key={child.id}
          node={child}
          path={[...path, index]}
          reports={reports}
          childReportProps={childReportProps}
        />
      ))}
      {/* An empty section needs no other empty state — this row *is* the affordance. */}
      <AddContentRow path={path} label={node.params.title || 'section'} />
    </section>
  );
};

interface CardProps {
  /** Identifies the card in tests; the embedded report's name. */
  name: string;
  title: string;
  controls: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * One child's frame: a header carrying its name and controls, then the report itself.
 * `print-avoid-break` (src/css/print.css) keeps a page break from landing inside a child.
 */
const Card: FC<CardProps> = ({ name, title, controls, children }) => (
  <div
    data-testid="report-card"
    data-report-name={name}
    className="border border-neutral-301 rounded p-4 print-avoid-break"
  >
    <div className="flex items-start gap-4 pb-2">
      <h3 className="text-base font-semibold">{title}</h3>
      {controls}
    </div>
    {children}
  </div>
);

export default ReportOfReports;
