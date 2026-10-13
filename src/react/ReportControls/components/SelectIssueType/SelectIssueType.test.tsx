import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import SelectIssueType from './SelectIssueType';

import * as CanObservable from '../../../hooks/useCanObservable';

describe('<SelectIssueType />', () => {
  it('renders without crashing', () => {
    render(<SelectIssueType />);

    const label = screen.getByText('Report on');
    expect(label).toBeInTheDocument();

    const loadingDropdown = screen.getByText('Loading...');
    expect(loadingDropdown).toBeInTheDocument();
  });

  it('renders with data', async () => {
    const spy = vi.spyOn(CanObservable, 'useCanObservable').mockImplementation(({ _name }: any) => {
      if (_name.includes('selectedIssueType')) {
        return 'Epic';
      }

      if (_name.includes('issueHierarchy')) {
        return [
          { name: 'Epic', hierarchyLevel: 1 },
          { name: 'Story', hierarchyLevel: 2 },
        ];
      }

      return null;
    });

    render(<SelectIssueType />);

    const dropdownTrigger = await screen.findByText('Epic');
    expect(dropdownTrigger).toBeInTheDocument();

    spy.mockReset();
  });

  it('an outside click closes the menu even with the Releases submenu open', async () => {
    const spy = vi.spyOn(CanObservable, 'useCanObservable').mockImplementation(({ _name }: any) => {
      if (_name.includes('selectedIssueType')) return 'Epic';
      if (_name.includes('issueHierarchy')) return [{ name: 'Epic', hierarchyLevel: 1 }];
      return null;
    });

    render(<SelectIssueType />);
    fireEvent.click(await screen.findByText('Epic'));
    fireEvent.click(screen.getByText('Releases'));
    expect(screen.getAllByText('Epic')).toHaveLength(3);
    fireEvent.click(document.body);
    expect(screen.queryByText('Releases')).not.toBeInTheDocument();

    spy.mockReset();
  });
});
