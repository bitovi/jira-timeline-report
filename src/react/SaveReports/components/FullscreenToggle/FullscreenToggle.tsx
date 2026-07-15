import type { FC } from 'react';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@atlaskit/button/new';
import FullscreenEnterIcon from '@atlaskit/icon/core/fullscreen-enter';
import FullscreenExitIcon from '@atlaskit/icon/core/fullscreen-exit';

import { useRouteData } from '../../../hooks/useRouteData';

// Hides the top nav, left sidebar, and report chrome via a `fullscreen-mode` class on <body>
// (see src/css/fullscreen.css). Backed by a bookmarkable `fullscreen` route param rather than
// the native Fullscreen API, since native fullscreen can't be restored from a bookmark/reload.
const FullscreenToggle: FC = () => {
  const [isFullscreen, setFullscreen] = useRouteData<boolean>('fullscreen');

  useEffect(() => {
    document.body.classList.toggle('fullscreen-mode', !!isFullscreen);

    // Hiding/showing the chrome changes where `.fullish-vh` sits on the page, but its height is
    // only recalculated on `load`/`resize` (see updateFullishHeightSection in timeline-report.js).
    // Nudge it to recompute now that the layout has changed.
    window.dispatchEvent(new Event('resize'));

    return () => {
      document.body.classList.remove('fullscreen-mode');
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, setFullscreen]);

  const button = (
    <IconButton
      icon={isFullscreen ? FullscreenExitIcon : FullscreenEnterIcon}
      label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      onClick={() => setFullscreen(!isFullscreen)}
    />
  );

  // The rest of #saved-reports (this button's natural DOM parent) is hidden by
  // fullscreen.css, so portal the button to <body> to keep it reachable to exit.
  // `.print-hidden` (print.css) keeps this off the printed page in both cases — there's no
  // reason to show a fullscreen toggle on paper.
  if (isFullscreen) {
    return createPortal(<div className="fixed top-2 right-2 z-50 print-hidden">{button}</div>, document.body);
  }

  return <span className="contents print-hidden">{button}</span>;
};

export default FullscreenToggle;
