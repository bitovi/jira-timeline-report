import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import SelectReportType from './SelectReportType';
import * as Reports from './hooks/useReports';
import * as PrimaryReportType from './hooks/usePrimaryReportType';

describe('<SelectReportType />', () => {
  it('renders without crashing', () => {
    render(
      <SelectReportType
        features={
          new Promise(() => {
            /* stub */
          })
        }
      />,
    );

    const label = screen.getByText('Report type');
    expect(label).toBeInTheDocument();

    const dropdownTrigger = screen.getByRole('button', { name: /Gantt Chart/ });
    expect(dropdownTrigger).toBeInTheDocument();
  });

  it('renders with data', async () => {
    const mockUseReportsReturn = [
      [
        { key: 'start-due', name: 'Gantt Chart' },
        { key: 'due', name: 'Scatter Plot' },
        { key: 'table', name: 'Estimation Table' },
      ],
      () => {
        /* stub */
      },
    ] as ReturnType<typeof Reports.useReports>;
    const useReportsSpy = vi.spyOn(Reports, 'useReports').mockReturnValue(mockUseReportsReturn);

    const mockUsePrimaryReportTypeReturn = [
      'table',
      () => {
        /* stub */
      },
    ] as ReturnType<typeof PrimaryReportType.usePrimaryReportType>;
    const usePrimaryReportTypeSpy = vi
      .spyOn(PrimaryReportType, 'usePrimaryReportType')
      .mockReturnValue(mockUsePrimaryReportTypeReturn);

    render(
      <SelectReportType
        features={Promise.resolve({
          estimationTable: true,
          secondaryReport: true,
          workBreakdowns: true,
        })}
      />,
    );

    expect(useReportsSpy).toBeCalledTimes(1);
    expect(usePrimaryReportTypeSpy).toBeCalledTimes(1);
    await waitFor(() => {
      const dropdownTrigger = screen.getByRole('button', { name: /Estimation Table/ });
      expect(dropdownTrigger).toBeInTheDocument();
    });

    useReportsSpy.mockReset();
    usePrimaryReportTypeSpy.mockReset();
  });
});
