import type { FC } from 'react';

import React, { useId, useState } from 'react';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import { ErrorMessage, Label } from '@atlaskit/form';

import { customFontStack, FONT_PRESETS, isAllowedFontUrl, type FontSetting } from '../../../../../../jira/theme';

const CUSTOM = 'custom';

interface FontOption {
  label: string;
  value: string;
  stack?: string;
}

const options: FontOption[] = [
  ...FONT_PRESETS.map(({ label, stack }) => ({ label, value: stack, stack })),
  { label: 'Custom…', value: CUSTOM },
];

export interface FontPickerProps {
  font: FontSetting;
  onChange: (font: FontSetting) => void;
}

/**
 * Font selection for the Theme panel: a preset list plus a custom option that takes a hosted
 * stylesheet URL and a family name.
 *
 * Custom fonts are referenced, never uploaded — see `jira/theme/font.ts` for why storage can't hold
 * a font file. The URL is validated before it reaches `onChange`, so a half-typed one never gets
 * injected as a `<link>` while someone is still typing.
 */
export const FontPicker: FC<FontPickerProps> = ({ font, onChange }) => {
  const selectId = useId();
  const urlId = useId();
  const familyId = useId();

  const [isCustom, setIsCustom] = useState(!!font.url);
  const [url, setUrl] = useState(font.url ?? '');
  const [family, setFamily] = useState(() => (font.url ? stripStack(font.stack) : ''));

  const urlIsInvalid = isCustom && url.trim() !== '' && !isAllowedFontUrl(url.trim());

  const emitCustom = (nextUrl: string, nextFamily: string) => {
    const trimmed = nextUrl.trim();

    // Nothing is applied until the URL is a usable https one and a family has been named —
    // otherwise every keystroke would swap the page's font to a fallback.
    if (!isAllowedFontUrl(trimmed) || !nextFamily.trim()) {
      return;
    }

    onChange({ stack: customFontStack(nextFamily), url: trimmed });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={selectId}>Font</Label>
      <Select<FontOption>
        inputId={selectId}
        options={options}
        value={options.find((option) => (isCustom ? option.value === CUSTOM : option.value === font.stack)) ?? null}
        // Each option previews itself, which is the only way to choose a font from a list of names.
        formatOptionLabel={(option) => <span style={{ fontFamily: option.stack }}>{option.label}</span>}
        onChange={(option) => {
          if (!option) {
            return;
          }

          if (option.value === CUSTOM) {
            setIsCustom(true);
            emitCustom(url, family);

            return;
          }

          setIsCustom(false);
          onChange({ stack: option.value });
        }}
      />

      {isCustom && (
        <div className="flex flex-col gap-2 pt-1">
          <div>
            <Label htmlFor={urlId}>Stylesheet URL</Label>
            <Textfield
              id={urlId}
              value={url}
              placeholder="https://fonts.googleapis.com/css2?family=…"
              isInvalid={urlIsInvalid}
              onChange={({ currentTarget }) => {
                setUrl(currentTarget.value);
                emitCustom(currentTarget.value, family);
              }}
            />
            {urlIsInvalid && <ErrorMessage>Must be an https:// URL.</ErrorMessage>}
          </div>
          <div>
            <Label htmlFor={familyId}>Font family name</Label>
            <Textfield
              id={familyId}
              value={family}
              placeholder="Inter"
              onChange={({ currentTarget }) => {
                setFamily(currentTarget.value);
                emitCustom(url, currentTarget.value);
              }}
            />
          </div>
          <div
            className="text-sm text-slate-700 border border-slate-300 rounded p-2"
            style={{ fontFamily: font.stack }}
          >
            The quick brown fox jumps over the lazy dog
          </div>
        </div>
      )}
    </div>
  );
};

/** Recovers the family name from a stored custom stack (`'Inter', sans-serif` → `Inter`). */
const stripStack = (stack: string): string => {
  const [first] = stack.split(',');

  return (first ?? '').replace(/['"]/g, '').trim();
};

export default FontPicker;
