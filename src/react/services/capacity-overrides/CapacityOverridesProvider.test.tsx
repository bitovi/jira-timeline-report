import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CapacityOverridesProvider, useCapacityOverrides } from './CapacityOverridesProvider';

const Probe = () => {
  const { overrides, setTeamOverride, clearTeamOverride } = useCapacityOverrides();

  return (
    <div>
      <output>{JSON.stringify(overrides)}</output>
      <button onClick={() => setTeamOverride('ORDER', { velocityPerSprint: 35 })}>set capacity</button>
      <button onClick={() => setTeamOverride('ORDER', { tracks: 2 })}>set tracks</button>
      <button onClick={() => clearTeamOverride('ORDER')}>clear</button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <CapacityOverridesProvider>
      <Probe />
    </CapacityOverridesProvider>,
  );

describe('CapacityOverridesProvider', () => {
  it('starts with no overrides', () => {
    renderProbe();
    expect(screen.getByRole('status')).toHaveTextContent('{}');
  });

  it('records an override for a team', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    expect(screen.getByRole('status')).toHaveTextContent('{"ORDER":{"velocityPerSprint":35}}');
  });

  it('merges a second field into the same team rather than replacing it', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('set tracks'));
    expect(screen.getByRole('status')).toHaveTextContent('{"ORDER":{"velocityPerSprint":35,"tracks":2}}');
  });

  it('drops the team entirely on clear', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('clear'));
    expect(screen.getByRole('status')).toHaveTextContent('{}');
  });

  it('throws when used outside its provider', () => {
    expect(() => render(<Probe />)).toThrow('Cannot use useCapacityOverrides outside of its provider');
  });
});
