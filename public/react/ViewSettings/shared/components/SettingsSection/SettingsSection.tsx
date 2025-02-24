import type { FC, ReactNode } from "react";

import React from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

const SettingsSection: FC<SettingsSectionProps> = ({ title, children }) => {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-6">
      <p className="uppercase text-sm font-semibold text-zinc-800 pt-1">{title}</p>
      <div>{children}</div>
    </div>
  );
};

export default SettingsSection;
