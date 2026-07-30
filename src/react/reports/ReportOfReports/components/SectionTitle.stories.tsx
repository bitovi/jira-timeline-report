import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SectionTitle } from './SectionTitle';

const meta: Meta<typeof SectionTitle> = {
  title: 'Reports/ReportOfReports/SectionTitle',
  component: SectionTitle,
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  args: { title: 'Q3 Planning', depth: 1, isEditing: false },
};
export default meta;

type Story = StoryObj<typeof SectionTitle>;

export const ReadView: Story = {};

/** A section that hasn't been named yet — still clickable, so it can be. */
export const Untitled: Story = {
  args: { title: '' },
};

/** How a freshly added section arrives: field open and focused. */
export const Editing: Story = {
  args: { isEditing: true },
};

/** The three nesting levels together, to check the headings scale. */
export const EveryDepth: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <SectionTitle {...args} title="Level 1" depth={1} />
      <SectionTitle {...args} title="Level 2" depth={2} />
      <SectionTitle {...args} title="Level 3" depth={3} />
    </div>
  ),
};

/**
 * Wired the way a document wires it — the editing flag and the title are the caller's state, so the
 * component itself stays pure.
 */
export const Interactive: Story = {
  render: () => {
    const [title, setTitle] = useState('Q3 Planning');
    const [isEditing, setIsEditing] = useState(false);

    return (
      <SectionTitle
        title={title}
        depth={1}
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        onConfirm={(next) => {
          setIsEditing(false);
          setTitle(next);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  },
};
