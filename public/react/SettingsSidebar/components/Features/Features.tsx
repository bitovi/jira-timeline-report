import type { FC } from "react";

import React from "react";
import Heading from "@atlaskit/heading";
import Spinner from "@atlaskit/spinner";

import FeatureToggle from "./components/FeatureToggle";
import { useFeatures } from "../../../services/features/useFeatures";
import { Features } from "../../../../jira/features";
import { useUpdateFeatures } from "../../../services/features/useUpdateFeatures";

const keyToTitle = {
  scatterPlot: "Scatter Timeline Plot",
  estimationTable: "Estimation Table",
  secondaryReport: "Secondary Report",
  workBreakdowns: "Work Breakdowns",
};

const keyToSubtitle = {
  scatterPlot: "Report due dates in a condensed scatter plot",
  estimationTable: "",
  secondaryReport: "",
  workBreakdowns: "",
};

const toList = (features: Features) => {
  return Object.entries(features).map(([key, value]) => ({
    title: keyToTitle[key as keyof Features],
    subtitle: keyToSubtitle[key as keyof Features],
    value,
    key,
  }));
};

const Features: FC = () => {
  const features = useFeatures();
  const { update, isUpdating } = useUpdateFeatures();

  return (
    <div className="flex flex-col gap-y-4">
      <div className="pt-4">
        <Heading size="medium">Features {isUpdating && <Spinner size="small" />}</Heading>
      </div>
      <div className="flex flex-col gap-y-8">
        <p className="text-sm">Turn on new features under active development.</p>
        <ul className="flex flex-col gap-y-8">
          {toList(features).map((feature) => (
            <li key={feature.title}>
              <FeatureToggle
                {...feature}
                disabled={isUpdating}
                checked={feature.value}
                onChange={(newValue) => {
                  update({ ...features, [feature.key]: newValue });
                }}
              />
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Got feedback?{" "}
          <a href="#" className="link" target="_blank">
            Let us know on github.
          </a>
        </p>
      </div>
    </div>
  );
};

export default Features;
