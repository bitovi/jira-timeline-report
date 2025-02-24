import type { FC } from "react";

import React, { useId } from "react";
import Select from "@atlaskit/select";
import VisuallyHidden from "@atlaskit/visually-hidden";

const GroupBy: FC = () => {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Group By</label>
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

export default GroupBy;
