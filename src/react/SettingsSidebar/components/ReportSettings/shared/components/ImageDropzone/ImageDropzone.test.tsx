import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

import ImageDropzone from './ImageDropzone';
import userEvent from '@testing-library/user-event';

describe('<ImageDropzone /> Component', () => {
  it('renders', () => {
    const mockSetFiles = vi.fn();

    render(<ImageDropzone files={[]} setFiles={mockSetFiles} />);

    const dropZone = screen.getByText(/drag and drop files or click to upload/i);
    expect(dropZone).toBeVisible();

    const fileInput = screen.getByLabelText(/drag and drop files or click to upload/i);
    expect(fileInput).toBeInTheDocument();
  });

  it('handles file selection correctly', async () => {
    const mockSetFiles = vi.fn();
    const mockFile = new File(['file content'], 'example.jpg', { type: 'image/jpeg' });

    render(<ImageDropzone files={[]} setFiles={mockSetFiles} />);

    const fileInput = screen.getByLabelText(/drag and drop files or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(mockSetFiles).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('removes the file from the list when "Remove" is clicked', async () => {
    const mockSetFiles = vi.fn();
    const mockFile = new File(['file content'], 'example.jpg', { type: 'image/jpeg' });

    render(<ImageDropzone files={[mockFile]} setFiles={mockSetFiles} />);

    const fileName = screen.getByText('example.jpg');
    expect(fileName).toBeInTheDocument();

    const removeButton = screen.getByText(/remove/i);
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(mockSetFiles).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('drags and drops', async () => {
    const mockSetFiles = vi.fn();
    const mockFile = new File(['file content'], 'example.jpg', { type: 'image/jpeg' });

    render(<ImageDropzone files={[]} setFiles={mockSetFiles} />);

    const dropZone = screen.getByText(/drag and drop files or click to upload/i);
    fireEvent.dragOver(dropZone);

    const dropText = screen.getByText(/drop files here/i);
    expect(dropText).toBeInTheDocument();

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    await waitFor(() => {
      expect(mockSetFiles).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
