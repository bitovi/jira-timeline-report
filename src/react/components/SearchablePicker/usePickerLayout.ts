/**
 * The picker's expanded/compact choice, optionally remembered.
 *
 * See spec/033-column-select-redesign § 3.
 */
import { useState } from 'react';

import { useLocalStorage } from '../../hooks/useLocalStorage';

export type PickerLayout = 'expanded' | 'compact';

/**
 * Both callers want the wide grid first — the whole point of the redesign is that a 180-entry group
 * is unscannable one-per-row — so this is a constant rather than a `defaultLayout` prop. It becomes a
 * prop when a second answer exists.
 */
export const DEFAULT_LAYOUT: PickerLayout = 'expanded';

/** `grid-cols-3`. Tailwind compiles that to `repeat(3, minmax(0, 1fr))`, which is what the design asked for. */
export const EXPANDED_COLUMNS = 3;

/** Where the choice goes when there is no `layoutStorageKey`. Read once, never written — see below. */
const UNPERSISTED_KEY = '__searchable-picker-layout-unpersisted__';

/**
 * Guards the **read** side only; the stored value stays JSON (`'"compact"'`) so the default
 * `serialize` still applies.
 *
 * `useLocalStorage`'s default `deserialize` is `JSON.parse` called on `getItem(key) ?? ''`, and
 * `JSON.parse('')` throws — so a missing key crashes the mount without this. The same guard
 * `useRecentReports.ts:17-30` needs, for the same reason.
 */
export const parseLayout = (raw: string): PickerLayout => {
  if (!raw) return DEFAULT_LAYOUT;

  try {
    return JSON.parse(raw) === 'compact' ? 'compact' : DEFAULT_LAYOUT;
  } catch {
    // Hand-edited, or written by some earlier non-JSON version of this key.
    return DEFAULT_LAYOUT;
  }
};

/**
 * Hooks cannot be conditional, so `useLocalStorage` is **always** called — but with no
 * `layoutStorageKey` we hand back a plain `useState` pair instead, so its setter never runs and
 * nothing is ever written. (The unpersisted key is still *read* on mount, which costs one
 * `getItem` of a key nobody writes.)
 *
 * Called from `SearchablePicker` rather than the panel, so the choice survives close/reopen even
 * with no key — the panel unmounts every time the popup closes.
 */
export const usePickerLayout = (storageKey?: string) => {
  const persisted = useLocalStorage<PickerLayout>(storageKey ?? UNPERSISTED_KEY, { deserialize: parseLayout });
  const ephemeral = useState<PickerLayout>(DEFAULT_LAYOUT);

  return storageKey ? persisted : (ephemeral as unknown as typeof persisted);
};
