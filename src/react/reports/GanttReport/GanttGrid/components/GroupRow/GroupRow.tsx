import React from 'react';
import { specialStatusTextClass } from '../../helpers/status';
import { IssueTooltip } from '../IssueTooltip';
import type { GroupHeader } from '../../types';

export interface GroupRowProps {
  group: GroupHeader;
  /** 1-based CSS grid row line this row occupies. */
  gridRow: number;
}

/**
 * A group-header row (team / project / parent band). When grouping by parent, `group.parent`
 * carries the real issue so the label can open the full `IssueTooltip`; other grouping modes
 * (team/project) render a plain, non-interactive label.
 *
 * Ports the group-header portion of gantt-grid.js's `view` template.
 */
export const GroupRow: React.FC<GroupRowProps> = ({ group, gridRow }) => {
  const label = <span className={`font-bold px-1 ${specialStatusTextClass(group.status ?? '')}`}>{group.summary}</span>;

  return (
    <div style={{ gridRow, gridColumn: '1 / -1' }} className="flex items-center">
      {group.parent ? (
        <IssueTooltip issue={group.parent}>
          {(triggerProps) => (
            <button type="button" {...triggerProps} className="pointer">
              {label}
            </button>
          )}
        </IssueTooltip>
      ) : (
        label
      )}
    </div>
  );
};
