import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Branding from './Branding';

describe('Branding Component', () => {
  it('renders without crashing', () => {
    render(<Branding />);

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();

    const statusReportsLink = screen.getByRole('link', { name: /status reports/i });
    expect(statusReportsLink).toBeInTheDocument();

    const bitoviLink = screen.getByRole('link', { name: /by bitovi/i });
    expect(bitoviLink).toBeInTheDocument();
  });

  it('shows a happy Eggbert when licensed', () => {
    render(<Branding />);

    expect(screen.getByRole('img', { name: 'Status Reports logo' })).toBeInTheDocument();
  });

  it('shows a sad Eggbert with a subscribe tooltip when unlicensed', async () => {
    render(<Branding unlicensed />);

    const logo = screen.getByRole('img', { name: /unlicensed/i });
    expect(logo.querySelector('path')).toHaveAttribute('fill', '#C9372C');

    await userEvent.hover(logo);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(/isn't licensed on this Jira site/);
  });
});
