import React, { FC, ReactNode } from 'react';

import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import ChevronRightIcon from '@atlaskit/icon/utility/chevron-right';
import { useRouteData } from '../../../hooks/useRouteData';

type IssueHierarchy = {
  name: string;
  hierarchyLevel: number;
};

const formatTitle = (rawTitle?: string) => {
  return rawTitle
    ?.split('-')
    .map((part) => part + 's')
    .join(' / ');
};

const useSelectedIssueType = () => {
  const [selectedIssueType, _setSelectedIssueType] = useRouteData<string>('selectedIssueType');
  const [issueHierarchy] = useRouteData<IssueHierarchy[] | null>('issueHierarchy');

  const setSelectedIssueType = (primaryType: string, secondaryType?: string) => {
    const newIssue = secondaryType ? 'Release-' + secondaryType : primaryType;
    _setSelectedIssueType(newIssue);
  };

  return {
    selectedIssueType,
    issueHierarchy,
    setSelectedIssueType,
  };
};

const SelectIssueTypeWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Report on</Label>
      {children}
    </div>
  );
};

const SelectIssueType: FC = () => {
  const { issueHierarchy, selectedIssueType, setSelectedIssueType } = useSelectedIssueType();

  const title = formatTitle(selectedIssueType);

  if (!issueHierarchy) {
    return (
      <SelectIssueTypeWrapper>
        <DropdownMenu trigger="Loading..." isLoading />
      </SelectIssueTypeWrapper>
    );
  }

  return (
    <SelectIssueTypeWrapper>
      <DropdownMenu trigger={title}>
        <DropdownItemGroup>
          {issueHierarchy.map((item) => (
            <DropdownItem key={item.name} onClick={() => setSelectedIssueType(item.name)}>
              {item.name + 's'}
            </DropdownItem>
          ))}
        </DropdownItemGroup>
        <DropdownItemGroup>
          <DropdownMenu
            placement="right-end"
            trigger={({ triggerRef, ...props }) => (
              <DropdownItem ref={triggerRef} elemAfter={<ChevronRightIcon label="open releases" />} {...props}>
                Releases
              </DropdownItem>
            )}
          >
            {issueHierarchy.map((item) => (
              <DropdownItem key={item.name} onClick={() => setSelectedIssueType('Release', item.name)}>
                {item.name + 's'}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </DropdownItemGroup>
      </DropdownMenu>
    </SelectIssueTypeWrapper>
  );
};

export default SelectIssueType;
