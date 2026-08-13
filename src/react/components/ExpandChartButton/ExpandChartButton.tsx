import type { FC } from 'react';

import React from 'react';
import { IconButton } from '@atlaskit/button/new';
import FullscreenEnterIcon from '@atlaskit/icon/core/fullscreen-enter';
import FullscreenExitIcon from '@atlaskit/icon/core/fullscreen-exit';

interface ExpandChartButtonProps {
  expanded: boolean;
  onToggle: () => void;
}

const ExpandChartButton: FC<ExpandChartButtonProps> = ({ expanded, onToggle }) => (
  <IconButton
    appearance="subtle"
    spacing="compact"
    icon={expanded ? FullscreenExitIcon : FullscreenEnterIcon}
    label={expanded ? 'Collapse chart' : 'Expand chart'}
    onClick={onToggle}
  />
);

export default ExpandChartButton;
