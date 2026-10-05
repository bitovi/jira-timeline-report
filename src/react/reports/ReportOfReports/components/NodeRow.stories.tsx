import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ArrowUpIcon from '@atlaskit/icon/core/arrow-up';
import ArrowDownIcon from '@atlaskit/icon/core/arrow-down';
import DeleteIcon from '@atlaskit/icon/core/delete';

import { CollapseToggle } from './CollapseToggle';
import { NodeRow } from './NodeRow';
import { RowButton } from './RowButton';

/**
 * The real cluster is `NodeControls`, which reads the document tree from context. This stands in with
 * the same three buttons and the same hover gate, so the row can be reviewed on its own.
 */
const Controls = ({ isVisible }: { isVisible?: boolean }) => (
  <div className={`flex items-center transition-opacity duration-150 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    <RowButton icon={ArrowUpIcon} label="Move up" />
    <RowButton icon={ArrowDownIcon} label="Move down" disabled />
    <span aria-hidden="true" className="mx-1 h-4 w-px bg-neutral-301" />
    <RowButton icon={DeleteIcon} label="Remove" tone="danger" />
  </div>
);

const meta: Meta<typeof NodeRow> = {
  title: 'Reports/ReportOfReports/NodeRow',
  component: NodeRow,
  // Unframed, as the document itself is — the rows and their rails are the only structure there is.
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  args: {
    // A report row, which carries a caret of its own: it collapses its chart the way a section
    // collapses its children. Only a row with nothing beneath it — a value — leaves the slot out.
    caret: <CollapseToggle isCollapsed={false} label="Alpha" onToggle={() => {}} />,
    children: <h3 className="truncate text-base font-semibold">Alpha</h3>,
  },
};
export default meta;

type Story = StoryObj<typeof NodeRow>;

/** At rest: no tint, and no controls. This is what a whole document looks like between pointers. */
export const Rest: Story = {
  args: { controls: <Controls /> },
};

/**
 * Hovering no longer tints the row itself — "you're on this row" is the title/chevron darkening to
 * `#002A2D` (its caller's job, `reportTitleColorClassName`/`isRowActive`) and "you're in this section"
 * is the section's own ring, drawn on its wrapper rather than the row. See
 * spec/029-report-of-reports-redesign, "hover reveals the section you're in".
 */
export const Hovered: Story = {
  args: {
    caret: <CollapseToggle isCollapsed={false} label="Alpha" onToggle={() => {}} isRowActive />,
    children: <h3 className="truncate text-base font-semibold text-[#002A2D]">Alpha</h3>,
    controls: <Controls isVisible />,
  },
};

/** A top-level row: taller than a nested one, with the caret trailing on the right. */
export const Section: Story = {
  args: {
    caret: <CollapseToggle isCollapsed={false} label="Q3 Planning" onToggle={() => {}} isRowActive />,
    children: <h2 className="truncate text-[20px] font-bold text-[#002A2D]">Q3 Planning</h2>,
    isTopLevel: true,
    controls: <Controls isVisible />,
  },
};

/** Collapsed. The caret is the whole difference — the row is otherwise untouched. */
export const Collapsed: Story = {
  args: {
    caret: <CollapseToggle isCollapsed label="Q3 Planning" onToggle={() => {}} />,
    children: <h2 className="truncate text-[20px] font-bold text-[#002A2D]">Q3 Planning</h2>,
    isTopLevel: true,
    controls: <Controls />,
  },
};

/** A value: the one row with nothing beneath it, so the caret slot is left out entirely. */
export const Value: Story = {
  args: {
    caret: undefined,
    children: (
      <p className="flex items-baseline gap-2 text-sm">
        <span className="shrink-0 text-slate-500">Summary</span>
        <span className="truncate rounded bg-neutral-201 px-1.5 py-0.5 text-neutral-800">Migrate auth to OIDC</span>
      </p>
    ),
    controls: <Controls isVisible />,
  },
};

/** Long labels truncate rather than pushing the controls off the row. */
export const LongLabel: Story = {
  args: {
    children: (
      <h3 className="truncate text-base font-semibold">
        Q3 delivery plan for the platform migration, including every dependent team
      </h3>
    ),
    controls: <Controls isVisible />,
  },
};

/** The section-hover tint — the same themeable value `SectionView` paints. */
const HOVER_BG = 'bg-[var(--section-hover-color)]';

/**
 * Which section a hovered id's tint belongs to — the innermost section the pointer is in, which is
 * what `isContainerHovered` resolves to in the document. A report tints its container, never itself.
 */
const containerOf: Record<string, string> = {
  q3: 'q3',
  delivery: 'delivery',
  alpha: 'alpha',
  cycle: 'alpha',
  summary: 'q3',
};

/**
 * A document, as the pieces assemble. **Nothing indents at any level** — a section and a report at the
 * same level start at the same x. Hierarchy is the type scale down to L2 (20px bold over 17px light)
 * and then the L3 card: a filled panel with a left rail, the one box in the document. L1 paints a
 * background and L2 paints nothing at all, so no filled box ever nests inside another.
 *
 * "Summary", a value hanging directly off L1, is level 2 and so reads at an L2 section's own 17px —
 * size is a function of level only; weight, color, and tracking are the only things node kind changes.
 *
 * Hovering tints the *innermost section* the pointer is in — "Cycle time" (a report) tints the "Alpha"
 * card, not itself — and darkens that row's own title and chevron, the two signals `NodeRow`/
 * `CollapseToggle` no longer draw as a shared row background.
 * See spec/029-report-of-reports-redesign, "hover reveals the section you're in", and
 * `sectionAccentClassName` in `ReportOfReports.tsx` for the accent this mirrors.
 */
export const Document: Story = {
  render: () => {
    const [hovered, setHovered] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const tinted = hovered ? containerOf[hovered] : null;

    const row = (id: string, label: React.ReactNode, caret?: React.ReactNode, isTopLevel?: boolean) => (
      <NodeRow caret={caret} isTopLevel={isTopLevel} controls={<Controls isVisible={hovered === id} />}>
        {label}
      </NodeRow>
    );

    // One handler per row rather than a hover prop each: this is what `useNodeRow` does in the
    // document, minus the paths.
    const hoverable = (id: string, children: React.ReactNode) => (
      <div
        onMouseOver={(event) => {
          event.stopPropagation();
          setHovered(id);
        }}
      >
        {children}
      </div>
    );

    // Read from the theme exactly as the document reads it — section text is level-specific (Theme
    // panel → "L1/L2/L3 Section Text"), report titles share one color at every level, and hover
    // overrides both with the same darken. Full class literals, not interpolated: Tailwind's static
    // scanner only picks up complete strings in source.
    const sectionRestColor: Record<string, string> = {
      q3: 'text-[var(--section-l1-text-color)]',
      delivery: 'text-[var(--section-l2-text-color)]',
      alpha: 'text-[var(--section-l3-text-color)]',
    };
    const titleColor = (id: string) => (hovered === id ? 'text-[#002A2D]' : sectionRestColor[id]);
    const reportColor = (id: string) => (hovered === id ? 'text-[#002A2D]' : 'text-[var(--report-title-text-color)]');

    return (
      // `px-4` stands in for the page gutter the document sits in (`#react-report-container` plus
      // `.fullish-vh`): L1's `-mx-4` bleeds its paint into it, and with no gutter here the card would
      // hang off the decorator's edge rather than widening inside it.
      <div
        className="flex flex-col gap-5 px-4"
        onMouseOver={() => setHovered(null)}
        onMouseLeave={() => setHovered(null)}
      >
        {/* L1: no box. A painted background whose `-mx-4 px-4` cancel out — they widen the paint 16px
            each way so it doesn't stop dead at the text, and indent nothing. */}
        <section className={`color-bg-section flex flex-col rounded -mx-4 px-4 ${tinted === 'q3' ? HOVER_BG : ''}`}>
          {hoverable(
            'q3',
            row(
              'q3',
              <h2 className={`truncate text-[20px] font-bold ${titleColor('q3')}`}>Q3 Planning</h2>,
              <CollapseToggle
                isCollapsed={collapsed}
                label="Q3 Planning"
                onToggle={() => setCollapsed(!collapsed)}
                isRowActive={hovered === 'q3'}
              />,
              true,
            ),
          )}
          {!collapsed && (
            <div className="flex flex-col gap-[22px] pb-3">
              {/* L2: no accent of any kind — `font-light` at 17px is the whole of it, so it doesn't
                  compete with the bold levels above and below. */}
              <section className={`flex flex-col ${tinted === 'delivery' ? HOVER_BG : ''}`}>
                {hoverable(
                  'delivery',
                  row(
                    'delivery',
                    <h3 className={`truncate text-[17px] font-light ${titleColor('delivery')}`}>Delivery</h3>,
                    <CollapseToggle
                      isCollapsed={false}
                      label="Delivery"
                      onToggle={() => {}}
                      isRowActive={hovered === 'delivery'}
                    />,
                  ),
                )}
                <div className="flex flex-col">
                  {/* L3: the card. Its `px-5` is the only horizontal offset in the document, and it
                      offsets the row and its content alike. The rail is an inset shadow so it takes
                      no layout space. */}
                  <section
                    className={`mt-[10px] flex flex-col rounded px-5 py-3 bg-[var(--section-card-color)] shadow-[inset_3px_0_0_var(--section-border-color)] ${
                      tinted === 'alpha' ? HOVER_BG : ''
                    }`}
                  >
                    {hoverable(
                      'alpha',
                      row(
                        'alpha',
                        <h4 className={`truncate text-[13.5px] font-bold ${titleColor('alpha')}`}>Alpha</h4>,
                        <CollapseToggle
                          isCollapsed={false}
                          label="Alpha"
                          onToggle={() => {}}
                          isRowActive={hovered === 'alpha'}
                        />,
                      ),
                    )}
                    <div className="flex flex-col">
                      {hoverable(
                        'cycle',
                        <div className="mt-[10px] flex flex-col">
                          {row(
                            'cycle',
                            <h3
                              className={`truncate text-[12.5px] font-semibold tracking-[0.045em] ${reportColor('cycle')}`}
                            >
                              Cycle time
                            </h3>,
                            <CollapseToggle
                              isCollapsed={false}
                              label="Cycle time"
                              onToggle={() => {}}
                              isRowActive={hovered === 'cycle'}
                            />,
                          )}
                          {/* Rows sit flush — they're a list. A chart is content and needs the air. */}
                          <div className="pb-4">
                            <div className="h-16 rounded bg-neutral-20 text-sm text-slate-500 grid place-items-center">
                              the embedded report
                            </div>
                          </div>
                        </div>,
                      )}
                    </div>
                  </section>
                </div>
              </section>
              {hoverable(
                'summary',
                <div className="flex flex-col">
                  {row(
                    'summary',
                    <p className="flex items-baseline gap-2">
                      <span
                        className={`shrink-0 truncate text-[17px] font-semibold tracking-[0.045em] ${reportColor('summary')}`}
                      >
                        Summary
                      </span>
                      <span className="truncate rounded bg-neutral-201 px-1.5 py-0.5 text-sm text-neutral-800">
                        Migrate auth to OIDC
                      </span>
                    </p>,
                  )}
                </div>,
              )}
            </div>
          )}
        </section>
      </div>
    );
  },
};
