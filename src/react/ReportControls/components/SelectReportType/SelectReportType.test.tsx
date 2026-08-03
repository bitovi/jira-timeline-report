import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockInstance, vi } from 'vitest';

import SelectReportType from './SelectReportType';
import * as PrimaryReportType from '../../hooks/usePrimaryReportType';
import { defaultFeatures } from '../../../../jira/features';
import * as Features from '../../../services/features';
import { pushStateObservable } from '../../../../canjs/routing/state-storage';

/**
 * Points the URL at `search` and notifies, which under vitest has to be done by hand — see the same
 * helper in `ReportLayoutProvider.test.tsx` for why (`PushstateObservable.onBound` bails out when
 * `can-globals` reports Node, so the `history.pushState` wrapper that notifies subscribers in a real
 * browser is never installed). The notification is what carries the new URL into `routeData`.
 */
const setSearch = (search: string) => {
  pushStateObservable.value = search;

  const observable = pushStateObservable as unknown as { _value?: string; dispatchHandlers: () => void };

  observable._value = undefined;
  observable.dispatchHandlers();
};

const param = (key: string) => new URLSearchParams(window.location.search).get(key);

const pickReportType = async (optionName: string) => {
  await userEvent.click(screen.getByRole('button', { name: /Report of Reports|Gantt Chart/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: optionName }));
};

describe('<SelectReportType />', () => {
  let useFeaturesSpy: MockInstance<[], ReturnType<typeof Features.useAsyncFeatures>>;

  // The URL is reset here rather than in `afterEach`: these tests write to it, and a rewrite after
  // the fact re-renders the still-mounted component (React Testing Library's cleanup runs last)
  // against a spy that has already been reset.
  beforeEach(() => {
    setSearch('');

    useFeaturesSpy = vi.spyOn(Features, 'useAsyncFeatures').mockReturnValue({
      features: { ...defaultFeatures, tableReport: true, reportOfReports: true },
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

  // The document tree belongs to report-of-reports alone, so unlike every other param it must not
  // follow the user to the report they switched to. See `selectReportType`.
  describe('leaving a report-of-reports', () => {
    const encodedDocument = JSON.stringify([{ type: 'saved-report', params: { reportId: 'a' } }]);

    beforeEach(() => {
      setSearch(
        `?primaryReportType=report-of-reports&sections=${encodeURIComponent(encodedDocument)}&jql=issuetype%3DEpic`,
      );
    });

    it('drops the sections param', async () => {
      render(<SelectReportType />);

      await pickReportType('Scatter Plot');

      expect(param('primaryReportType')).toBe('due');
      expect(param('sections')).toBeNull();
    });

    it('keeps the params the two reports share', async () => {
      render(<SelectReportType />);

      await pickReportType('Scatter Plot');

      expect(param('jql')).toBe('issuetype=Epic');
    });

    it('keeps the document when the report picked is the one it belongs to', async () => {
      render(<SelectReportType />);

      await pickReportType('Report of Reports');

      expect(param('sections')).toBe(encodedDocument);
    });
  });
});
