import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import SelectCloudView from './SelectCloudView';

const siteA = { id: 'A', name: 'Site A' };
const siteB = { id: 'B', name: 'Site B' };
const siteC = { id: 'C', name: 'Site C' };

describe('<SelectCloudView />', () => {
  it('renders the loading pill while resources are in flight', () => {
    render(<SelectCloudView isLoading current={undefined} alternates={[]} onSelectCloud={vi.fn()} />);

    const pill = screen.getByTestId('select-cloud-loading');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('...');
    // no interactive trigger while loading
    expect(screen.queryByTestId('select-cloud-trigger')).not.toBeInTheDocument();
  });

  it('renders a switchable pill and lists alternates on open', async () => {
    const user = userEvent.setup();
    const onSelectCloud = vi.fn();

    render(
      <SelectCloudView isLoading={false} current={siteA} alternates={[siteB, siteC]} onSelectCloud={onSelectCloud} />,
    );

    const trigger = screen.getByTestId('select-cloud-trigger');
    expect(trigger).toHaveTextContent('Site A');
    // alternates are hidden until the dropdown is opened
    expect(screen.queryByText('Site B')).not.toBeInTheDocument();

    await user.click(trigger);

    // one item per alternate — the current site is not offered as a choice
    expect(await screen.findByText('Site B')).toBeInTheDocument();
    expect(screen.getByText('Site C')).toBeInTheDocument();
    expect(screen.queryByText('Site A', { selector: '[role="menuitem"]' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Site B'));

    expect(onSelectCloud).toHaveBeenCalledTimes(1);
    expect(onSelectCloud).toHaveBeenCalledWith('B');
  });

  it('renders a static, non-interactive pill when there are no alternates', () => {
    render(<SelectCloudView isLoading={false} current={siteA} alternates={[]} onSelectCloud={vi.fn()} />);

    const pill = screen.getByTestId('select-cloud-single');
    expect(pill).toHaveTextContent('Site A');
    // static — not a dropdown trigger
    expect(screen.queryByTestId('select-cloud-trigger')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no current site and no alternates', () => {
    const { container } = render(
      <SelectCloudView isLoading={false} current={undefined} alternates={[]} onSelectCloud={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
