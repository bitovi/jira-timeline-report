import type { FC } from "react";
import type { LinkBuilder } from "../../routing/common";

import React from "react";
import { JiraProvider } from "../services/jira";
import { Link, RoutingProvider } from "../services/routing";
import routeData from "../../canjs/routing/route-data";
import DropdownMenu, { DropdownItem, DropdownItemGroup } from "@atlaskit/dropdown-menu";
import { useCanObservable } from "../hooks/useCanObservable";
import { value } from "../../can";
import { Label } from "@atlaskit/form";
import { useQueryParams } from "../hooks/useQueryParams";
import { pushStateObservable } from "../../canjs/routing/state-storage";

import ChevronRightIcon from "@atlaskit/icon/utility/chevron-right";
import LinkButton from "../components/LinkButton";

interface ControlsProps {}

type IssueHierarchy = {
  name: string;
  hierarchyLevel: number;
};

const useIssueHierarchy = () => {
  const issueHierarchy = useCanObservable<IssueHierarchy[] | null>(
    value.from(routeData, "issueHierarchy")
  );

  console.log(issueHierarchy);

  return issueHierarchy;
};

const Controls: FC<ControlsProps> = () => {
  const issueHierarchy = useIssueHierarchy();
  const { queryParams } = useQueryParams(pushStateObservable);
  const selectedIssueType = queryParams.get("selectedIssueType");

  const rawTitle = selectedIssueType ?? issueHierarchy?.[0].name ?? "Loading";
  const title = rawTitle.replace("-", " / ");

  if (!issueHierarchy) {
    return <DropdownMenu trigger={title} isLoading />;
  }

  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Report on</Label>
      <DropdownMenu trigger={title}>
        <DropdownItemGroup>
          {issueHierarchy.map((item) => (
            <DropdownItem
              key={item.name}
              // @ts-expect-error types for component overrides on ADS don't work
              component={Link}
              href={"?selectedIssueType=" + item.name}
            >
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
                // @ts-expect-error types for component overrides on ADS don't work
                component={Link}
                href={"?selectedIssueType=Release-" + item.name}
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

interface ControlsWrapperProps {
  linkBuilder: LinkBuilder;
}

export default function ControlsWrapper({ linkBuilder, ...props }: ControlsWrapperProps) {
  return (
    <JiraProvider jira={routeData.jiraHelpers}>
      <RoutingProvider routing={{ linkBuilder }}>
        <Controls {...props} />
      </RoutingProvider>
    </JiraProvider>
  );
}
