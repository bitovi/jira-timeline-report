import { AppStorage } from '../storage/common';

/**
 * The app-wide font, as a *reference* rather than bytes.
 *
 * `AppStorage` cannot hold a font file: Connect app properties cap at 32KB per property, and the
 * standalone backend serializes every key into a single Jira issue description (~32,767 chars),
 * shared with saved reports and team configs. A single WOFF2 is 20-100KB raw and ~27-135KB base64,
 * so it fits in neither — and in standalone mode an oversized write round-trips the whole store
 * through one field, taking unrelated config down with it. See spec/016-report-of-reports/008-theme.
 *
 * So a custom font is the customer's own hosted stylesheet, referenced by URL.
 */
export interface FontSetting {
  /** Full CSS font-family value, written to `--font-sans`. */
  stack: string;
  /** https stylesheet to load before applying `stack`. Absent for presets. */
  url?: string;
}

export interface FontPreset {
  label: string;
  stack: string;
}

/**
 * Presets need no network beyond what the app already loads. Poppins is free here — every HTML
 * entry point already pulls it from Google Fonts for Bitovi branding, though only at weights 500
 * and 700, so body copy in Poppins renders at 500 rather than 400.
 */
export const FONT_PRESETS: FontPreset[] = [
  {
    label: 'System default',
    stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`,
  },
  { label: 'Poppins', stack: `'Poppins', ui-sans-serif, system-ui, sans-serif` },
  { label: 'Helvetica / Arial', stack: `'Helvetica Neue', Helvetica, Arial, sans-serif` },
  { label: 'Verdana', stack: `Verdana, Geneva, Tahoma, sans-serif` },
  { label: 'Georgia (serif)', stack: `Georgia, Cambria, 'Times New Roman', Times, serif` },
];

export const defaultFont: FontSetting = { stack: FONT_PRESETS[0].stack };

const fontKey = 'themeFont';

/** The `<link>` we manage. Fixed id so applying a font twice updates rather than accumulates. */
export const FONT_LINK_ID = 'theme-font-stylesheet';

/**
 * https only. Blocks `javascript:` and `data:` outright, and refuses plaintext `http:` because the
 * app is served over https and a mixed-content stylesheet would be dropped by the browser anyway.
 */
export const isAllowedFontUrl = (url: string): boolean => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * The family name is interpolated straight into a CSS declaration, so anything outside
 * `[A-Za-z0-9 -]` is stripped before quoting — otherwise a name like `'; background: url(...)`
 * escapes the declaration it was meant to sit inside.
 */
export const sanitizeFontFamily = (name: string): string => name.replace(/[^A-Za-z0-9 -]/g, '').trim();

/** Composes a full CSS stack from a user-entered family name, with a generic fallback. */
export const customFontStack = (family: string): string => {
  const safe = sanitizeFontFamily(family);

  return safe ? `'${safe}', sans-serif` : defaultFont.stack;
};

export const getFont = (storage: AppStorage): Promise<FontSetting> => {
  return storage.get<FontSetting>(fontKey, defaultFont).then((saved) => {
    // Storage hands back `null` for a key that was never written, and older/partial values are
    // possible since this is schemaless JSON.
    if (!saved || typeof saved.stack !== 'string' || !saved.stack) {
      return defaultFont;
    }

    return saved;
  });
};

export const updateFont = (storage: AppStorage, font: FontSetting): Promise<void> => {
  return storage.update(fontKey, font);
};

/**
 * Applies the font to the document: ensures the custom stylesheet `<link>` matches the setting,
 * then points `--report-font-sans` at the stack.
 *
 * Deliberately **not** `--font-sans`: that one is global and would restyle the app's own chrome —
 * the "Status Reports for Jira" nav, the settings sidebar, the saved-reports bar, the report
 * controls. Only `.report-font-scope` (see fonts.css, applied by ReportArea) reads
 * `--report-font-sans`, which confines the choice to the report block. Setting it on the root
 * element rather than on the container keeps this callable before the report has mounted.
 *
 * `--font-mono` is untouched — numeric table columns rely on it for alignment.
 */
export const applyFontToCssVars = (font?: FontSetting) => {
  const { stack, url } = font ?? defaultFont;

  if (typeof document !== 'undefined') {
    const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;

    if (url && isAllowedFontUrl(url)) {
      const link = existing ?? document.createElement('link');

      if (!existing) {
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
      }

      // Guarded: assigning `href` refetches even when the value is unchanged, and this runs on
      // every keystroke-debounce while someone is editing the URL.
      if (link.getAttribute('href') !== url) {
        link.setAttribute('href', url);
      }

      if (!existing) {
        document.head.appendChild(link);
      }
    } else {
      existing?.remove();
    }
  }

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--report-font-sans', stack || defaultFont.stack);
  }
};
