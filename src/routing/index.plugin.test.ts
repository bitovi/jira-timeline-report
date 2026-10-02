import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPluginLinkBuilder } from './index.plugin';

const APP_KEY = 'bitovi.status-report';
const BASE = `https://example.atlassian.net/plugins/servlet/ac/${APP_KEY}/main`;

const stubJiraHref = (href: string) => {
  vi.stubGlobal('AP', { history: { getState: () => ({ href }) } });
};

describe('createPluginLinkBuilder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes params with the app key and carries project context forward', () => {
    stubJiraHref(`${BASE}?ac.${APP_KEY}.report=old&project.key=ABC&project.id=10911`);

    const link = createPluginLinkBuilder(APP_KEY)('report=abc-123');
    const params = new URL(link).searchParams;

    expect(link.startsWith(BASE + '?')).toBe(true);
    expect(params.get(`ac.${APP_KEY}.report`)).toBe('abc-123');
    expect(params.get('project.key')).toBe('ABC');
    expect(params.get('project.id')).toBe('10911');
  });

  it('builds a link without project context when Jira did not provide it', () => {
    stubJiraHref(`${BASE}?ac.${APP_KEY}.report=old`);

    const link = createPluginLinkBuilder(APP_KEY)('report=abc-123');
    const params = new URL(link).searchParams;

    expect(params.get(`ac.${APP_KEY}.report`)).toBe('abc-123');
    expect(params.has('project.key')).toBe(false);
    expect(params.has('project.id')).toBe(false);
  });

  it('builds a link when the Jira URL has no query string', () => {
    stubJiraHref(BASE);

    expect(createPluginLinkBuilder(APP_KEY)('report=abc-123')).toBe(`${BASE}?ac.${APP_KEY}.report=abc-123`);
  });

  it('still requires an app key', () => {
    stubJiraHref(BASE);

    expect(() => createPluginLinkBuilder()('report=abc-123')).toThrow('App key is required');
  });
});
