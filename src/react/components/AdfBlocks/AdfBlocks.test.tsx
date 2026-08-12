import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AdfBlocks } from './AdfBlocks';
import { adfToBlocks } from './adfToBlocks';

/** Render straight from ADF, the way both callers do — walker and renderer as one path. */
const renderAdf = (...content: unknown[]) =>
  render(<AdfBlocks blocks={adfToBlocks({ type: 'doc', version: 1, content })} />);

const marked = (text: string, ...marks: unknown[]) => ({ type: 'text', text, marks });
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });

describe('AdfBlocks', () => {
  it('renders nothing for no blocks', () => {
    const { container } = render(<AdfBlocks blocks={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('puts the caller’s classes on the wrapper', () => {
    const { container } = render(<AdfBlocks blocks={adfToBlocks('hello')} className="prose prose-sm prose-p:my-1" />);

    expect(container.firstElementChild?.className).toBe('prose prose-sm prose-p:my-1');
  });

  // These are the marks a Jira comment actually uses, and the reason blocks carry runs not strings.
  describe('marks', () => {
    it('renders bold as <strong>', () => {
      renderAdf(paragraph(marked('bold', { type: 'strong' })));

      expect(screen.getByText('bold').tagName).toBe('STRONG');
    });

    it('renders italic as <em>', () => {
      renderAdf(paragraph(marked('italic', { type: 'em' })));

      expect(screen.getByText('italic').tagName).toBe('EM');
    });

    it('renders underline as <u>', () => {
      renderAdf(paragraph(marked('under', { type: 'underline' })));

      expect(screen.getByText('under').tagName).toBe('U');
    });

    it('renders strikethrough as <s>', () => {
      renderAdf(paragraph(marked('struck', { type: 'strike' })));

      expect(screen.getByText('struck').tagName).toBe('S');
    });

    it('renders inline code as <code>', () => {
      renderAdf(paragraph(marked('npm ci', { type: 'code' })));

      expect(screen.getByText('npm ci').tagName).toBe('CODE');
    });

    it('nests several marks on one run', () => {
      renderAdf(paragraph(marked('both', { type: 'strong' }, { type: 'underline' })));

      const strong = screen.getByText('both');

      expect(strong.tagName).toBe('STRONG');
      expect(strong.closest('u')).toBeInTheDocument();
    });

    it('renders a link that cannot reach back into this tab', () => {
      renderAdf(paragraph(marked('JIRA-412', { type: 'link', attrs: { href: 'https://example.com/JIRA-412' } })));

      const link = screen.getByRole('link', { name: 'JIRA-412' });

      expect(link).toHaveAttribute('href', 'https://example.com/JIRA-412');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders a bold link as one clickable, bold run', () => {
      renderAdf(
        paragraph(marked('both', { type: 'strong' }, { type: 'link', attrs: { href: 'https://example.com' } })),
      );

      expect(screen.getByText('both').closest('a')).toBeInTheDocument();
    });

    // The walker drops the href; this asserts no anchor survives to carry it.
    it('renders a javascript: link as plain text, with no anchor', () => {
      renderAdf(paragraph(marked('click', { type: 'link', attrs: { href: 'javascript:alert(1)' } })));

      expect(screen.getByText('click')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('line breaks', () => {
    it('renders a hard break as <br>', () => {
      const { container } = renderAdf(
        paragraph({ type: 'text', text: 'line one' }, { type: 'hardBreak' }, { type: 'text', text: 'line two' }),
      );

      expect(container.querySelectorAll('br')).toHaveLength(1);
      expect(container.querySelector('p')?.textContent).toBe('line oneline two');
    });

    it('renders separate paragraphs as separate <p> elements', () => {
      const { container } = renderAdf(
        paragraph({ type: 'text', text: 'first' }),
        paragraph({ type: 'text', text: 'second' }),
      );

      expect(container.querySelectorAll('p')).toHaveLength(2);
    });
  });

  describe('blocks', () => {
    it('renders a heading at its own level', () => {
      renderAdf({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Status' }] });

      expect(screen.getByRole('heading', { level: 3, name: 'Status' })).toBeInTheDocument();
    });

    it('clamps an out-of-range heading level to a real tag', () => {
      renderAdf({ type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'Deep' }] });

      expect(screen.getByRole('heading', { level: 6, name: 'Deep' })).toBeInTheDocument();
    });

    it('keeps marks inside a list item', () => {
      renderAdf({
        type: 'bulletList',
        content: [{ type: 'listItem', content: [paragraph(marked('urgent', { type: 'strong' }))] }],
      });

      expect(screen.getByText('urgent').tagName).toBe('STRONG');
      expect(screen.getByText('urgent').closest('li')).toBeInTheDocument();
    });

    it('starts an ordered list at its own number', () => {
      const { container } = renderAdf({
        type: 'orderedList',
        attrs: { order: 4 },
        content: [{ type: 'listItem', content: [paragraph({ type: 'text', text: 'Fourth' })] }],
      });

      expect(container.querySelector('ol')).toHaveAttribute('start', '4');
    });

    it('renders a code block as preformatted text', () => {
      const { container } = renderAdf({ type: 'codeBlock', content: [{ type: 'text', text: 'kubectl get pods' }] });

      expect(container.querySelector('pre code')?.textContent).toBe('kubectl get pods');
    });
  });
});
