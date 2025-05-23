import React from 'react';
import { render, screen } from '@testing-library/react';

import FeatureToggle from './FeatureToggle';

describe('<FeatureToggle />', () => {
  it('renders without crashing', () => {
    render(<FeatureToggle title="Test Feature" subtitle="Description of the feature" checked onChange={vi.fn()} />);

    const title = screen.getByText('Test Feature');
    expect(title).toBeInTheDocument();

    const subtitle = screen.getByText('Description of the feature');
    expect(subtitle).toBeInTheDocument();
  });
});
