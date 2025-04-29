import React, { FC } from "react";
import { useCanObservable } from "../hooks/useCanObservable";
import { value } from "../../can";
import routeData from "../../canjs/routing/route-data";

import { Label } from "@atlaskit/form";
import DropdownMenu, { DropdownItem, DropdownItemGroup } from "@atlaskit/dropdown-menu";
import ChevronRightIcon from "@atlaskit/icon/utility/chevron-right";

type IssueHierarchy = {
  name: string;
  hierarchyLevel: number;
};

const formatTitle = (rawTitle?: string) => {
  return rawTitle
    ?.split("-")
    .map((part) => part + "s")
    .join(" / ");
};

const useSelectedIssueType = () => {
  const selectedIssueType = useCanObservable<string>(value.from(routeData, "selectedIssueType"));
  const issueHierarchy = useCanObservable<IssueHierarchy[] | null>(
    value.from(routeData, "issueHierarchy")
  );

  const setSelectedIssueType = (primaryType: string, secondaryType?: string) => {
    const newIssue = secondaryType ? "Release-" + secondaryType : primaryType;

    // @ts-expect-error
    routeData.selectedIssueType = newIssue;
  };

  return {
    selectedIssueType,
    issueHierarchy,
    setSelectedIssueType,
  };
};

const SelectedIssueType: FC = () => {
  const { issueHierarchy, selectedIssueType, setSelectedIssueType } = useSelectedIssueType();

  const title = formatTitle(selectedIssueType);

  if (!issueHierarchy) {
    return (
      <div className="flex flex-col items-start">
        <Label htmlFor="">Report on</Label>
        <DropdownMenu trigger="Loading..." isLoading />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Report on</Label>
      <DropdownMenu trigger={title}>
        <DropdownItemGroup>
          {issueHierarchy.map((item) => (
            <DropdownItem key={item.name} onClick={() => setSelectedIssueType(item.name)}>
              {item.name + "s"}
            </DropdownItem>
          ))}
        </DropdownItemGroup>
        <DropdownItemGroup>
          <DropdownMenu
            placement="right-end"
            trigger={({ triggerRef, ...props }) => (
              <DropdownItem
                ref={triggerRef}
                elemAfter={<ChevronRightIcon label="open releases" />}
                {...props}
              >
                Releases
              </DropdownItem>
            )}
          >
            {issueHierarchy.map((item) => (
              <DropdownItem
                key={item.name}
                onClick={() => setSelectedIssueType("Release", item.name)}
              >
                {item.name + "s"}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </DropdownItemGroup>
      </DropdownMenu>
    </div>
  );
};

export default SelectedIssueType;
