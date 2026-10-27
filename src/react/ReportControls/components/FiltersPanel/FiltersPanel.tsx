import type { FC, ReactNode } from 'react';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button, { IconButton } from '@atlaskit/button/new';
import CrossIcon from '@atlaskit/icon/glyph/cross';

import FilterTabs, { FILTER_TAB_PANEL_ID, filterTabId } from './FilterTabs';
import FilterTabBody from './FilterTabBody';
import { useFilterTabs } from '../Filters/hooks/useFilterTabs';
import type { FilterTab } from '../Filters/hooks/useFilterTabs';
import type { MinimalLevelIssue } from '../Filters/hooks/useLevelOptions';
import type { CanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import routeData from '../../../../canjs/routing/route-data';
import { ALL_LEVELS } from '../../../../jira/rollup/filter-rows/level-filters';

export interface FiltersPanelProps {
  /** All rolled-up issues/releases — Rollup Status and Issue Type options come from it. */
  rolledupAndRolledBackIssuesAndReleasesObs?: CanObservable<MinimalLevelIssue[]>;
}

/**
 * Every param that holds a filter. Clear all filters resets the legacy ones too, or their
 * fallbacks in `resolveLevelFilters` (and `effectiveFilterRows`) would bring the old filters back.
 */
const CLEARED_FILTER_PARAMS = {
  levelFilters: {},
  filterRows: [],
  statusesToShow: [],
  statusesToRemove: [],
  hideUnknownInitiatives: false,
  scatterDateRangeStart: '',
  scatterDateRangeEnd: '',
  releasesToShow: [],
  showOnlySemverReleases: false,
  cardsChildFilterRows: [],
};

export const clearAllFilters = () => {
  for (const [key, value] of Object.entries(CLEARED_FILTER_PARAMS)) {
    (routeData as unknown as Record<string, unknown>)[key] = value;
  }
};

export interface FiltersPanelViewProps {
  tabs: FilterTab[];
  renderTab: (tab: FilterTab) => ReactNode;
  onClearAll: () => void;
  defaultOpen?: boolean;
}

/**
 * The Filters side panel (spec/043-filters-redesign): a trigger with the total active-filter count,
 * and a panel with one tab per hierarchy level plus All items. Edits apply live, so Done and X only
 * close it. Presentation only; {@link FiltersPanel} connects it to route data.
 *
 * Portaled to `document.body` so it can sit over the whole report. A portal keeps React context, so
 * the tab bodies still see the providers `Filters` wraps it in.
 */
/** Matches the settings sidebar's slide (`AnimatedSidebar`). */
const SLIDE_MS = 300;

export const FiltersPanelView: FC<FiltersPanelViewProps> = ({ tabs, renderTab, onClearAll, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  // The panel stays mounted while it slides out, and mounts off-screen before it slides in.
  const [isMounted, setIsMounted] = useState(defaultOpen);
  const [isShown, setIsShown] = useState(defaultOpen);
  const [selectedKey, setSelectedKey] = useState(ALL_LEVELS);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedTab = tabs.find(({ key }) => key === selectedKey) ?? tabs[0];
  const total = tabs.reduce((sum, { count }) => sum + count, 0);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      return;
    }
    setIsShown(false);
    const id = setTimeout(() => setIsMounted(false), SLIDE_MS);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMounted) {
      return;
    }
    // One frame at the off-screen position first, so the browser has something to transition from.
    const id = requestAnimationFrame(() => setIsShown(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen, isMounted]);

  useEffect(() => {
    if (!isOpen || !isMounted) {
      return;
    }
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      // A Select menu handles its own Escape first; only close when nothing else consumed it.
      if (event.key === 'Escape' && !event.defaultPrevented) {
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isMounted]);

  return (
    <>
      <Button ref={triggerRef} isSelected={isOpen} onClick={() => setIsOpen((open) => !open)}>
        <span className="flex items-center gap-2">
          Filters
          {total > 0 && (
            <span className="rounded-full bg-blue-400 px-1.5 text-xs font-semibold text-white">{total}</span>
          )}
        </span>
      </Button>
      {isMounted &&
        createPortal(
          <div className="print-hidden">
            <div
              className={`fixed inset-0 z-50 bg-neutral-800/20 transition-opacity duration-300 motion-reduce:transition-none ${
                isShown ? 'opacity-100' : 'opacity-0'
              }`}
              data-testid="filters-panel-backdrop"
              onClick={close}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={`fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col bg-white shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
                isShown ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="flex items-center justify-between px-6 pb-2 pt-4">
                <h2 id={titleId} className="text-lg font-semibold text-neutral-800">
                  Filters
                </h2>
                <IconButton ref={closeRef} appearance="subtle" icon={CrossIcon} label="Close filters" onClick={close} />
              </div>
              <FilterTabs tabs={tabs} selectedKey={selectedTab.key} onSelect={setSelectedKey} />
              <div
                role="tabpanel"
                id={FILTER_TAB_PANEL_ID}
                aria-labelledby={filterTabId(selectedTab.key)}
                className="flex-1 overflow-y-auto px-6 py-5"
              >
                <React.Fragment key={selectedTab.key}>{renderTab(selectedTab)}</React.Fragment>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-41 px-6 py-3">
                <Button appearance="subtle" isDisabled={total === 0} onClick={onClearAll}>
                  Clear all filters
                </Button>
                <Button appearance="primary" onClick={close}>
                  Done
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

/** {@link FiltersPanelView} over route data, behind the `filtersPanel` feature. */
const FiltersPanel: FC<FiltersPanelProps> = ({ rolledupAndRolledBackIssuesAndReleasesObs }) => (
  <FiltersPanelView
    tabs={useFilterTabs()}
    onClearAll={clearAllFilters}
    renderTab={(tab) => (
      <FilterTabBody tab={tab} rolledupAndRolledBackIssuesAndReleasesObs={rolledupAndRolledBackIssuesAndReleasesObs} />
    )}
  />
);

export default FiltersPanel;
