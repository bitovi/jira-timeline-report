/**
 * The colours a column's values can take in a Stacked bar (⋯ → Order and colors).
 *
 * The picker offers Atlassian's chart tokens (`color.chart.<family>.<shade>`, {@link FAMILY_COLORS}).
 * The app doesn't load Atlassian's token stylesheet, so each carries its light-theme value as the
 * fallback.
 *
 * A value nobody has picked a colour for gets one from its NAME ({@link colorForName}), so it keeps
 * the same colour when values are reordered or new ones appear. Estimate Progress instead defaults
 * to the report's theme colours ({@link THEME_COLORS}), which follow Settings → Theme like the
 * Estimation Progress report; they are defaults only, not picker options.
 */
import { token } from '@atlaskit/tokens';

export interface ChartColor {
  /** Persisted id: a theme colour (`theme.complete`) or an Atlassian token name (`color.chart.blue.bold`). */
  id: string;
  label: string;
  background: string;
  text: string;
}

const DARK_TEXT = '#172B4D';
const LIGHT_TEXT = '#FFFFFF';

/** Relative luminance of a `#RRGGBB` colour (WCAG). */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whichever of dark or light text contrasts more with `hex`. */
function textFor(hex: string): string {
  const l = luminance(hex);
  const contrast = (other: number) => (Math.max(l, other) + 0.05) / (Math.min(l, other) + 0.05);
  return contrast(luminance(DARK_TEXT)) >= contrast(luminance(LIGHT_TEXT))
    ? token('color.text', DARK_TEXT)
    : token('color.text.inverse', LIGHT_TEXT);
}

function chartToken(name: string, label: string, fallback: string): ChartColor {
  return { id: name, label, background: token(name as Parameters<typeof token>[0], fallback), text: textFor(fallback) };
}

function themeColor(name: string, label: string): ChartColor {
  return { id: `theme.${name}`, label, background: `var(--${name}-color)`, text: `var(--${name}-text-color)` };
}

/** The report's own status colours (Settings → Theme), for column defaults. */
export const THEME_COLORS: readonly ChartColor[] = [
  themeColor('complete', 'Complete'),
  themeColor('ontrack', 'On track'),
  themeColor('ahead', 'Ahead'),
  themeColor('behind', 'Behind'),
  themeColor('warning', 'Warning'),
  themeColor('blocked', 'Blocked'),
  themeColor('notstarted', 'Not started'),
];

const SHADES = ['bold', 'bolder', 'boldest'] as const;
export type Shade = (typeof SHADES)[number];

/** Light-theme values of `color.chart.<family>.<shade>`, from `@atlaskit/tokens`. */
const FAMILY_FALLBACKS = {
  gray: ['#8590A2', '#758195', '#44546F'],
  blue: ['#388BFF', '#1D7AFC', '#0055CC'],
  teal: ['#2898BD', '#227D9B', '#206A83'],
  green: ['#22A06B', '#1F845A', '#216E4E'],
  lime: ['#6A9A23', '#5B7F24', '#4C6B1F'],
  yellow: ['#B38600', '#946F00', '#7F5F01'],
  orange: ['#E56910', '#C25100', '#A54800'],
  red: ['#F15B50', '#E2483D', '#AE2E24'],
  magenta: ['#DA62AC', '#CD519D', '#943D73'],
  purple: ['#8F7EE7', '#8270DB', '#5E4DB2'],
} as const;
export type ChartFamily = keyof typeof FAMILY_FALLBACKS;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Every family in three shades: the picker's grid, one row per shade. */
export const FAMILY_COLORS: readonly ChartColor[] = SHADES.flatMap((shade, shadeIndex) =>
  (Object.keys(FAMILY_FALLBACKS) as ChartFamily[]).map((family) =>
    chartToken(
      `color.chart.${family}.${shade}`,
      `${capitalize(family)} ${shade}`,
      FAMILY_FALLBACKS[family][shadeIndex],
    ),
  ),
);

const BY_ID = new Map([...THEME_COLORS, ...FAMILY_COLORS].map((color) => [color.id, color]));

/** Name-based defaults: the grid's middle shade, one per family. */
const NAME_DEFAULTS = FAMILY_COLORS.filter((color) => color.id.endsWith('.bolder'));

/** A colour by its persisted id, or `undefined` for an unknown id (e.g. a hand-edited URL). */
export function chartColor(id: string | undefined): ChartColor | undefined {
  return id == null ? undefined : BY_ID.get(id);
}

/** A stable non-negative hash of `text` (FNV-1a). */
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The default colour id for a value with no colour of its own: picked by its name, so it never moves. */
export function colorForName(name: string): string {
  return NAME_DEFAULTS[hashText(name) % NAME_DEFAULTS.length].id;
}

/** A shade of `family`, picked by `name` so different values in one family differ. */
export function familyShadeForName(family: ChartFamily, name: string): string {
  return `color.chart.${family}.${SHADES[hashText(name) % SHADES.length]}`;
}
