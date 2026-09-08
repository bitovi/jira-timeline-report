import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { interceptExternalLinkClicks, openExternal, resetExternalOpener, setExternalOpener } from './open-external';

const anchor = (attrs: Record<string, string>, text = 'link') => {
  const el = document.createElement('a');
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  el.textContent = text;
  document.body.append(el);

  return el;
};

describe('openExternal', () => {
  afterEach(() => {
    resetExternalOpener();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('opens a new tab by default — the behaviour web and Connect keep', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openExternal('https://example.com/browse/TEST-1');

    expect(open).toHaveBeenCalledWith('https://example.com/browse/TEST-1', '_blank', 'noopener,noreferrer');
  });

  it('uses the installed opener instead, once a host provides one', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const forgeOpener = vi.fn();
    setExternalOpener(forgeOpener);

    openExternal('https://example.com/browse/TEST-1');

    expect(forgeOpener).toHaveBeenCalledWith('https://example.com/browse/TEST-1');
    expect(open).not.toHaveBeenCalled();
  });
});

describe('interceptExternalLinkClicks', () => {
  let opener: ReturnType<typeof vi.fn>;
  let teardown: () => void;

  beforeEach(() => {
    opener = vi.fn();
    setExternalOpener(opener);
    teardown = interceptExternalLinkClicks();
  });

  afterEach(() => {
    teardown();
    resetExternalOpener();
    document.body.innerHTML = '';
  });

  it('routes a target="_blank" click through the opener', () => {
    const el = anchor({ href: 'https://site.atlassian.net/browse/TEST-1', target: '_blank' });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    expect(opener).toHaveBeenCalledWith('https://site.atlassian.net/browse/TEST-1');
    expect(event.defaultPrevented).toBe(true);
  });

  it('catches a click on an element nested inside the anchor', () => {
    const el = anchor({ href: 'https://site.atlassian.net/browse/TEST-2', target: '_blank' }, '');
    const span = document.createElement('span');
    el.append(span);

    span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(opener).toHaveBeenCalledWith('https://site.atlassian.net/browse/TEST-2');
  });

  it('leaves SPA links alone — they have no target, and Link.tsx owns them', () => {
    const el = anchor({ href: '?report=abc' });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    expect(opener).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves in-page fragments alone', () => {
    const el = anchor({ href: '#section', target: '_blank' });

    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(opener).not.toHaveBeenCalled();
  });

  it('does not double-handle a click a component already handled', () => {
    const el = anchor({ href: 'https://site.atlassian.net/browse/TEST-3', target: '_blank' });
    el.addEventListener('click', (event) => event.preventDefault());

    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(opener).not.toHaveBeenCalled();
  });

  it('stops intercepting after teardown', () => {
    teardown();
    const el = anchor({ href: 'https://site.atlassian.net/browse/TEST-4', target: '_blank' });

    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(opener).not.toHaveBeenCalled();
  });
});
