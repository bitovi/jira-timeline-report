import type { FC } from 'react';
import type { CommentReportState } from '../hooks/useCommentReport';
import type { CommentBodyProps } from './CommentReport';

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { CommentBody, CommentRow, formatCommentTime } from './CommentReport';

/**
 * Stub `AdfDocument` with its own `Suspense` fallback — the local walker, synchronously — so this suite
 * never `React.lazy`-imports `@atlaskit/renderer`. Left real it makes these tests slow and
 * load-dependent, and the marks assertions below would race the module load. The real renderer has its
 * own tests in `AdfDocument.test.tsx`.
 * See spec/016-report-of-reports/007-latest-comment-report § Rich rendering.
 */
vi.mock('../../../components/AdfDocument', async () => {
  const react = await import('react');
  const { AdfBlocks, adfToBlocks } = await import('../../../components/AdfBlocks');

  return {
    AdfDocument: ({ document, fallbackClassName }: { document: unknown; fallbackClassName?: string }) =>
      react.createElement(AdfBlocks, { blocks: adfToBlocks(document), className: fallbackClassName }),
  };
});

const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });
const text = (value: string) => [{ type: 'text', text: value }];

const ok = (body: unknown): CommentReportState => ({
  status: 'ok',
  body,
  author: 'Dana Ruiz',
  updated: '2026-08-04T14:22:00.000Z',
});

const renderRow = (target: string) => render(<CommentRow target={target} />);

/**
 * The body carrying the Latest Comment preset's two strings, so the cases below read as they did before
 * `CommentReport` was generalized — every one of them is about rendering a comment, which is the same
 * question for both presets. The two strings that aren't get their own cases at the end.
 */
const LatestCommentBody: FC<Omit<CommentBodyProps, 'emptyNote' | 'testId'>> = (props) => (
  <CommentBody {...props} emptyNote="No updates found." testId="latest-comment" />
);

