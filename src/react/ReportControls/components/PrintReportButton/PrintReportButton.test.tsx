import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import PrintReportButton from './PrintReportButton';
import * as PrimaryReportType from '../../hooks/usePrimaryReportType';

describe('<PrintReportButton />', () => {
  beforeEach(() => {
    vi.spyOn(PrimaryReportType, 'usePrimaryReportType').mockReturnValue(['start-due', vi.fn()]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders a "Download PDF" button for the gantt/scatter report types', () => {
    render(<PrintReportButton />);

    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('renders nothing for other report types', () => {
    vi.spyOn(PrimaryReportType, 'usePrimaryReportType').mockReturnValue(['table', vi.fn()]);

    render(<PrintReportButton />);

    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
  });

  it('calls window.print() when clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<PrintReportButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('sets --print-scale on #react-report-container before printing', () => {
    const container = document.createElement('div');
    container.id = 'react-report-container';
    document.body.appendChild(container);
    vi.spyOn(window, 'print').mockImplementation(() => {});

    render(<PrintReportButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(container.style.getPropertyValue('--print-scale')).not.toBe('');
  });

  it('resets --print-scale on afterprint', () => {
    const container = document.createElement('div');
    container.id = 'react-report-container';
    document.body.appendChild(container);
    vi.spyOn(window, 'print').mockImplementation(() => {});

    render(<PrintReportButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(container.style.getPropertyValue('--print-scale')).not.toBe('');

    window.dispatchEvent(new Event('afterprint'));

    expect(container.style.getPropertyValue('--print-scale')).toBe('');
  });

  it('does not react to beforeprint when the report type does not match', () => {
    vi.spyOn(PrimaryReportType, 'usePrimaryReportType').mockReturnValue(['table', vi.fn()]);
    const container = document.createElement('div');
    container.id = 'react-report-container';
    document.body.appendChild(container);

    render(<PrintReportButton />);
    window.dispatchEvent(new Event('beforeprint'));

    expect(container.style.getPropertyValue('--print-scale')).toBe('');
  });
});
