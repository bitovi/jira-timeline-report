import type { FC, ReactNode } from 'react';

import React, { useEffect, useState } from 'react';

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
import { useDebounce } from '../../../hooks/useDebounce';
import { Accordion, AccordionContent, AccordionTitle } from '../../../components/Accordion';
import ColorRow from './components/ColorRow';
import FontPicker from './components/FontPicker';

interface ThemeProps {}

/**
 * Global appearance settings: the app-wide font, the eight status colors, and the report-of-reports
 * section background.
 *
 * Everything here previews live by writing CSS variables to `document.documentElement` on change,
 * then persists on a 500ms debounce. Colors and font are separate storage keys, so they save
 * independently — see spec/016-report-of-reports/008-theme.
 */
const ThemeView: FC<ThemeProps> = () => {
  const theme = useTheme();
  const font = useFont();
  const { save, isPending } = useSaveTheme();
  const { save: saveFont, isPending: isFontPending } = useSaveFont();

  const [localTheme, setLocalTheme] = useState(theme);
  const [localFont, setLocalFont] = useState(font);
  // Bumped on reset so the font picker's own "custom vs preset" state remounts with it. Without
  // this, resetting while Custom is selected leaves the URL and family fields filled in.
  const [resetNonce, setResetNonce] = useState(0);

  const updateLocalTheme = (newLocalTheme: Theme) => {
    applyThemeToCssVars(newLocalTheme);
    setLocalTheme(newLocalTheme);
  };

  const updateLocalFont = (newLocalFont: FontSetting) => {
    applyFontToCssVars(newLocalFont);
    setLocalFont(newLocalFont);
  };

  /** Keyed by label rather than index: the rows render in filtered groups, so indices don't line up. */
  const updateColor = (label: string, backgroundColor: string) => {
    updateLocalTheme(localTheme.map((item) => (item.label === label ? { ...item, backgroundColor } : item)));
  };

  const debouncedTheme = useDebounce(localTheme, 500);
  const debouncedFont = useDebounce(localFont, 500);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  useEffect(() => {
    setLocalFont(font);
  }, [font]);

  useEffect(() => {
    if (JSON.stringify(theme) === JSON.stringify(debouncedTheme)) {
      return;
    }

    save(debouncedTheme);
  }, [debouncedTheme, save, theme]);

  useEffect(() => {
    if (JSON.stringify(font) === JSON.stringify(debouncedFont)) {
      return;
    }

    saveFont(debouncedFont);
  }, [debouncedFont, font, saveFont]);

  const statusItems = localTheme.filter(({ group }) => group === 'status');
  const reportOfReportsItems = localTheme.filter(({ group }) => group === 'reportOfReports');

  return (
    <div className="my-4">
      <div className="flex justify-between">
        <Heading size="small">Theme</Heading>
        {(isPending || isFontPending) && <Spinner size="small" />}
      </div>

      <div className="pt-4">
        <FontPicker key={resetNonce} font={localFont} onChange={updateLocalFont} />
      </div>

      <div className="pt-4 flex flex-col gap-2">
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
