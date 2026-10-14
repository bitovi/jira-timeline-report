import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, expect, it } from 'vitest';

import { resetJiraImageResolver, setJiraImageResolver } from '../../../shared/jira-image-src';
import { JiraImage } from './JiraImage';

afterEach(() => {
  resetJiraImageResolver();
});

it('renders the URL as-is by default — what web and Connect keep doing', () => {
  render(<JiraImage src="https://example.atlassian.net/icon.png" alt="Issue type" />);

  expect(screen.getByAltText('Issue type')).toHaveAttribute('src', 'https://example.atlassian.net/icon.png');
});

it('renders the resolved src once an async resolver answers', async () => {
  setJiraImageResolver(() => Promise.resolve('blob:icon-1'));

  render(<JiraImage src="https://api.atlassian.com/ex/jira/x/rest/api/2/universal_avatar/1" alt="Issue type" />);

  expect(screen.queryByAltText('Issue type')).not.toBeInTheDocument();
  expect(await screen.findByAltText('Issue type')).toHaveAttribute('src', 'blob:icon-1');
});

it('renders nothing without a src', () => {
  const { container } = render(<JiraImage src={undefined} alt="" />);

  expect(container).toBeEmptyDOMElement();
});
