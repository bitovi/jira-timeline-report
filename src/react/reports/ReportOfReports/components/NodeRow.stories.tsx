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

/** A top-level section: the wider top-level padding, with the caret trailing on the right. */
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

/** The section-hover tint, matching `--section-hover-color`'s default in `primitives.css`. */
const HOVER_BG = 'bg-[#F4F5F5]';

/** Which section a hovered id's tint belongs to — a report's own container, or a section's own path. */
const containerOf: Record<string, string> = { alpha: 'delivery', beta: 'q3', delivery: 'delivery', q3: 'q3' };

/**
 * A document, as the pieces assemble: a top-level card, a level-2 rail that breaks between siblings,
 * and a level-3 report, indented one step further than its section parent and carrying no rail of its
 * own. "Beta", a report hanging directly off the card (level 2, same as "Delivery"), reads at
 * "Delivery"'s own size (17px) rather than a small fixed report size — indent and size are a function
 * of level only; only weight, color, and tracking mark it as a report rather than a section.
 *
 * Hovering tints the *innermost section* the pointer is in — "alpha" (a report) tints "delivery", not
 * itself, since only a section carries the tint — and darkens that row's own title and chevron, the
 * two signals `NodeRow`/`CollapseToggle` no longer draw as a shared row background.
 * See spec/029-report-of-reports-redesign, "hover reveals the section you're in" and "indent and size
 * are driven by level, not by node kind".
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

    // Section text defaults are level-specific (Theme panel → "L1/L2/L3 Section Text"); report titles
    // share one color at every level. Full class literals, not interpolated — Tailwind's static scanner
    // only picks up complete strings in source.
    const sectionRestColor: Record<string, string> = { q3: 'text-[#002A2D]', delivery: 'text-[#00464A]' };
    const titleColor = (id: string) => (hovered === id ? 'text-[#002A2D]' : sectionRestColor[id]);
    const reportColor = (id: string) => (hovered === id ? 'text-[#002A2D]' : 'text-[#4C5B5C]');

    return (
      <div className="flex flex-col" onMouseOver={() => setHovered(null)} onMouseLeave={() => setHovered(null)}>
        <section
          className={`color-bg-section flex flex-col rounded-2xl overflow-hidden shadow-[0_1px_2px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.10)] ${
            tinted === 'q3' ? HOVER_BG : ''
          }`}
        >
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
            <div className="flex flex-col gap-[34px] pr-6 pb-[22px] pl-8">
              <div className={`pl-4 shadow-[inset_2px_0_0_#DFE2E2] ${tinted === 'delivery' ? HOVER_BG : ''}`}>
                {hoverable(
                  'delivery',
                  row(
                    'delivery',
                    <h3 className={`truncate text-[17px] font-bold ${titleColor('delivery')}`}>Delivery</h3>,
                    <CollapseToggle
                      isCollapsed={false}
                      label="Delivery"
                      onToggle={() => {}}
                      isRowActive={hovered === 'delivery'}
                    />,
                  ),
                )}
                {hoverable(
                  'alpha',
                  <div className="pl-4 mt-[10px]">
                    {row(
                      'alpha',
                      <h4 className={`truncate text-[13.5px] font-semibold tracking-[0.045em] ${reportColor('alpha')}`}>
                        Alpha
                      </h4>,
                      <CollapseToggle
                        isCollapsed={false}
                        label="Alpha"
                        onToggle={() => {}}
                        isRowActive={hovered === 'alpha'}
                      />,
                    )}
                    <div className="mt-[10px] h-16 rounded bg-neutral-20 text-sm text-slate-500 grid place-items-center">
                      the embedded report
                    </div>
                  </div>,
                )}
              </div>
              {hoverable(
                'beta',
                <div className="pl-4">
                  {row(
                    'beta',
                    <p className="flex items-baseline gap-2">
                      <span
                        className={`shrink-0 truncate text-[17px] font-semibold tracking-[0.045em] ${reportColor('beta')}`}
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
