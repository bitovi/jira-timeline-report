import React, { type FC } from 'react';

import DropdownMenu, { DropdownItem } from '@atlaskit/dropdown-menu';
import LinkButton from '../../../components/LinkButton';
import ChevronDown from '@atlaskit/icon/glyph/chevron-down';

const defaultPrimaryButtonClasses = 'ps-4 pe-2 py-2 rounded-md';

interface ReportControlProps {
  hasSelectedReport?: boolean;
  isDirty?: boolean;
  updateSelectedReport?: () => void;
  openModal?: () => void;
  resetChanges?: () => void;
  detachReport?: () => void;
}

const ReportControls: FC<ReportControlProps> = ({
  hasSelectedReport,
  isDirty,
  updateSelectedReport,
  openModal,
  resetChanges,
  detachReport,
}) => {
  if (!hasSelectedReport) return;

  /**
   * One menu holding every action for the open report, rather than a different control per state.
   *
   * The trigger is named for the thing it acts on rather than for an action, because no single
   * action is present in both states: with no edits there is nothing to save and nothing to reset.
   * Naming it "Save report" would promise an item the clean menu doesn't have, and naming it for
   * whichever action happens to be first would make the trigger repeat its own first item.
   */
  return (
    <DropdownMenu
      trigger={({ triggerRef, isSelected, ...props }) => (
        <LinkButton
          ref={triggerRef}
          className={`flex items-center ${defaultPrimaryButtonClasses} ${isSelected ? 'bg-blue-100' : ''}`}
          {...props}
        >
          Report <ChevronDown label="open report options" />
        </LinkButton>
      )}
    >
      {isDirty ? (
        <DropdownItem
          onClick={() => {
            updateSelectedReport?.();
          }}
        >
          Save changes
        </DropdownItem>
      ) : null}
      {/* Same action — `openModal` — under two names, because only one of them is honest. With no
          edits the new report really is a copy of the open one; with edits it is the settings on
          screen, which the original doesn't have. */}
      <DropdownItem
        onClick={() => {
          openModal?.();
        }}
      >
        {isDirty ? 'Save new report' : 'Copy report'}
      </DropdownItem>
      {isDirty ? (
        <DropdownItem
          onClick={() => {
            resetChanges?.();
          }}
        >
          Reset changes
        </DropdownItem>
      ) : null}
      {/* Offered in both states, unlike the two above: detaching is about the *link* to the saved
          report, which is there whether or not the settings have been edited. */}
      <DropdownItem
        onClick={() => {
          detachReport?.();
        }}
      >
        Detach
      </DropdownItem>
    </DropdownMenu>
  );
};

export default ReportControls;
