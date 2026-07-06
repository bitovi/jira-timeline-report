import React from 'react';
import type { Card, Density, IssueClickHandler, SecondaryReportMode } from '../../types';
import { fontSizeClass, getStatusColorClass } from '../../helpers';
import type { SwatchSize } from '../StatusSwatch';
import { StatusColumnBody } from '../StatusColumnBody';
import { StatusMatrixBody } from '../StatusMatrixBody';

export interface WorkBreakdownCardProps {
  /** The card view model. */
  card: Card;
  /** Which body to render. */
  mode: SecondaryReportMode;
  /** Board density tier — sizes the swatches and text. */
  density: Density;
  /** Click handler for the header + child rows (opens the issue tooltip). */
  onIssueClick?: IssueClickHandler;
}

const swatchSizeFor = (density: Density): SwatchSize => (density === 'high' || density === 'absurd' ? 'sm' : 'md');

/**
 * The shared card shell: a colored header bubble (rollup status) over a body chosen by `mode` —
 * the single status column (`status`) or the work-type matrix (`breakdown`). The shell does not
 * know how a body draws itself; it only picks which body to render.
 */
export const WorkBreakdownCard: React.FC<WorkBreakdownCardProps> = ({ card, mode, density, onIssueClick }) => {
  const size = swatchSizeFor(density);
  const childCount = mode === 'status' ? card.statusRows.length : card.matrixRows.length;
  const bodyFontSize = fontSizeClass(density, childCount);
  const headerFontSize = fontSizeClass(density, 0);

  return (
    <div className="grow basis-56 min-w-[210px] max-w-[320px] rounded border border-neutral-40 overflow-hidden bg-white">
      <div
        className={`cursor-pointer rounded-t px-2.5 py-1.5 font-semibold ${getStatusColorClass(card.status)} ${headerFontSize}`}
        title={card.title}
        onClick={(event) => onIssueClick?.(event, card.issue)}
      >
        {card.title}
      </div>
      {mode === 'status' ? (
        <StatusColumnBody card={card} size={size} fontSize={bodyFontSize} onIssueClick={onIssueClick} />
      ) : (
        <StatusMatrixBody card={card} size={size} fontSize={bodyFontSize} onIssueClick={onIssueClick} />
      )}
    </div>
  );
};
