import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockInstance, vi } from 'vitest';

import SelectReportType from './SelectReportType';
import * as Reports from './hooks/useReports';
import * as PrimaryReportType from '../../hooks/usePrimaryReportType';
import { defaultFeatures } from '../../../../jira/features';
import * as Features from '../../../services/features';

describe('<SelectReportType />', () => {
  let useFeaturesSpy: MockInstance<[], ReturnType<typeof Features.useAsyncFeatures>>;

  beforeEach(() => {
    useFeaturesSpy = vi.spyOn(Features, 'useAsyncFeatures').mockReturnValue({
      features: { ...defaultFeatures, estimationTable: true },
      isLoading: false,
    });
  });

  afterEach(() => {
    useFeaturesSpy.mockReset();
  });

  it('renders without crashing', () => {
    render(<SelectReportType />);

    const label = screen.getByText('Report type');
    expect(label).toBeInTheDocument();

    const dropdownTrigger = screen.getByRole('button', { name: /Gantt Chart/ });
    expect(dropdownTrigger).toBeInTheDocument();
  });

  it('renders with data', () => {
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

    render(<SelectReportType />);

    expect(useReportsSpy).toBeCalledTimes(1);
    expect(usePrimaryReportTypeSpy).toBeCalledTimes(1);

    const dropdownTrigger = screen.getByRole('button', { name: /Estimation Table/ });
    expect(dropdownTrigger).toBeInTheDocument();

    useReportsSpy.mockReset();
    usePrimaryReportTypeSpy.mockReset();
  });
});
