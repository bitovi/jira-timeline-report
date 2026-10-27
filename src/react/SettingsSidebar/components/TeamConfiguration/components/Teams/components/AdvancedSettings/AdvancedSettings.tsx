import type { FC, ReactNode } from 'react';

import React, { useId, useState } from 'react';
import ChevronRightIcon from '@atlaskit/icon/glyph/chevron-right';
import ChevronDownIcon from '@atlaskit/icon/glyph/chevron-down';

/** The settings most teams never change — field mappings and spread effort — collapsed by default. */
const AdvancedSettings: FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  const Icon = isOpen ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div className="mt-4">
      <button
        type="button"
        className="flex w-full items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon label="" size="medium" />
        Advanced settings
        <span aria-hidden className="ml-1 h-px flex-1 bg-slate-200" />
      </button>
      {isOpen && (
        <div id={contentId} className="flex flex-col gap-2">
          {children}
        </div>
      )}
    </div>
  );
};

export default AdvancedSettings;
