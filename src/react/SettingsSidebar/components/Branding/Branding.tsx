import type { FC } from "react";

import React from "react";

interface BrandingProps {}

const Branding: FC<BrandingProps> = () => {
  return (
    <div className="flex gap-2 pb-6">
      <div className="flex-none pt-1">
        <img src="/images/eggbert-light-minimum.svg" />
      </div>
      <div className="flex-auto grow items-baseline leading-4">
        <div className="color-gray-900 underline-on-hover bitovi-font-poppins font-bold">
          <a href="https://github.com/bitovi/jira-timeline-report" target="_blank">
            Status Reports
          </a>
        </div>
        <div className="bitovi-poppins text-neutral-100 text-sm">
          <a
            href="https://www.bitovi.com/services/agile-project-management-consulting"
            target="_blank"
          >
            by Bitovi
          </a>
        </div>
      </div>
    </div>
  );
};

export default Branding;
