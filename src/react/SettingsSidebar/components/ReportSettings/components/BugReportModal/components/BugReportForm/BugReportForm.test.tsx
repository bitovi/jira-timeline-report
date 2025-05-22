import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, expect, it } from 'vitest';

import BugReportForm from './BugReportForm';
import { FlagsProvider } from '@atlaskit/flag';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';

describe('<BugReportForm />', () => {
  it('renders', () => {
    const mockOnCancel = vi.fn();
    const mockOnSubmit = vi.fn();
    const client = new QueryClient();

    render(<BugReportForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
      wrapper: ({ children }) => (
        <FlagsProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </FlagsProvider>
      ),
    });

    const nameLabel = screen.getByLabelText(/name/i);
    expect(nameLabel).toBeInTheDocument();

    const emailLabel = screen.getByLabelText(/email/i);
    expect(emailLabel).toBeInTheDocument();

    const descriptionLabel = screen.getByLabelText(/description/i);
    expect(descriptionLabel).toBeInTheDocument();

    const dropzoneLabel = screen.getByLabelText(/Drag and drop files or click to upload/i);
    expect(dropzoneLabel).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();
  });

  describe('BugReportForm Component', () => {
    it('calls onCancel when the Cancel button is clicked', async () => {
      const mockOnCancel = vi.fn();
      const mockOnSubmit = vi.fn();
      const client = new QueryClient();

      render(<BugReportForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
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

    render(<BugReportForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
      wrapper: ({ children }) => (
        <FlagsProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </FlagsProvider>
      ),
    });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    const errorMessage = await screen.findByText(/you need to add a description/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it('submits the form with name, description and email', async () => {
    const mockOnCancel = vi.fn();
    const mockOnSubmit = vi.fn();
    const client = new QueryClient();

    render(<BugReportForm onCancel={mockOnCancel} onSubmit={mockOnSubmit} />, {
      wrapper: ({ children }) => (
        <FlagsProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </FlagsProvider>
      ),
    });

    const nameInput = screen.getByLabelText(/name/i);

    await userEvent.type(nameInput, 'test');

    const emailInput = screen.getByLabelText(/email/i);

    await userEvent.type(emailInput, 'test@example.com');

    const descriptionTextArea = screen.getByLabelText(/description/i);
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
