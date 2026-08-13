import type { FC, ReactNode } from 'react';

import React, { useState } from 'react';

import Heading from '@atlaskit/heading';
import Spinner from '@atlaskit/spinner';
import Button from '@atlaskit/button/new';

import { useTheme } from '../../../services/theme/useTheme';
import { useSaveTheme } from '../../../services/theme/useSaveTheme';
import { useFont } from '../../../services/theme/useFont';
import { useSaveFont } from '../../../services/theme/useSaveFont';
import {
  applyFontToCssVars,
  applyThemeToCssVars,
  defaultFont,
  defaultTheme,
  type FontSetting,
  type Theme,
} from '../../../../jira/theme';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback';
import { Accordion, AccordionContent, AccordionTitle } from '../../../components/Accordion';
import ColorRow from './components/ColorRow';
import FontPicker from './components/FontPicker';

interface ThemeProps {}

/**
 * Global appearance settings: the app-wide font, the eight status colors, and the report-of-reports
 * section background.
 *
 * Everything here previews live by writing CSS variables to `document.documentElement` on change,
 * then persists 500ms after you stop changing it. Colors and font are separate storage keys, so they
 * save independently — see spec/016-report-of-reports/008-theme.
 *
 * The working copy lives here rather than in the query cache so that dragging a color input repaints
 * through CSS variables without re-rendering the report behind the panel. A save is triggered by the
 * edit that caused it — never by comparing this copy against the saved one. That comparison is what
 * `save` itself changes, so a save whose result differs from what was written (a failed write, or
 * Jira's search index lagging the write) would ask to be saved again, forever. See the revert of
 * e528ebae.
 */
const ThemeView: FC<ThemeProps> = () => {
  const theme = useTheme();
  const font = useFont();

  // Both queries suspend, so these are the saved values on the first render — the working copy needs
  // no effect to catch up with them, and deliberately doesn't follow later cache changes: a refetch
  // that lands mid-edit would overwrite what you are in the middle of picking.
  const [localTheme, setLocalTheme] = useState(theme);
  const [localFont, setLocalFont] = useState(font);
  // Bumped on reset so the font picker's own "custom vs preset" state remounts with it. Without
  // this, resetting while Custom is selected leaves the URL and family fields filled in.
  const [resetNonce, setResetNonce] = useState(0);

  // `setLocalTheme`/`setLocalFont` are the rollback: a failed save puts the cache and the page's CSS
  // variables back, and the working copy has to follow or the panel keeps showing a color that was
  // never persisted.
  const { save, isPending } = useSaveTheme({ onRollback: setLocalTheme });
  const { save: saveFont, isPending: isFontPending } = useSaveFont({ onRollback: setLocalFont });

  // Debounced so holding a color picker open, or typing a font URL, doesn't write to Jira per
  // keystroke. A pending save is flushed if the panel closes first.
  const saveTheme = useDebouncedCallback(save, 500);
  const saveLocalFont = useDebouncedCallback(saveFont, 500);

  const updateLocalTheme = (newLocalTheme: Theme) => {
    applyThemeToCssVars(newLocalTheme);
    setLocalTheme(newLocalTheme);
    saveTheme(newLocalTheme);
  };

  const updateLocalFont = (newLocalFont: FontSetting) => {
    applyFontToCssVars(newLocalFont);
    setLocalFont(newLocalFont);
    saveLocalFont(newLocalFont);
  };

  /** Keyed by label rather than index: the rows render in filtered groups, so indices don't line up. */
  const updateColor = (label: string, backgroundColor: string) => {
    updateLocalTheme(localTheme.map((item) => (item.label === label ? { ...item, backgroundColor } : item)));
  };

  const statusItems = localTheme.filter(({ group }) => group === 'status');
  const reportOfReportsItems = localTheme.filter(({ group }) => group === 'reportOfReports');

  return (
    <div className="my-4">
      <div className="flex justify-between">
        <Heading size="small">Theme</Heading>
        {(isPending || isFontPending) && <Spinner size="small" />}
      </div>

      <div className="pt-4 flex flex-col gap-2">
        <ThemeSection title="Font">
          <FontPicker key={resetNonce} font={localFont} onChange={updateLocalFont} />
        </ThemeSection>

        <ThemeGroup title="Status colors">
          {statusItems.map((item) => (
            <ColorRow key={item.label} item={item} onChange={updateColor} />
          ))}
        </ThemeGroup>

        <ThemeGroup title="Report of Reports">
          {reportOfReportsItems.map((item) => (
            <ColorRow key={item.label} item={item} onChange={updateColor} />
          ))}
        </ThemeGroup>
      </div>

      <div className="pt-6 [&>button]:!w-full">
        <Button
          onClick={() => {
            updateLocalTheme(defaultTheme);
            updateLocalFont(defaultFont);
            setResetNonce((nonce) => nonce + 1);
          }}
        >
          Reset theme
        </Button>
      </div>
    </div>
  );
};

interface ThemeSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * A labelled group of settings that has nothing to collapse, headed like `ThemeGroup` so the panel
 * reads as one list of sections. The title starts where the groups below start their chevron, not
 * where they start their text — indenting it to the text would leave an obvious gap where the
 * missing caret should be.
 */
const ThemeSection: FC<ThemeSectionProps> = ({ title, children }) => {
  return (
    <div>
      <div className="flex items-center p-2 bg-white">
        <Heading size="xsmall">{title}</Heading>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
};

interface ThemeGroupProps {
  title: string;
  children: ReactNode;
}

/**
 * A labelled, collapsible group of settings. Both groups start open — once the rows are this
 * compact the whole panel fits the 320px sidebar, and starting collapsed would hide the colors from
 * people who already know where they are.
 */
const ThemeGroup: FC<ThemeGroupProps> = ({ title, children }) => {
  return (
    <Accordion startsOpen>
      <AccordionTitle>
        <Heading size="xsmall">{title}</Heading>
      </AccordionTitle>
      <AccordionContent>
        <div className="flex flex-col gap-3 py-2">{children}</div>
      </AccordionContent>
    </Accordion>
  );
};

export default ThemeView;
