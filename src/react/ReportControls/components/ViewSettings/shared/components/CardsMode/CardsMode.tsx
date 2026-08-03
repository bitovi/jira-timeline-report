import type { FC } from 'react';
import React, { useId } from 'react';
import Select from '@atlaskit/select';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { useRouteData } from '../../../../../../hooks/useRouteData';

/**
 * The two views the Cards report offers. The same pair the legacy Secondary Report Type selector
 * offered, minus its "None" option — turning Cards off is now switching report type.
 * See spec/018-card-report/alt-plan.md.
 */
const cardsModes = [
  { label: 'Status', value: 'status' },
  { label: 'Work Breakdown', value: 'breakdown' },
];

const useCardsMode = () => {
  const [selectedCardsMode, setSelectedCardsMode] = useRouteData<string>('cardsMode');

  return {
    cardsModes,
    selectedCardsMode: cardsModes.find(({ value }) => value === selectedCardsMode),
    setSelectedCardsMode,
  };
};

const CardsMode: FC = () => {
  const id = useId();
  const { cardsModes, selectedCardsMode, setSelectedCardsMode } = useCardsMode();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Cards Mode</label>
      </VisuallyHidden>
      <Select
        id={id}
        className="flex-1"
        options={cardsModes}
        value={selectedCardsMode}
        onChange={(option) => setSelectedCardsMode(option?.value ?? '')}
      />
    </div>
  );
};

export default CardsMode;
