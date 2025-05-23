import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, beforeEach } from 'vitest';

import SaveReportModal from './SaveReportModal';

const mockValidate = vi.fn();
const mockOnCreate = vi.fn();
const mockCloseModal = vi.fn();

describe('<SaveReportModal />', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockValidate.mockReturnValue({ isValid: true, message: '' });
  });

  beforeAll(() => {
    // @ts-expect-error
    delete window.matchMedia;
  });

  afterAll(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: vi.fn(),
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(
        <SaveReportModal
          isOpen
          closeModal={mockCloseModal}
          name="Test Report"
          onCreate={mockOnCreate}
          validate={mockValidate}
          isCreating={false}
          setName={vi.fn()}
        />,
      );
    });

    expect(screen.getByText('Save Report')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('validates the name and shows an error if invalid', async () => {
    mockValidate.mockReturnValueOnce({ isValid: false, message: 'Invalid name' });

    await act(async () => {
      render(
        <SaveReportModal
          isOpen
          closeModal={mockCloseModal}
          name="Test Report"
          onCreate={mockOnCreate}
          validate={mockValidate}
          isCreating={false}
          setName={vi.fn()}
          autoFocus={false}
        />,
      );
    });

    const input = screen.getByText('Name');
    await userEvent.type(input, '1');

    expect(mockValidate).toHaveBeenCalledWith('1');
    expect(screen.getByText('Invalid name')).toBeInTheDocument();
  });

  it('closes the modal when cancel is clicked', async () => {
    await act(async () => {
      render(
        <SaveReportModal
          isOpen
          closeModal={mockCloseModal}
          name="Test Report"
          onCreate={mockOnCreate}
          validate={mockValidate}
          isCreating={false}
          setName={vi.fn()}
        />,
      );
    });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelButton);

    expect(mockCloseModal).toHaveBeenCalled();
  });
});
