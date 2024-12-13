import React, { type FC } from "react";

import DropdownMenu, { DropdownItem } from "@atlaskit/dropdown-menu";
import LinkButton from "../../../components/LinkButton";
import ChevronDown from "@atlaskit/icon/glyph/chevron-down";

const defaultPrimaryButtonClasses = "ps-4 pe-2 py-2 rounded-md";

interface ReportControlProps {
  hasSelectedReport?: boolean;
  isDirty?: boolean;
  updateSelectedReport?: () => void;
  openModal?: () => void;
  resetChanges?: () => void;
}

const ReportControls: FC<ReportControlProps> = ({
  hasSelectedReport = false,
  isDirty = false,
  updateSelectedReport = () => {},
  openModal = () => {},
  resetChanges = () => {},
}) => {
  if (!hasSelectedReport) return;

  if (!isDirty)
    return (
      <LinkButton className={defaultPrimaryButtonClasses} onClick={openModal}>
        Copy report
      </LinkButton>
    );

  return (
    <>
      <DropdownMenu
        trigger={({ triggerRef, isSelected, ...props }) => (
          <LinkButton
            ref={triggerRef}
            className={`flex items-center ${defaultPrimaryButtonClasses} ${
              isSelected ? "bg-blue-100" : ""
            }`}
            {...props}
          >
            Save report <ChevronDown label="open save report options" />
          </LinkButton>
        )}
      >
        <DropdownItem
          onClick={(event) => {
            event.stopPropagation();
            updateSelectedReport();
          }}
        >
          Save changes
        </DropdownItem>
        <DropdownItem
          onClick={(event) => {
            event.stopPropagation();
            openModal();
          }}
        >
          Save new report
        </DropdownItem>
      </DropdownMenu>

      <LinkButton className="text-neutral-500" onClick={resetChanges}>
        Reset changes
      </LinkButton>
    </>
  );
};

export default ReportControls;