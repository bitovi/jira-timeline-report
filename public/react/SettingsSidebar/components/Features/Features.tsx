import type { FC } from "react";

import React from "react";
import Heading from "@atlaskit/heading";

import FeatureToggle from "./components/FeatureToggle";

interface FeaturesProps {}

const features = [
  { title: "Scatter Timeline Plot", subtitle: "Report due dates in a condensed scatter plot" },
  { title: "Estimation Table", subtitle: "" },
  { title: "Secondary Report", subtitle: "" },
  { title: "Work Breakdowns", subtitle: "" },
];

const Features: FC<FeaturesProps> = () => {
  return (
    <div className="flex flex-col gap-y-4">
      <div className="pt-4">
        <Heading size="medium">Features</Heading>
      </div>
      <div className="flex flex-col gap-y-8">
        <p className="text-sm">Turn on new features under active development.</p>
        <ul className="flex flex-col gap-y-8">
          {features.map((feature) => (
            <li key={feature.title}>
              <FeatureToggle {...feature} />
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
