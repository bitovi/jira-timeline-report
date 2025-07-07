import React, { FC, ReactNode } from 'react';

import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import ChevronRightIcon from '@atlaskit/icon/utility/chevron-right';
import { useRouteData } from '../../../hooks/useRouteData';

type IssueHierarchy = {
  name: string;
  hierarchyLevel: number;
};

const formatTitle = (rawTitle: string, issueHierarchy: IssueHierarchy[] | null) => {
  if (!rawTitle) {
    return '';
  } else if (rawTitle.startsWith('Release-')) {
    return rawTitle
      ?.split('-')
      .map((part) => part + 's')
      .join(' / ');
  } else {
    return rawTitle + 's';
  }
};

const useSelectedIssueType = () => {
  const [selectedIssueType, setSelectedIssueType] = useRouteData<string>('selectedIssueType');
  const [issueHierarchy] = useRouteData<IssueHierarchy[] | null>('issueHierarchy');

  const handleSelectedIssueTypeChange = (primaryType: string, secondaryType?: string) => {
    const newIssue = secondaryType ? 'Release-' + secondaryType : primaryType;
    setSelectedIssueType(newIssue);
  };

  return {
    selectedIssueType,
    issueHierarchy,
    handleSelectedIssueTypeChange,
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
  const { issueHierarchy, selectedIssueType, handleSelectedIssueTypeChange } = useSelectedIssueType();

  const title = formatTitle(selectedIssueType, issueHierarchy);

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
            <DropdownItem key={item.name} onClick={() => handleSelectedIssueTypeChange(item.name)}>
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
              <DropdownItem key={item.name} onClick={() => handleSelectedIssueTypeChange('Release', item.name)}>
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
