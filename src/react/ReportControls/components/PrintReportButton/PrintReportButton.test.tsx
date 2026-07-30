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

  // A composed document is one of the more valuable things to print — its children are the
  // printable report types anyway. See spec/016-report-of-reports Phase 4.
  it('renders a "Download PDF" button for a report-of-reports', () => {
    vi.spyOn(PrimaryReportType, 'usePrimaryReportType').mockReturnValue(['report-of-reports', vi.fn()]);

    render(<PrintReportButton />);

    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
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

  /**
   * A collapsed report-of-reports section is `display: none` on screen and `display: block` in
   * print (src/css/print.css), and this measurement runs while the *screen* rules are live. Without
   * revealing it first, a wide chart inside a collapsed section measures as nothing, scales to 1,
   * and then prints at full width and clips — which is exactly the "collapse a section, then
   * Download PDF" case the collapse feature was built to support.
   */
  it('reveals collapsed content for the measurement, then hides it again', () => {
    vi.spyOn(PrimaryReportType, 'usePrimaryReportType').mockReturnValue(['report-of-reports', vi.fn()]);
    const container = document.createElement('div');
    container.id = 'react-report-container';
    document.body.appendChild(container);
    vi.spyOn(window, 'print').mockImplementation(() => {});

    // jsdom lays nothing out, so stand in for the real measurement and record whether collapsed
    // content was revealed at the exact moment it was taken.
    let revealedWhileMeasuring: boolean | undefined;
    Object.defineProperty(container, 'scrollWidth', {
      get() {
        revealedWhileMeasuring = container.classList.contains('measuring-print-scale');

        return 3000;
      },
    });

    render(<PrintReportButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(revealedWhileMeasuring).toBe(true);
    // The width was seen, so it was scaled down rather than left at 1:1...
    expect(Number(container.style.getPropertyValue('--print-scale'))).toBeLessThan(1);
    // ...and the screen is back to how the user left it.
    expect(container.classList.contains('measuring-print-scale')).toBe(false);
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