// See spec/016-report-of-reports/007-latest-comment-report § The row is the key.
describe('CommentRow', () => {
  // The row is the key and nothing else — no "Latest comment" prefix. See § The row is the key for why
  // the label went, and what collapsing costs without it.
  it('is the work item key, as the node’s heading', () => {
    renderRow('ABC-1');

    expect(screen.getByRole('heading', { name: 'ABC-1' })).toBeInTheDocument();
    expect(screen.queryByText('Latest comment')).not.toBeInTheDocument();
  });

  it('shows the placeholder key rather than an empty row when nothing is targeted', () => {
    renderRow('');

    expect(screen.getByText('ABC-1')).toBeInTheDocument();
  });

  // Authoring is the Add Report modal's; the node is read-only.
  // See spec/016-report-of-reports/009-value-report-modal § The node stops being editable.
  it('offers nothing to click or type into', () => {
    renderRow('ABC-1');

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  // A hand-written query names no single work item, so it titles the row as-is.
  it('titles the row with the query when the JQL names no single work item', () => {
    renderRow('project = A AND status = Done');

    expect(screen.getByRole('heading', { name: 'project = A AND status = Done' })).toBeInTheDocument();
  });
});

describe('CommentBody', () => {
  // The comment leads; who updated it and when close it out. Order matters as much as presence, so this
  // asserts the document order rather than just that all three are somewhere on screen.
  it('renders the comment, then who updated it and when', () => {
    const { container } = render(
      <LatestCommentBody target="ABC-1" state={ok(doc({ type: 'paragraph', content: text('Blocked.') }))} />,
    );

    expect(screen.getByTestId('latest-comment')).toBeInTheDocument();
    expect(screen.getByText('Blocked.')).toBeInTheDocument();

    const meta = `Updated by Dana Ruiz · ${formatCommentTime('2026-08-04T14:22:00.000Z')}`;

    expect(screen.getByText(meta)).toBeInTheDocument();

    const lines = [...container.querySelectorAll('p')].map((node) => node.textContent);

    expect(lines.indexOf('Blocked.')).toBeLessThan(lines.indexOf(meta));
  });

  // The formatting a real comment carries. Flattening dropped all of this, which is what made a comment
  // in a document read differently from the same comment in Jira.
  it('keeps bold, underline, and hard breaks from the comment body', () => {
    const { container } = render(
      <LatestCommentBody
        target="ABC-1"
        state={ok(
          doc({
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Blocked', marks: [{ type: 'strong' }] },
              { type: 'text', text: ' on the ' },
              { type: 'text', text: 'cert rotation', marks: [{ type: 'underline' }] },
              { type: 'hardBreak' },
              { type: 'text', text: 'Chasing IT.' },
            ],
          }),
        )}
      />,
    );

    expect(screen.getByText('Blocked').tagName).toBe('STRONG');
    expect(screen.getByText('cert rotation').tagName).toBe('U');
    expect(container.querySelectorAll('br')).toHaveLength(1);
    expect(screen.getByTestId('latest-comment')).toHaveTextContent('Chasing IT.');
  });

  it('renders the comment as semantic HTML, not flattened text', () => {
    render(
      <LatestCommentBody
        target="ABC-1"
        state={ok(
          doc({
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: text('first') }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: text('second') }] },
            ],
          }),
        )}
      />,
    );

    expect(screen.getByText('first').closest('ul')).toBeInTheDocument();
    expect(screen.getByText('second').closest('li')).toBeInTheDocument();
  });

  // Timezone-agnostic: the same formatter the component uses, so this passes wherever it runs.
  it('combines the author and the update time into one line', () => {
    render(<LatestCommentBody target="ABC-1" state={ok(doc({ type: 'paragraph', content: text('Hi') }))} />);

    expect(
      screen.getByText(`Updated by Dana Ruiz · ${formatCommentTime('2026-08-04T14:22:00.000Z')}`),
    ).toBeInTheDocument();
  });

  // "Updated by Dana Ruiz · " with nothing after it is worse than no date at all.
  it('drops the date half of the meta line rather than labelling a missing timestamp', () => {
    render(
      <LatestCommentBody
        target="ABC-1"
        state={{
          status: 'ok',
          body: doc({ type: 'paragraph', content: text('Hi') }),
          author: 'Dana Ruiz',
          updated: '',
        }}
      />,
    );

    expect(screen.getByText('Updated by Dana Ruiz')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  // A statement of fact rather than an instruction: with the node read-only there is nowhere to enter a
  // key, and only a document saved before the modal took over authoring can reach this state.
  it('states that no work item is set, rather than reporting a state or giving an instruction', () => {
    render(<LatestCommentBody target="" state={{ status: 'loading' }} />);

    expect(screen.getByText('No work item set.')).toBeInTheDocument();
  });

  it('reports loading', () => {
    render(<LatestCommentBody target="ABC-1" state={{ status: 'loading' }} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('reports no updates as a fact, not a failure', () => {
    render(<LatestCommentBody target="ABC-1" state={{ status: 'empty' }} />);

    expect(screen.getByText('No updates found.')).toBeInTheDocument();
    expect(screen.queryByTestId('latest-comment-error')).not.toBeInTheDocument();
  });

  it('shows an error with the target that caused it, so the document stays diagnosable', () => {
    render(<LatestCommentBody target="NOPE-1" state={{ status: 'error', message: 'No work item matched.' }} />);

    const problem = screen.getByTestId('latest-comment-error');

    expect(problem).toHaveTextContent('No work item matched.');
    expect(problem).toHaveTextContent('NOPE-1');
  });

  it('says so only when the document is genuinely empty', () => {
    render(<LatestCommentBody target="ABC-1" state={ok(doc())} />);

    expect(screen.getByText('This comment has no content.')).toBeInTheDocument();
  });

  // The local walker produces no blocks for media, but the document is not empty — it goes to the real
  // renderer, which is the whole reason that renderer was added. Gating on walker output would have
  // hidden it.
  it('does not treat a comment the local walker cannot render as empty', () => {
    render(<LatestCommentBody target="ABC-1" state={ok(doc({ type: 'mediaSingle', content: [] }))} />);

    expect(screen.queryByText('This comment has no content.')).not.toBeInTheDocument();
    expect(screen.getByTestId('latest-comment')).toBeInTheDocument();
    expect(screen.getByText(/^Updated by Dana Ruiz · /)).toBeInTheDocument();
  });

  it('shows Jira own string rather than "Invalid Date" for an unparseable timestamp', () => {
    expect(formatCommentTime('not a date')).toBe('not a date');
  });
});

/**
 * The two things a preset owns. Everything else above is shared, which is the point of the rename.
 * See spec/027-status-updates § The view.
 */
describe('CommentBody, per preset', () => {
  it('says what the caller says for empty, so each preset states its own true thing', () => {
    render(
      <CommentBody
        target="ABC-1"
        state={{ status: 'empty' }}
        emptyNote="No status update has been posted yet."
        testId="status-update"
      />,
    );

    expect(screen.getByText('No status update has been posted yet.')).toBeInTheDocument();
    expect(screen.queryByText('No updates found.')).not.toBeInTheDocument();
  });

  it('keys the body and the error line by the caller testId, so two presets are findable apart', () => {
    const { unmount } = render(
      <CommentBody
        target="ABC-1"
        state={ok(doc({ type: 'paragraph', content: text('Shipped.') }))}
        emptyNote="No status update has been posted yet."
        testId="status-update"
      />,
    );

    expect(screen.getByTestId('status-update')).toHaveTextContent('Shipped.');
    expect(screen.queryByTestId('latest-comment')).not.toBeInTheDocument();

    unmount();
    render(
      <CommentBody
        target="NOPE-1"
        state={{ status: 'error', message: 'No work item matched.' }}
        emptyNote="No status update has been posted yet."
        testId="status-update"
      />,
    );

    expect(screen.getByTestId('status-update-error')).toHaveTextContent('No work item matched.');
  });
});
