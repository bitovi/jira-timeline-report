import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import routeData from '../../../../canjs/routing/route-data/route-data';
import FullscreenToggle from './FullscreenToggle';

vi.mock('../../../../canjs/routing/route-data/route-data', async () => {
  const mockRouteData = {
    fullscreen: false,
  };
  const { ObservableObject } = await import('../../../../can');
  return {
    default: new (ObservableObject as ObjectConstructor)(mockRouteData),
  };
});

type MockableRouteData = { fullscreen: boolean };

beforeEach(() => {
  (routeData as unknown as MockableRouteData).fullscreen = false;
  document.body.classList.remove('fullscreen-mode');
});

describe('<FullscreenToggle />', () => {
  it('renders an "Enter fullscreen" button inline when not in fullscreen', () => {
    render(<FullscreenToggle />);

    expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument();
    expect(document.body.classList.contains('fullscreen-mode')).toBe(false);
  });

  it('sets the route data and body class when clicked', async () => {
    const user = userEvent.setup();
    render(<FullscreenToggle />);

    await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

    expect((routeData as unknown as MockableRouteData).fullscreen).toBe(true);
    expect(document.body.classList.contains('fullscreen-mode')).toBe(true);
  });

  it('renders an "Exit fullscreen" button and adds the body class when already fullscreen', () => {
    (routeData as unknown as MockableRouteData).fullscreen = true;

    render(<FullscreenToggle />);

    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
    expect(document.body.classList.contains('fullscreen-mode')).toBe(true);
  });

  it('exits fullscreen when Escape is pressed', async () => {
    const user = userEvent.setup();
    (routeData as unknown as MockableRouteData).fullscreen = true;

    render(<FullscreenToggle />);

    await user.keyboard('{Escape}');

    expect((routeData as unknown as MockableRouteData).fullscreen).toBe(false);
  });

  it('removes the body class on unmount', () => {
    (routeData as unknown as MockableRouteData).fullscreen = true;

    const { unmount } = render(<FullscreenToggle />);
    expect(document.body.classList.contains('fullscreen-mode')).toBe(true);

    unmount();
    expect(document.body.classList.contains('fullscreen-mode')).toBe(false);
  });
});
