import type { FC, ReactNode } from 'react';

import React, { useId, useState } from 'react';
import ChevronRightIcon from '@atlaskit/icon/glyph/chevron-right';
import ChevronDownIcon from '@atlaskit/icon/glyph/chevron-down';

export interface TeamSectionProps {
  title: string;
  /** Rendered beside the title, outside the toggle button, so it can hold its own interactive element. */
  titleAddon?: ReactNode;
  startsOpen?: boolean;
  /** Holds the section open and disables the toggle — used while a search is active, so matches can't hide. */
  forceOpen?: boolean;
  children: ReactNode;
}

const TeamSection: FC<TeamSectionProps> = ({ title, titleAddon, startsOpen = true, forceOpen = false, children }) => {
  const [isToggledOpen, setIsToggledOpen] = useState(startsOpen);
  const isOpen = forceOpen || isToggledOpen;
  const contentId = useId();

  const Icon = isOpen ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="-ml-1 flex items-center text-left whitespace-nowrap text-xs font-semibold text-neutral-500"
          aria-expanded={isOpen}
          aria-controls={contentId}
          disabled={forceOpen}
          onClick={() => setIsToggledOpen(!isToggledOpen)}
        >
          <Icon label="" size="medium" />
          {title}
        </button>
        {titleAddon}
      </div>
      {isOpen && <div id={contentId}>{children}</div>}
    </div>
  );
};

export default TeamSection;
