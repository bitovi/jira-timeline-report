import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, expect, it } from 'vitest';
import FeatureRequestModalHeader from './FeatureRequestModalHeader';
import Modal from '@atlaskit/modal-dialog';

describe('<FeatureRequestModalHeader />', () => {
  it('renders', () => {
    const mockOnClose = vi.fn();

    render(<FeatureRequestModalHeader onClose={mockOnClose} />, {
      wrapper: ({ children }) => <Modal>{children}</Modal>,
    });

    const title = screen.getByText(/feature request/i);
    expect(title).toBeInTheDocument();

    const primary = screen.getByText(/we want to support the kinds of reports you actually need/i);
    expect(primary).toBeInTheDocument();

    const secondary = screen.getByText(
      /if it helps explain the report you're after, you can upload one or more images/i,
    );
    expect(secondary).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    expect(closeButton).toBeInTheDocument();

    screen.getByRole('button', { name: /close modal/i }).click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
