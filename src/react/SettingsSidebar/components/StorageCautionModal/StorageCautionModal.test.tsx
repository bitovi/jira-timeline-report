import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StorageCautionModal from './StorageCautionModal';

const renderModal = (overrides: Partial<React.ComponentProps<typeof StorageCautionModal>> = {}) => {
  const props = {
    isOpen: true,
    title: 'Turn on Reports Storage?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    children: 'What this particular choice does.',
    ...overrides,
  };

  render(<StorageCautionModal {...props} />);

  return props;
};

describe('<StorageCautionModal />', () => {
  it('says who should be doing this and what it affects', async () => {
    renderModal();

    expect(await screen.findByText('Turn on Reports Storage?')).toBeInTheDocument();
    expect(screen.getByText('What this particular choice does.')).toBeInTheDocument();
    expect(screen.getByText(/Jira admin/)).toBeInTheDocument();
    expect(screen.getByText(/site-wide/)).toBeInTheDocument();
  });

  it('renders nothing until it is opened', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByText('Turn on Reports Storage?')).not.toBeInTheDocument();
  });

  it('reports the answer the user gave', async () => {
    const { onConfirm, onCancel } = renderModal();

    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
