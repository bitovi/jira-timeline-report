import type { FC, ReactNode } from 'react';
import type { Report } from '../../../../jira/reports';

import React from 'react';
import Button, { IconButton } from '@atlaskit/button/new';
import CrossIcon from '@atlaskit/icon/glyph/cross';
import Modal, { ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Textfield from '@atlaskit/textfield';

import { ReportRow, useReportSearch } from '../../../components/ReportListing';
import { ValueReportForm } from './ValueReportForm';

export interface AddReportModalProps {
  isOpen: boolean;
  /** The reports offered, already filtered and ordered — see `model/selectable-reports`. */
  reports: Report[];
  /**
   * The section the add row was opened from, for the header's subhead. `undefined` at the document
   * root; `''` for a section with no title yet, which still deserves naming as a destination.
   */
  destination?: string;
  onSelect: (reportId: Report['id']) => void;
  /** Receives the expression the Value Report half built; the caller makes the node. */
  onAddValue: (expression: string) => void;
  onClose: () => void;
}

/**
 * Adds a node to a report-of-reports: either a live Jira value, or a saved report to embed.
 *
 * **One scrolling region, and it is the list.** The dialog is a fixed-height flex column: header,
 * Value Report band, the Saved Report label and its search field are all pinned, and only the rows
 * scroll under them. It used to be one scrolling body, so browsing a long list carried the search
 * field and the whole Value Report half off the top of the dialog — you could not see what you were
 * filtering with, or add a value, without scrolling back up.
 *
 * That means **not** using `ModalBody`, which is itself the scroll container. The content between
 * header and footer is a plain flex column with `min-h-0` on the parts that must be allowed to shrink,
 * and each section carries its own horizontal padding instead of inheriting one — which is also what
 * lets the Value Report band rule edge to edge.
 *
 * **Two halves with different natures, and that shows in the code.** The saved-report half is pure and
 * prop-driven — the caller supplies the already-filtered list, because every saved report is in memory
 * before React mounts. The Value Report half can't be: a work-item typeahead and a field catalog are
 * fetches no prop can supply, so it lives in `ValueReportForm` with its own tests and this file just
 * places it. Rows and search come from `components/ReportListing`, shared with the Saved Reports page.
 *
 * **Focus stays on the reports search**, as it did before the Value Report band existed: it is the
 * half with keyboard navigation (↑/↓/↵/Esc) and the one most opens are for. Tab reaches the value row.
 *
 * See spec/016-report-of-reports, spec/023-report-modal, and .../009-value-report-modal § Restructure.
 */
export const AddReportModal: FC<AddReportModalProps> = ({
  isOpen,
  reports,
  destination,
  onSelect,
  onAddValue,
  onClose,
}) => {
  const { query, setQuery, described, filtered, activeIndex, setActiveIndex, handleKeyDown } = useReportSearch(
    reports,
    { onActivate: (report) => onSelect(report.id), onEscape: onClose },
  );

  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={onClose}>
          <ModalHeader>
            <div className="flex w-full items-start justify-between gap-4">
              <div className="min-w-0">
                <ModalTitle>Add Report</ModalTitle>
                {/* The add row that opened this sits inside one specific container, and the dialog
                    covers it — so without this the destination is something you have to remember.
                    Absent at the document root, where there is no container to name. */}
                {destination !== undefined && (
                  <p className="truncate pt-1 text-sm text-neutral-300">
                    {destination ? `Adding to ${destination}` : 'Adding to an untitled section'}
                  </p>
                )}
              </div>
              {/* Cancel is at the bottom of the dialog, below a list that scrolls — which makes it the
                  hardest exit to reach from the top. */}
              <IconButton appearance="subtle" icon={CrossIcon} label="Close" onClick={onClose} />
            </div>
          </ModalHeader>

          {/* `min-h-0` is what makes the list — not the dialog — the thing that scrolls. Without it a
              flex child refuses to shrink below its content, so the column grows and the modal's own
              overflow takes over again. */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Full-bleed: the rules run the dialog's width rather than stopping at the 24px gutter the
                header and footer use, so the band reads as a band. Its padding is its own. */}
            <section className="border-y border-neutral-301 px-6 py-4">
              <SectionLabel>Value Report</SectionLabel>
              {/* The band's own label and the first input's label are both small and grey, so with no
                  gap they read as one two-line label rather than as a heading over a form. Spaced here
                  rather than on `SectionLabel`, which the Saved Report half positions differently. */}
              <div className="pt-3">
                <ValueReportForm onAdd={onAddValue} />
              </div>
            </section>

            <div className="flex items-baseline justify-between gap-4 px-6 pb-1 pt-4">
              <SectionLabel>Saved Report</SectionLabel>
              {described.length > 0 && (
                <span className="flex-none text-xs text-neutral-300">
                  {query
                    ? `${filtered.length} of ${described.length}`
                    : `${described.length} report${described.length === 1 ? '' : 's'}`}
                </span>
              )}
            </div>

            {described.length === 0 ? (
              <p className="px-6 pb-4 text-slate-500">
                No other saved reports to add. Save a report first, then compose it here.
              </p>
            ) : (
              <>
                <div className="px-6 pb-2">
                  <Textfield
                    autoFocus
                    placeholder="Search reports by name or type…"
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                {filtered.length === 0 ? (
                  <p className="px-6 pb-4 pt-2 text-center text-slate-500">
                    <strong className="block text-neutral-800">No reports match &quot;{query}&quot;</strong>
                    Try a different name, or a report type like &quot;gantt&quot; or &quot;table&quot;.
                  </p>
                ) : (
                  // `relative` so the fade can sit over the scroll area's bottom edge rather than
                  // scrolling with it, and the hairline separates the list from the footer.
                  <div className="relative min-h-0 flex-1 border-b border-neutral-301">
                    <ul data-testid="add-report-list" className="h-full overflow-y-auto px-6 py-1">
                      {filtered.map((d, index) => (
                        <li key={d.report.id}>
                          <ReportRow
                            described={d}
                            query={query}
                            isActive={index === activeIndex}
                            onMouseEnter={() => setActiveIndex(index)}
                            onSelect={() => onSelect(d.report.id)}
                          />
                        </li>
                      ))}
                    </ul>
                    {/* The surface token rather than a hard white, so the fade still disappears into
                        the dialog under a theme that isn't white. `pointer-events-none` keeps the rows
                        underneath clickable. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
                      style={{
                        background: 'linear-gradient(to bottom, transparent, var(--ds-surface-overlay, #fff))',
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <ModalFooter>
            <Button appearance="subtle" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </ModalTransition>
  );
};

/**
 * One of the dialog's two section labels. Quiet on purpose — the modal already has a title, and these
 * are labels telling two halves apart rather than a second level of shouting.
 */
const SectionLabel: FC<{ children: ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-801">{children}</h3>
);

export default AddReportModal;
