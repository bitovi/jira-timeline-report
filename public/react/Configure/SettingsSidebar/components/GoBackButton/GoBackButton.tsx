import type { FC } from "react";

import React from "react";
import SidebarButton from "../../../../components/SidebarButton";

interface GoBackButtonProps {
  hideSettings: () => void;
}

export const GoBackButton: FC<GoBackButtonProps> = ({ hideSettings }) => (
  <SidebarButton onClick={hideSettings}>
    <img src="/images/go-back.svg" aria-hidden /> Go back
  </SidebarButton>
);

export default GoBackButton;
