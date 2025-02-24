import type { FC } from "react";

import React, { useId } from "react";
import Toggle from "@atlaskit/toggle";
import { useCanObservable } from "../../../../hooks/useCanObservable";
import { value } from "../../../../../can";
import routeData from "../../../../../canjs/routing/route-data";

const useShowPercentComplete = () => {
  const showPercentComplete = useCanObservable<boolean>(
    value.from(routeData, "showPercentComplete")
  );
  const setShowPercentComplete = (newValue: boolean) => {
    // @ts-expect-error
    routeData.showPercentComplete = newValue;
  };

  return [showPercentComplete, setShowPercentComplete] as const;
};

const ShowCompletionPercentage: FC = () => {
  const id = useId();
  const [showPercentComplete, setShowPercentComplete] = useShowPercentComplete();

  return (
    <div className="flex items-center gap-2">
      <Toggle
        id={id}
        isChecked={showPercentComplete}
        onChange={({ target }) => setShowPercentComplete(target.checked)}
      />
      <label htmlFor={id} className="text-sm">
        Show completion percentages
      </label>
    </div>
  );
};

export default ShowCompletionPercentage;
