import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createForgeImageResolver, toJiraRestPath } from './forge-image-loader';

vi.mock('@forge/bridge', () => ({ requestJira: vi.fn() }));

const GATEWAY_ICON =
  'https://api.atlassian.com/ex/jira/abc-123/rest/api/2/universal_avatar/view/type/issuetype/avatar/10322?size=medium';
const ICON_PATH = '/rest/api/2/universal_avatar/view/type/issuetype/avatar/10322?size=medium';

const png = () => new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), { status: 200 });

describe('toJiraRestPath', () => {
  it('strips the API-gateway prefix requestJira adds itself', () => {
    expect(toJiraRestPath(GATEWAY_ICON)).toBe(ICON_PATH);
  });

  it('keeps a site URL that is already a REST path', () => {
    expect(
      toJiraRestPath('https://example.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/1'),
    ).toBe('/rest/api/2/universal_avatar/view/type/issuetype/avatar/1');
  });

  it('has no path for non-REST or unparseable URLs', () => {
    expect(toJiraRestPath('https://example.atlassian.net/images/icons/issuetypes/epic.svg')).toBeNull();
    expect(toJiraRestPath('not a url')).toBeNull();
  });
});

describe('createForgeImageResolver', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:icon-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches an avatar through requestJira and returns a blob URL', async () => {
    const request = vi.fn().mockResolvedValue(png());
    const resolve = createForgeImageResolver(request);

    await expect(resolve(GATEWAY_ICON)).resolves.toBe('blob:icon-1');
    expect(request).toHaveBeenCalledWith(ICON_PATH);
  });

  it('fetches each URL once and answers synchronously once it has', async () => {
    const request = vi.fn().mockResolvedValue(png());
    const resolve = createForgeImageResolver(request);

    await Promise.all([resolve(GATEWAY_ICON), resolve(GATEWAY_ICON)]);

    expect(request).toHaveBeenCalledTimes(1);
    expect(resolve(GATEWAY_ICON)).toBe('blob:icon-1');
  });

  it('falls back to the original URL when the fetch fails, without retrying', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const resolve = createForgeImageResolver(request);

    await expect(resolve(GATEWAY_ICON)).resolves.toBe(GATEWAY_ICON);
    expect(resolve(GATEWAY_ICON)).toBe(GATEWAY_ICON);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('leaves non-avatar URLs alone', () => {
    const request = vi.fn();
    const resolve = createForgeImageResolver(request);
    const builtin = 'https://example.atlassian.net/images/icons/issuetypes/epic.svg';

    expect(resolve(builtin)).toBe(builtin);
    expect(request).not.toHaveBeenCalled();
  });
});
