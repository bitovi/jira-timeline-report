import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CapacityOverridesProvider, useCapacityOverrides } from './CapacityOverridesProvider';

const Probe = () => {
  const { overrides, savedCapacity, setTeamOverride, clearTeamOverride, rememberSavedCapacity, commitSavedCapacity } =
    useCapacityOverrides();

  return (
    <div>
      <output>{JSON.stringify(overrides)}</output>
      <pre data-testid="saved">{JSON.stringify(savedCapacity)}</pre>
      <button onClick={() => setTeamOverride('ORDER', { velocityPerSprint: 35 })}>set capacity</button>
      <button onClick={() => setTeamOverride('ORDER', { tracks: 2 })}>set tracks</button>
      <button onClick={() => setTeamOverride('ORDER', { velocityPerSprint: undefined })}>unset capacity</button>
      <button onClick={() => clearTeamOverride('ORDER')}>clear</button>
      <button onClick={() => rememberSavedCapacity('ORDER', { velocityPerSprint: 21, tracks: 1 })}>remember 21</button>
      <button onClick={() => rememberSavedCapacity('ORDER', { velocityPerSprint: 35, tracks: 2 })}>remember 35</button>
      <button onClick={() => commitSavedCapacity('ORDER', { velocityPerSprint: 35, tracks: 2 })}>commit 35</button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <CapacityOverridesProvider>
      <Probe />
    </CapacityOverridesProvider>,
  );

const savedCapacity = () => screen.getByTestId('saved');

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

  it('removes a field set back to undefined rather than merging it', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('set tracks'));
    await userEvent.click(screen.getByText('unset capacity'));
    expect(screen.getByRole('status')).toHaveTextContent('{"ORDER":{"tracks":2}}');
  });

  it('drops the team when its last field is set back to undefined', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('unset capacity'));
    expect(screen.getByRole('status')).toHaveTextContent('{}');
  });

  it('exposes the save-completed handler it was given', () => {
    const onTeamDataSaved = vi.fn();
    const Reader = () => <output>{typeof useCapacityOverrides().onTeamDataSaved}</output>;

    render(
      <CapacityOverridesProvider onTeamDataSaved={onTeamDataSaved}>
        <Reader />
      </CapacityOverridesProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('function');
  });

  it('records a saved baseline for a team', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('remember 21'));
    expect(savedCapacity()).toHaveTextContent('{"ORDER":{"velocityPerSprint":21,"tracks":1}}');
  });

  it('ignores a baseline offered while the team is overridden, since it would be the override itself', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('remember 21'));
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('remember 35'));
    expect(savedCapacity()).toHaveTextContent('{"ORDER":{"velocityPerSprint":21,"tracks":1}}');
  });

  it('moves the baseline to the committed values and drops the override', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('remember 21'));
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('commit 35'));

    expect(savedCapacity()).toHaveTextContent('{"ORDER":{"velocityPerSprint":35,"tracks":2}}');
    expect(screen.getByRole('status')).toHaveTextContent('{}');
  });

  it('throws when used outside its provider', () => {
    expect(() => render(<Probe />)).toThrow('Cannot use useCapacityOverrides outside of its provider');
  });
});
