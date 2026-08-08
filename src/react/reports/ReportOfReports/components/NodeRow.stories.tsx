import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ArrowUpIcon from '@atlaskit/icon/core/arrow-up';
import ArrowDownIcon from '@atlaskit/icon/core/arrow-down';
import DeleteIcon from '@atlaskit/icon/core/delete';

import { CollapseToggle } from './CollapseToggle';
import { IndentLevel } from './IndentLevel';
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

export const Hovered: Story = {
  args: { isHovered: true, controls: <Controls isVisible /> },
};

/** Pinned by a click — the design's "selected". The touch and keyboard path to the controls. */
export const Pinned: Story = {
  args: { isPinned: true, controls: <Controls isVisible /> },
};

/** A section: the caret is the only thing that occupies the leading slot. */
export const Section: Story = {
  args: {
    caret: <CollapseToggle isCollapsed={false} label="Q3 Planning" onToggle={() => {}} />,
    children: <h2 className="truncate text-lg font-bold">Q3 Planning</h2>,
    isHovered: true,
    controls: <Controls isVisible />,
  },
};

/** Collapsed. The caret is the whole difference — the row is otherwise untouched. */
export const Collapsed: Story = {
  args: {
    caret: <CollapseToggle isCollapsed label="Q3 Planning" onToggle={() => {}} />,
    children: <h2 className="truncate text-lg font-bold">Q3 Planning</h2>,
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
    isHovered: true,
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
    isHovered: true,
    controls: <Controls isVisible />,
  },
};

/**
 * A document, as the pieces assemble: rows at three depths, each nested level drawing its own rail.
 * Hovering a row is the whole interaction — the pointer state is the caller's, as in the real
 * document.
 */
export const Document: Story = {
  render: () => {
    const [hovered, setHovered] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    const row = (id: string, label: React.ReactNode, caret?: React.ReactNode) => (
      <NodeRow
        caret={caret}
        isHovered={hovered === id}
        isPinned={id === 'beta' && hovered === null}
        controls={<Controls isVisible={hovered === id || (id === 'beta' && hovered === null)} />}
      >
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

    return (
      <div className="flex flex-col" onMouseOver={() => setHovered(null)} onMouseLeave={() => setHovered(null)}>
        {hoverable(
          'q3',
          <>
            {row(
              'q3',
              <h2 className="truncate text-lg font-bold">Q3 Planning</h2>,
              <CollapseToggle isCollapsed={collapsed} label="Q3 Planning" onToggle={() => setCollapsed(!collapsed)} />,
            )}
            {!collapsed && (
              <IndentLevel>
                {hoverable(
                  'delivery',
                  <>
                    {row(
                      'delivery',
                      <h3 className="truncate text-base font-semibold">Delivery</h3>,
                      <CollapseToggle isCollapsed={false} label="Delivery" onToggle={() => {}} />,
                    )}
                    <IndentLevel>
                      {hoverable(
                        'alpha',
                        <>
                          {row(
                            'alpha',
                            <h3 className="truncate text-base font-semibold">Alpha</h3>,
                            <CollapseToggle isCollapsed={false} label="Alpha" onToggle={() => {}} />,
                          )}
                          <div className="h-16 rounded bg-neutral-20 text-sm text-slate-500 grid place-items-center">
                            the embedded report
                          </div>
                        </>,
                      )}
                    </IndentLevel>
                  </>,
                )}
                {hoverable(
                  'beta',
                  row(
                    'beta',
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="shrink-0 text-slate-500">Summary</span>
                      <span className="truncate rounded bg-neutral-201 px-1.5 py-0.5 text-neutral-800">
                        Migrate auth to OIDC
                      </span>
                    </p>,
                  ),
                )}
              </IndentLevel>
            )}
          </>,
        )}
      </div>
    );
  },
};
