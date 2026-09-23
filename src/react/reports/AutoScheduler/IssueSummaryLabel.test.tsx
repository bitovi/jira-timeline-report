import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IssueSummaryLabel } from './IssueSummaryLabel';

const SUMMARY = 'Apply referral reward in order flow';

/**
 * jsdom has no layout, so `scrollWidth`/`clientWidth` are always 0 and nothing is ever clipped.
 * These override the two properties the component reads rather than asking jsdom to measure
 * anything — the rule this repo works to is that no test may depend on a width jsdom produced, and
 * an injected measurement does not.
 */
const setClipped = (isClipped: boolean) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, value: isClipped ? 400 : 100 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 100 });
};

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

describe('IssueSummaryLabel', () => {
  it('links the summary when the issue has a url, and opens in a new tab when asked', () => {
    render(
      <IssueSummaryLabel summary={SUMMARY} url="https://jira.example/browse/ORDER-1" openInNewTab gridRowStart={4} />,
    );

    const link = screen.getByRole('link', { name: SUMMARY });
    expect(link).toHaveAttribute('href', 'https://jira.example/browse/ORDER-1');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders the summary as plain text when the issue has no url', () => {
    render(<IssueSummaryLabel summary={SUMMARY} gridRowStart={4} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(SUMMARY)).toBeInTheDocument();
  });

  /**
   * The bug this guards: `truncate` used to sit on the grid cell while the summary lived in a
   * nested block, so `text-overflow: ellipsis` had no line box of its own to act on and the text
   * was clipped mid-word with no ellipsis at all.
   */
  it('puts `truncate` on the element that directly contains the text', () => {
    render(<IssueSummaryLabel summary={SUMMARY} gridRowStart={4} />);

    const text = screen.getByText(SUMMARY);
    expect(text).toHaveClass('truncate');
  });

  it('shows no tooltip while the summary fits', async () => {
    setClipped(false);
    render(<IssueSummaryLabel summary={SUMMARY} gridRowStart={4} />);

    await userEvent.hover(screen.getByText(SUMMARY));

    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('shows the full summary on hover once it is clipped', async () => {
    setClipped(true);
    render(<IssueSummaryLabel summary={SUMMARY} gridRowStart={4} />);

    await userEvent.hover(screen.getByText(SUMMARY));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(SUMMARY);
  });

  it('reaches a clipped plain-text summary by keyboard', async () => {
    setClipped(true);
    render(<IssueSummaryLabel summary={SUMMARY} gridRowStart={4} />);

    await userEvent.tab();

    expect(screen.getByText(SUMMARY)).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(SUMMARY);
  });

  it('leaves a linked summary to the anchor rather than adding a second tab stop', async () => {
    setClipped(true);
    render(<IssueSummaryLabel summary={SUMMARY} url="https://jira.example/browse/ORDER-1" gridRowStart={4} />);

    await userEvent.tab();

    // One tab stop, the anchor — and its focus still opens the tooltip, because React's `onFocus`
    // is `focusin`, which bubbles to the trigger wrapping it.
    expect(screen.getByRole('link')).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(SUMMARY);
  });

  it('adds no tab stop to a plain-text summary that is not clipped', async () => {
    setClipped(false);
    render(<IssueSummaryLabel summary={SUMMARY} gridRowStart={4} />);

    await userEvent.tab();

    expect(screen.getByText(SUMMARY)).not.toHaveFocus();
  });
});
