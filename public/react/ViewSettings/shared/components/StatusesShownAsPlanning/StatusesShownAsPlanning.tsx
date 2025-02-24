import type { FC } from "react";

import React, { useId } from "react";
import Select from "@atlaskit/select";
import VisuallyHidden from "@atlaskit/visually-hidden";

const StatusesShownAsPlanning: FC = () => {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Statuses Shown as Planning</label>
      </VisuallyHidden>
      <Select
        isMulti
        isSearchable
        id={id}
        className="flex-1"
        options={[]}
        value={undefined}
        // onChange={setSelectedStatus}
      />
    </div>
  );
};

export default StatusesShownAsPlanning;
