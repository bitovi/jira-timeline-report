import type { FC } from 'react';

import React, { useState } from 'react';

import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';

export interface Resource {
  id: string;
  name: string;
}

export interface SelectCloudViewProps {
  isLoading: boolean;
  current?: Resource;
  alternates: Resource[];
  onSelectCloud: (id: string) => void;
}

// Pill styling — preserved verbatim from the old <select-cloud> StacheElement.
const pillClass = 'text-center inline-flex items-center bg-neutral-201 hover:bg-neutral-301 rounded px-3 py-1';

// The chevron that hints the pill is a dropdown trigger — copied from the old view.
const Chevron: FC = () => (
  <svg
    className="w-2.5 h-2.5 ms-2"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 10 6"
  >
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m1 1 4 4 4-4" />
  </svg>
);

/**
 * Presentational Jira site/cloud picker. Renders one of four states from pure
 * props — no data fetching, no providers:
 *
 * 1. Loading    — a `...` pill while resources are in flight.
 * 2. Switchable — alternates exist → a clickable pill (current site + chevron)
 *                 opening a dropdown of the other sites.
 * 3. Single     — no alternates but a current site → a static, non-interactive pill.
 * 4. Empty      — nothing to show → renders nothing.
 *
 * State precedence mirrors the original StacheElement view.
 */
const SelectCloudView: FC<SelectCloudViewProps> = ({ isLoading, current, alternates, onSelectCloud }) => {
  // Controlled so the menu doesn't fight can routing (mirrors SavedReportDropdown).
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={pillClass} data-testid="select-cloud-loading">
        {' '}
        ...{' '}
      </div>
    );
  }

  if (alternates.length) {
    return (
      <DropdownMenu
        isOpen={isOpen}
        onOpenChange={() => setIsOpen((prev) => !prev)}
        shouldRenderToParent
        trigger={({ triggerRef, isSelected, testId, ...props }) => (
          // isSelected/testId are Atlaskit-only trigger props — drop them so
          // they don't leak onto the native <button> as unknown DOM attributes.
          <button
            {...props}
            ref={triggerRef}
            className={`${pillClass} pl-2 hover:bg-gray-200`}
            data-testid="select-cloud-trigger"
          >
            {current?.name ? <span>{current.name}</span> : null}
            <Chevron />
          </button>
        )}
      >
        <DropdownItemGroup>
          {alternates.map((resource) => (
            <DropdownItem key={resource.id} onClick={() => onSelectCloud(resource.id)}>
              {resource.name}
            </DropdownItem>
          ))}
        </DropdownItemGroup>
      </DropdownMenu>
    );
  }

  if (current?.name) {
    return (
      <div className={`${pillClass} pl-2`} data-testid="select-cloud-single">
        {current.name}
      </div>
    );
  }

  return null;
};

export default SelectCloudView;
