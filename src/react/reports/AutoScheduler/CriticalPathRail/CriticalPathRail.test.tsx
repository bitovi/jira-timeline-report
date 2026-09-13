import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CriticalPathRail } from './CriticalPathRail';

function renderRail(overrides: Partial<React.ComponentProps<typeof CriticalPathRail>> = {}) {
  const onOpenChange = vi.fn();
  render(
    <CriticalPathRail
      floor={{ floorDays: 53.8, queueingDays: 37.2 }}
      open={false}
      onOpenChange={onOpenChange}
      {...overrides}
    >
      <div>rail contents</div>
    </CriticalPathRail>,
  );
  return { onOpenChange };
}

/** The spine is the only control carrying `aria-expanded`, which keeps these queries unambiguous. */
const spine = () => screen.queryByRole('button', { expanded: false });

describe('CriticalPathRail', () => {
  it('renders only the spine while closed', () => {
    renderRail();
    expect(spine()).toBeInTheDocument();
    expect(screen.queryByText('rail contents')).not.toBeInTheDocument();
  });

  it('shows the floor on the spine so closing costs no information', () => {
    renderRail();
    expect(spine()).toHaveTextContent('Critical path');
    expect(spine()).toHaveTextContent('floor 53.8 d');
  });

  it('opens when the spine is clicked', async () => {
    const { onOpenChange } = renderRail();
    await userEvent.click(spine()!);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('hides the spine and shows the children while open', () => {
    renderRail({ open: true });
    expect(screen.getByText('rail contents')).toBeInTheDocument();
    expect(spine()).not.toBeInTheDocument();
  });

  it('closes from the header close button', async () => {
    const { onOpenChange } = renderRail({ open: true });
    await userEvent.click(screen.getByRole('button', { name: /close critical path/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes from a click on the divider grip', async () => {
    const { onOpenChange } = renderRail({ open: true });
    await userEvent.click(screen.getByRole('separator'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('exposes the divider as a focusable, keyboard-resizable separator', async () => {
    renderRail({ open: true });
    const divider = screen.getByRole('separator');
    expect(divider).toHaveAttribute('tabindex', '0');
    const before = Number(divider.getAttribute('aria-valuenow'));
    divider.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(Number(divider.getAttribute('aria-valuenow'))).toBe(before + 16);
  });

  it('states the queueing gap when it is comparable', () => {
    renderRail({ open: true });
    expect(screen.getByText(/queueing/i)).toBeInTheDocument();
    expect(screen.getByText(/37\.2 d/)).toBeInTheDocument();
  });

  it('omits the queueing clause when the gap is not comparable', () => {
    renderRail({ open: true, floor: { floorDays: 53.8, queueingDays: null } });
    expect(screen.getByText(/dependency floor/i)).toBeInTheDocument();
    expect(screen.queryByText(/queueing/i)).not.toBeInTheDocument();
  });
});
