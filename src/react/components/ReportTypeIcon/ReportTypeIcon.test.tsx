import { render } from '@testing-library/react';
import React from 'react';

import { ReportTypeIcon } from './ReportTypeIcon';

it('renders an svg for a known tone and is decorative by default', () => {
  const { container } = render(<ReportTypeIcon tone="gantt" />);
  expect(container.querySelector('svg')).toBeInTheDocument();
});

it('exposes a label when given one', () => {
  const { getByLabelText } = render(<ReportTypeIcon tone="cards" label="Cards" />);
  expect(getByLabelText('Cards')).toBeInTheDocument();
});

it('falls back to a neutral document icon for an unrecognized tone', () => {
  const { container } = render(<ReportTypeIcon tone="neutral" />);
  expect(container.querySelector('svg')).toBeInTheDocument();
});
