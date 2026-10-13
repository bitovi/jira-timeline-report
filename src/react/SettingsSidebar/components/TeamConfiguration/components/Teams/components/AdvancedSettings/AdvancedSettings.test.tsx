import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import AdvancedSettings from './AdvancedSettings';

describe('<AdvancedSettings />', () => {
  it('starts collapsed and expands on click', async () => {
    render(
      <AdvancedSettings>
        <p>Estimate Field</p>
      </AdvancedSettings>,
    );

    const toggle = screen.getByRole('button', { name: /Advanced settings/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Estimate Field')).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Estimate Field')).toBeInTheDocument();
  });
});
