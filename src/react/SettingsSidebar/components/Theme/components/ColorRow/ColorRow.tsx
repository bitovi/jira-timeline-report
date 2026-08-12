import type { FC } from 'react';

import React from 'react';
import Lozenge from '@atlaskit/lozenge';

import { type ThemeItem } from '../../../../../../jira/theme';

export interface ColorRowProps {
  item: ThemeItem;
  /** Keyed by label, not index — the panel renders the theme in filtered groups. */
  onChange: (label: string, backgroundColor: string) => void;
}

/**
 * One themeable color: a live-previewing Lozenge over its description, with a color input on the
 * right. Tightened to roughly 55px so nine of these plus a font picker fit the 320px settings
 * sidebar. See spec/016-report-of-reports/008-theme.
 *
 * The Lozenge previews through the CSS variable rather than `backgroundColor` — the panel applies
 * every change to `document.documentElement` synchronously, so reading the var keeps this row and
 * the actual report in lockstep.
 */
export const ColorRow: FC<ColorRowProps> = ({ item, onChange }) => {
  const { label, description, backgroundColor, backgroundCssVar, textCssVar } = item;

  return (
    <div className="flex gap-3 justify-between items-center">
      <div className="flex flex-col gap-1 items-start min-w-0">
        {/* The hairline lives on a wrapper because Lozenge forwards only `backgroundColor` and
            `color` from `style` and drops everything else. Without it a white or very light swatch
            vanishes into the panel — the Section default is #FFFFFF. */}
        <span className="inline-flex rounded-jirasm border border-neutral-301">
          <Lozenge
            style={{
              backgroundColor: `var(${backgroundCssVar})`,
              color: `var(${textCssVar})`,
            }}
          >
            {label}
          </Lozenge>
        </span>
        <div className="text-xs text-slate-700">{description}</div>
      </div>
      <input
        type="color"
        aria-label={`${label} color`}
        className="flex-shrink-0 h-8 w-14"
        value={backgroundColor}
        onChange={({ target }) => onChange(label, target.value)}
      />
    </div>
  );
};

export default ColorRow;
