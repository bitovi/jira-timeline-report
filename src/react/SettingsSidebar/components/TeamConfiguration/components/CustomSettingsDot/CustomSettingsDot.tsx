import type { FC } from 'react';

import React from 'react';
import Tooltip from '@atlaskit/tooltip';

export const CUSTOM_SETTINGS_LABEL = 'Contains overrides';

/** Marks a team, or one of its tabs, that saves settings of its own rather than inheriting them all. */
const CustomSettingsDot: FC<{ className?: string }> = ({ className = '' }) => (
  // `span`, not the default `div`: a block wrapper inside a tab label breaks the line and the tab
  // truncates its label to make room.
  <Tooltip content={CUSTOM_SETTINGS_LABEL} tag="span">
    <span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-blue-600 ${className}`}>
      <span className="sr-only">{CUSTOM_SETTINGS_LABEL}</span>
    </span>
  </Tooltip>
);

export default CustomSettingsDot;
