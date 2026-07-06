import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelCell } from './LabelCell';
import { makeIssue } from '../../fixtures';

describe('LabelCell', () => {
  it('renders the issue summary linked to its url', () => {
    const issue = makeIssue({ key: 'A', summary: 'Do the thing', url: 'https://example.com/A' });
    render(
      <LabelCell
        issue={issue}
        depth={0}
        isShowingChildren={false}
        hasChildren={false}
        anyExpanded={false}
        onToggle={vi.fn()}
        textSizeClass=""
        expandPaddingClass=""
      />,
    );
    const link = screen.getByRole('link', { name: 'Do the thing' });
    expect(link).toHaveAttribute('href', 'https://example.com/A');
  });

  it('does not render a chevron when the issue has no children', () => {
    const issue = makeIssue({ key: 'A' });
    const { container } = render(
      <LabelCell
        issue={issue}
        depth={0}
        isShowingChildren={false}
        hasChildren={false}
        anyExpanded={false}
        onToggle={vi.fn()}
        textSizeClass=""
        expandPaddingClass=""
      />,
    );
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('calls onToggle when the chevron area is clicked and the issue has children', () => {
    const issue = makeIssue({ key: 'A' });
    const onToggle = vi.fn();
    const { container } = render(
      <LabelCell
        issue={issue}
        depth={0}
        isShowingChildren={false}
        hasChildren={true}
        anyExpanded={false}
        onToggle={onToggle}
        textSizeClass=""
        expandPaddingClass=""
      />,
    );
    fireEvent.click(container.querySelector('img')!.parentElement!);
    expect(onToggle).toHaveBeenCalled();
  });

  it('indents by depth', () => {
    const issue = makeIssue({ key: 'A' });
    const { container } = render(
      <LabelCell
        issue={issue}
        depth={2}
        isShowingChildren={false}
        hasChildren={false}
        anyExpanded={false}
        onToggle={vi.fn()}
        textSizeClass=""
        expandPaddingClass=""
      />,
    );
    const chevronBox = container.querySelector('.w-4.box-content') as HTMLElement;
    expect(chevronBox.style.paddingLeft).toBe('32px');
  });

  it('applies the special-status text class to blocked/complete/warning issues', () => {
    const issue = makeIssue({ key: 'A', status: 'blocked' });
    render(
      <LabelCell
        issue={issue}
        depth={0}
        isShowingChildren={false}
        hasChildren={false}
        anyExpanded={false}
        onToggle={vi.fn()}
        textSizeClass=""
        expandPaddingClass=""
      />,
    );
    expect(screen.getByRole('link').className).toContain('color-text-blocked');
  });
});
