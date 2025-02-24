import type { FC } from "react";

import React, { useId } from "react";
import Toggle from "@atlaskit/toggle";

const ShowCompletionPercentage: FC = () => {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <Toggle
        id={id}
        // isChecked={}
        // onChange={}
      />
      <label htmlFor={id} className="text-sm">
        Show completion percentages
      </label>
    </div>
  );
};

export default ShowCompletionPercentage;
