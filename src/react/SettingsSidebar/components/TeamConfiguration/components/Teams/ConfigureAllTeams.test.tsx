import type { ReactNode } from 'react';
import type { TeamConfiguration } from './services/team-configuration';

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Stored after only a global per-type level was saved: `sanitizeAllTeamData` drops the empty
// `defaults`, so the saved global settings have none.
const savedUserTeamData = { '1': { tracks: 2 } } as unknown as TeamConfiguration;

vi.mock('./services/team-configuration', async () => {
  const actual = await vi.importActual<typeof import('./services/team-configuration')>('./services/team-configuration');

  return {
    ...actual,
    useTeamData: () => ({
      savedUserTeamData,
      inheritedTeamData: { defaults: { ...actual.createEmptyConfiguration(), teamMembers: 5, tracks: 1 } },
    }),
    useSaveTeamData: () => ({ save: vi.fn() }),
  };
});

// Only the Global Defaults panel is under test; the accordion around it needs the full hierarchy.
vi.mock('./ConfigureTeams', () => ({
  default: ({ defaultsPanel }: { defaultsPanel: ReactNode }) => <>{defaultsPanel}</>,
}));

import ConfigureAllTeams from './ConfigureAllTeams';

describe('ConfigureAllTeams', () => {
  it('opens when the global settings were saved per type only, with no defaults level', () => {
    render(<ConfigureAllTeams jiraFields={[]} />);

    expect(screen.getByText('How many developers are on the team?')).toBeInTheDocument();
  });
});
