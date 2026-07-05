import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { IssueMarker } from './IssueMarker';
import { makePlottedIssue } from '../../fixtures';

afterEach(cleanup);

describe('IssueMarker', () => {
  test('renders the label (shortVersion preferred over summary)', () => {
    render(<IssueMarker item={makePlottedIssue({ shortVersion: 'v1.2.0', summary: 'Long summary' })} />);
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
  });

  test('falls back to summary when no shortVersion', () => {
    render(<IssueMarker item={makePlottedIssue({ shortVersion: null, summary: 'My summary' })} />);
    expect(screen.getByText('My summary')).toBeInTheDocument();
  });

  test('applies the status color class to the marker', () => {
    render(<IssueMarker item={makePlottedIssue({ status: 'blocked' })} />);
    expect(screen.getByTestId('status-marker').className).toContain('color-text-and-bg-blocked');
  });

  test('defaults to labelSide="left" and anchors by right%', () => {
    const { container } = render(<IssueMarker item={makePlottedIssue({ endPercentFromRight: 30 })} />);
    const root = container.querySelector('[data-label-side]') as HTMLElement;
    expect(root.getAttribute('data-label-side')).toBe('left');
    expect(root.style.right).toBe('30%');
    expect(root.style.left).toBe('');
  });

  test('labelSide="right" anchors by left% (rightPercentEnd)', () => {
    const { container } = render(
      <IssueMarker item={makePlottedIssue({ rightPercentEnd: 5, overflowsLeft: true })} labelSide="right" />,
    );
    const root = container.querySelector('[data-label-side]') as HTMLElement;
    expect(root.getAttribute('data-label-side')).toBe('right');
    expect(root.style.left).toBe('5%');
    expect(root.style.right).toBe('');
  });

  test('uses larger marker + label width when not dense', () => {
    render(<IssueMarker item={makePlottedIssue({ markerRadius: 8, textSize: '' })} />);
    const marker = screen.getByTestId('status-marker');
    expect(marker.style.width).toBe('16px');
  });

  test('uses smaller marker when dense', () => {
    render(<IssueMarker item={makePlottedIssue({ markerRadius: 6, textSize: 'text-xs' })} />);
    const marker = screen.getByTestId('status-marker');
    expect(marker.style.width).toBe('12px');
  });
});
