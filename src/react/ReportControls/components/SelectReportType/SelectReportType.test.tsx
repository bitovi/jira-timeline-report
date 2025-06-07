import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockInstance, vi } from 'vitest';

import SelectReportType from './SelectReportType';
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
});
