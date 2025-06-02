import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, expect, it } from 'vitest';

import FeatureRequestForm from './FeatureRequestForm';
import { FlagsProvider } from '@atlaskit/flag';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';

describe('<FeatureRequestForm />', () => {
  it('renders', () => {
    const mockOnCancel = vi.fn();
    const mockOnSubmit = vi.fn();
    const client = new QueryClient();

    render(<FeatureRequestForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
      wrapper: ({ children }) => (
        <FlagsProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </FlagsProvider>
      ),
    });

    const emailLabel = screen.getByLabelText(/if you're open to follow-up questions, what's your email\?/i);
    expect(emailLabel).toBeInTheDocument();

    const descriptionLabel = screen.getByLabelText(/what are you trying to report on\?/i);
    expect(descriptionLabel).toBeInTheDocument();

    const dropzoneLabel = screen.getByLabelText(/Drag and drop files or click to upload/i);
    expect(dropzoneLabel).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();
  });

  describe('FeatureRequestForm Component', () => {
    it('calls onCancel when the Cancel button is clicked', async () => {
      const mockOnCancel = vi.fn();
      const mockOnSubmit = vi.fn();
      const client = new QueryClient();

      render(<FeatureRequestForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
        wrapper: ({ children }) => (
          <FlagsProvider>
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
          </FlagsProvider>
        ),
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  it('shows validation error when the description is empty', async () => {
    const mockOnCancel = vi.fn();
    const mockOnSubmit = vi.fn();
    const client = new QueryClient();

    render(<FeatureRequestForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
      wrapper: ({ children }) => (
        <FlagsProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </FlagsProvider>
      ),
    });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    const errorMessage = await screen.findByText(/you need to add a feature description/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it('submits the form with description and email', async () => {
    const mockOnCancel = vi.fn();
    const mockOnSubmit = vi.fn();
    const client = new QueryClient();

    render(<FeatureRequestForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
      wrapper: ({ children }) => (
        <FlagsProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </FlagsProvider>
      ),
    });

    const emailInput = screen.getByLabelText(/if you're open to follow-up questions, what's your email\?/i);

    await userEvent.type(emailInput, 'test@example.com');

    const descriptionTextArea = screen.getByLabelText(/what are you trying to report on\?/i);
    await userEvent.type(descriptionTextArea, 'I want a weekly breakdown');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    const successFlag = await screen.findByText(/thanks for the feedback/i);
    expect(successFlag).toBeInTheDocument();
  });
});
