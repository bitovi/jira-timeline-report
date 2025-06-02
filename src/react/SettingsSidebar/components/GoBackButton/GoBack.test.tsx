import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { GoBackButton } from './GoBackButton';

describe('GoBackButton Component', () => {
  it('renders without crashing', () => {
    render(<GoBackButton onGoBack={vi.fn()} />);

    const goBackButton = screen.getByRole('button', { name: /go back/i });
    expect(goBackButton).toBeInTheDocument();
  });

  it('calls onGoBack when the button is clicked', async () => {
    const onGoBackMock = vi.fn();

    render(<GoBackButton onGoBack={onGoBackMock} />);

    const goBackButton = screen.getByRole('button', { name: /go back/i });

    await userEvent.click(goBackButton);

    expect(onGoBackMock).toHaveBeenCalledTimes(1);
  });
});
