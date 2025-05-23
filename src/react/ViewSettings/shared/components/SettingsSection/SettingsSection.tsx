import type { FC, ReactNode } from 'react';

import React from 'react';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  centered?: boolean;
}

const SettingsSection: FC<SettingsSectionProps> = ({ title, children, centered }) => {
  const variantClasses = centered ? 'self-center' : 'pt-1';
  return (
    <div className="grid grid-cols-[150px_1fr] gap-6 py-4">
      <p className={`uppercase text-sm font-semibold text-zinc-800 ${variantClasses}`}>{title}</p>
      <div>{children}</div>
    </div>
  );
};

export default SettingsSection;
