import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FreezeToggle, FREEZE_NEEDS_DATES } from './FreezeToggle';
import { parseFrozenIssues, serializeFrozenIssues } from '../../hooks/useFrozenIssues';

describe('FreezeToggle', () => {
  it('names the action after the summary', () => {
    const { rerender } = render(<FreezeToggle summary="Checkout" isFrozen={false} canFreeze onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Freeze Checkout' })).toHaveAttribute('aria-pressed', 'false');

    rerender(<FreezeToggle summary="Checkout" isFrozen canFreeze onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Unfreeze Checkout' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles', async () => {
    const onToggle = vi.fn();
    render(<FreezeToggle summary="Checkout" isFrozen={false} canFreeze onToggle={onToggle} />);

    await userEvent.click(screen.getByRole('button', { name: 'Freeze Checkout' }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('is disabled, and says why, when the item has no Jira dates', async () => {
    const onToggle = vi.fn();
    render(<FreezeToggle summary="Checkout" isFrozen={false} canFreeze={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Freeze Checkout' });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();

    await userEvent.hover(button);
    expect((await screen.findAllByText(FREEZE_NEEDS_DATES)).length).toBeGreaterThan(0);
  });
});

describe('frozenIssues URL value', () => {
  it('is sorted and de-duplicated', () => {
    expect(serializeFrozenIssues(['B-2', 'A-1', 'B-2'])).toBe('A-1,B-2');
    expect(serializeFrozenIssues([])).toBe('');
  });

  it('parses back to a set', () => {
    expect([...parseFrozenIssues('A-1,B-2')]).toEqual(['A-1', 'B-2']);
    expect(parseFrozenIssues('').size).toBe(0);
    expect(parseFrozenIssues(undefined).size).toBe(0);
  });
});
