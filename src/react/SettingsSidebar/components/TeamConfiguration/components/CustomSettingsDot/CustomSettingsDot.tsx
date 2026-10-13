import type { FC } from 'react';

import React from 'react';

const LABEL = 'Has custom settings';

/** Marks a team, or one of its tabs, that saves settings of its own rather than inheriting them all. */
const CustomSettingsDot: FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-blue-600 ${className}`} title={LABEL}>
    <span className="sr-only">{LABEL}</span>
  </span>
);

export default CustomSettingsDot;
