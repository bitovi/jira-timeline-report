import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SizingExample } from './SizingExample';
import { WorkSettingsView } from '../WorkSettings/WorkSettings';
import { RawWorkSettings, resolveWorkSettings } from '../../../../../../jira/rollup/work-size/work-settings';

const renderExample = (raw: RawWorkSettings) => render(<SizingExample settings={resolveWorkSettings(raw)} />);

describe('SizingExample', () => {
  it('team time: shows each item’s size and where it came from', () => {
    renderExample({ sizeBy: 'teamTime' });
    expect(screen.getByTestId('size-W1')).toHaveTextContent('3d');
    expect(screen.getByTestId('size-W1')).toHaveTextContent('team time');
    expect(screen.getByTestId('size-W4')).toHaveTextContent('7d');
    expect(screen.getByTestId('size-W4')).toHaveTextContent('estimate ↩');
    expect(screen.getByTestId('size-W5')).toHaveTextContent('level average ↩');
  });

  it('leave out + unsized: the left-out bar is marked and unsized items show no size', () => {
    renderExample({ sizeBy: 'teamTime', noEstimate: 'leaveOut', sizeFallback: 'none', missingSize: 'unsized' });
    expect(screen.getByTestId('bar-W3')).toHaveTextContent('left out');
    expect(screen.getByTestId('size-W1')).toHaveTextContent('5d');
    expect(screen.getByTestId('size-W5')).toHaveTextContent('no size');
  });

  it('defaults to today’s sizing: date span first', () => {
    renderExample({});
    expect(screen.getByTestId('size-W1')).toHaveTextContent('8d');
    expect(screen.getByTestId('size-W1')).toHaveTextContent('date span');
  });
});

describe('WorkSettingsView example button', () => {
  it('only shows when it can open the example, and calls it', async () => {
    const onShowExample = vi.fn();
    const { rerender } = render(<WorkSettingsView settings={resolveWorkSettings({})} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'See how epics are sized' })).not.toBeInTheDocument();

    rerender(<WorkSettingsView settings={resolveWorkSettings({})} onChange={vi.fn()} onShowExample={onShowExample} />);
    await userEvent.click(screen.getByRole('button', { name: 'See how epics are sized' }));
    expect(onShowExample).toHaveBeenCalled();
  });
});
