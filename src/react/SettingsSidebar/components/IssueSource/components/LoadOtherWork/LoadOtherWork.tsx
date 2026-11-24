import type { FC } from 'react';

import React, { useId } from 'react';
import { Checkbox } from '@atlaskit/checkbox';
import { Label } from '@atlaskit/form';
import QuestionCircleIcon from '@atlaskit/icon/glyph/question-circle';
import Tooltip from '@atlaskit/tooltip';

import JqlEditor from '../JqlEditor';
import type { OtherWorkStatus } from '../../../../../../jira/rollup/work-size/other-work';
import { otherWorkMessage } from '../../../TimingCalculation/components/WorkSettings/WorkSettings';

export const LOAD_OTHER_WORK_LABEL = "Include the team's other overlapping work";
const LABEL_LAST_WORD = LOAD_OTHER_WORK_LABEL.split(' ').pop()!;
const LABEL_START = LOAD_OTHER_WORK_LABEL.slice(0, -LABEL_LAST_WORD.length - 1);

/** Short on purpose; the Rollup tab explains why under "Team time over its dates". */
export const LOAD_OTHER_WORK_HELP =
  "Loads each team's other epics whose dates overlap the epics from your JQL. Only used to size team time.";

interface LoadOtherWorkProps {
  loadOtherWork: boolean;
  setLoadOtherWork: (load: boolean) => void;
  otherWorkJql: string;
  setOtherWorkJql: (jql: string) => void;
  /** Route data's `teamTimeOtherWork`: the result of the last load. */
  status?: OtherWorkStatus;
}

/**
 * Sources tab checkbox for spec/046 § The team's other work, laid out like Load blockers: an
 * optional JQL filter appended to each team's query, plus the result of the last load.
 */
const LoadOtherWork: FC<LoadOtherWorkProps> = ({
  loadOtherWork,
  setLoadOtherWork,
  otherWorkJql,
  setOtherWorkJql,
  status,
}) => {
  const id = useId();
  const message = !loadOtherWork
    ? null
    : status?.status === 'off'
      ? "Not used right now: epics aren't sized by team time (Rollup tab)."
      : otherWorkMessage(status);

  return (
    <div className="flex flex-col gap-2" data-testid="load-other-work">
      <div className="flex gap-1">
        <Checkbox
          id={id}
          className="self-start align-middle h-6 mr-0.5"
          isChecked={loadOtherWork}
          onChange={(ev) => setLoadOtherWork(ev.target.checked)}
        />
        {/*
          The (?) follows the label's last word and never wraps away from it: the last word is a second
          label for the same checkbox, kept on one line with the icon. Screen readers join the two labels.
        */}
        <span>
          <label htmlFor={id}>{LABEL_START} </label>
          <span className="whitespace-nowrap">
            <label htmlFor={id}>{LABEL_LAST_WORD}</label>
            <Tooltip content={LOAD_OTHER_WORK_HELP}>
              {(tooltipProps) => (
                <button
                  {...tooltipProps}
                  type="button"
                  className="inline-flex align-middle ml-1 -mt-0.5 text-neutral-400 hover:text-neutral-600"
                  aria-label="About including the team's other overlapping work"
                >
                  <QuestionCircleIcon label="" size="small" />
                </button>
              )}
            </Tooltip>
          </span>
        </span>
      </div>
      {loadOtherWork && (
        <div className="group flex flex-col gap-1 pl-6">
          {/* Caption only — the editor labels its own combobox, so there's no control to associate. */}
          <Label htmlFor="">Optional overlapping work JQL filters</Label>
          <JqlEditor query={otherWorkJql} onUpdate={setOtherWorkJql} />
          {/* Pulled up into the space the editor reserves below itself, except while it shows its hint (focused) or a validation error. */}
          {message && (
            <p
              className="text-xs text-gray-600 -mt-4 group-focus-within:mt-0 group-has-[[data-testid=jql-editor-validation]]:mt-0"
              data-testid="other-work-result"
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LoadOtherWork;
