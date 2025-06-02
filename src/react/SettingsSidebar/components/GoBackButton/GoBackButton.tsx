import type { FC } from 'react';

import React from 'react';
import SidebarButton from '../../../components/SidebarButton';

interface GoBackButtonProps {
  onGoBack: () => void;
}

export const GoBackButton: FC<GoBackButtonProps> = ({ onGoBack }) => (
  <SidebarButton onClick={onGoBack}>
    <img src="/images/go-back.svg" aria-hidden /> Go back
  </SidebarButton>
);

export default GoBackButton;
