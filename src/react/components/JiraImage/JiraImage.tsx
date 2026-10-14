import React, { useEffect, useState } from 'react';

import { resolveJiraImageSrc } from '../../../shared/jira-image-src';

import type { ImgHTMLAttributes } from 'react';

/**
 * The loadable `src` for a Jira image URL on the current host (see `shared/jira-image-src.ts`).
 * `undefined` while a host-side fetch is still in flight — render nothing rather than the raw URL,
 * which on Forge would just 401.
 */
export function useJiraImageSrc(url: string | undefined): string | undefined {
  const initial = url ? resolveJiraImageSrc(url) : undefined;
  const [src, setSrc] = useState<string | undefined>(typeof initial === 'string' ? initial : undefined);

  useEffect(() => {
    if (!url) {
      setSrc(undefined);
      return;
    }

    const resolved = resolveJiraImageSrc(url);

    if (typeof resolved === 'string') {
      setSrc(resolved);
      return;
    }

    let cancelled = false;
    setSrc(undefined);
    void resolved.then((next) => {
      if (!cancelled) setSrc(next);
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return src;
}

export type JiraImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string | undefined };

/** An `<img>` for a Jira-hosted image (issue-type icons). Use it instead of a bare `<img src={iconUrl}>`. */
export const JiraImage: React.FC<JiraImageProps> = ({ src, ...rest }) => {
  const resolved = useJiraImageSrc(src);

  // Keeps the box the same size while the icon loads, when the caller sized it.
  if (!resolved)
    return rest.width || rest.height ? (
      <span className={rest.className} style={{ display: 'inline-block', width: rest.width, height: rest.height }} />
    ) : null;

  return <img src={resolved} {...rest} />;
};

export default JiraImage;
