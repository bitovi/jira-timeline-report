/**
 * React cell renderers for normalized field columns that need richer display than a plain string
 * (spec/012-table-and-grouper #5 — visual parity with the mock). Kept in a `.tsx` so the model's
 * `.ts` files stay UI-free; {@link normalizedFieldSources} imports these functions.
 */
import React from 'react';
import Lozenge from '@atlaskit/lozenge';

import type { RenderContext } from './columns';

type LozengeAppearance = 'default' | 'inprogress' | 'moved' | 'new' | 'removed' | 'success';

/**
 * Pick an Atlaskit Lozenge appearance for a status. Prefers the normalized `statusCategory` (the
 * Jira-native signal) and falls back to keyword-matching the status label so it still colours
 * sensibly when the category isn't present (e.g. story fixtures). Mirrors the mock's colours:
 * To Do → gray, In Progress → blue, Done → green, Blocked → red.
 */
function statusAppearance(status: string, category?: string): LozengeAppearance {
  const c = (category ?? '').toLowerCase();
  if (c) {
    if (c.includes('done') || c.includes('complete')) return 'success';
    if (c.includes('progress') || c.includes('indeterminate')) return 'inprogress';
    if (c.includes('to do') || c.includes('new')) return 'default';
  }
  const s = status.toLowerCase();
  if (/block/.test(s)) return 'removed';
  if (/done|closed|complete|resolved|shipped/.test(s)) return 'success';
  if (/progress|review|doing|active/.test(s)) return 'inprogress';
  return 'default';
}

/** Render a status value as a coloured Atlaskit Lozenge (design system component). */
export function statusRender(value: unknown, ctx: RenderContext): React.ReactNode {
  if (value == null || value === '') return '';
  const status = String(value);
  const category = (ctx.issue as { statusCategory?: string } | undefined)?.statusCategory;
  return <Lozenge appearance={statusAppearance(status, category)}>{status}</Lozenge>;
}

/** Render an issue-type icon URL as a 16×16 `<img>` (parity with the `identity:issueType` column). */
export function iconRender(value: unknown): React.ReactNode {
  if (value == null || value === '') return '';
  return <img src={String(value)} alt="Issue type" width={16} height={16} />;
}

/**
 * Render a labels value as chips. Accepts the normalized `string[]` (preferred) or a scalar; empty
 * arrays render blank. Chip styling mimics Atlaskit via Tailwind (see [[design-system-atlaskit]]).
 */
export function labelsRender(value: unknown): React.ReactNode {
  const labels = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  if (labels.length === 0) return '';
  return (
    <span className="inline-flex flex-wrap gap-1">
      {labels.map((label, i) => (
        <span key={i} className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-800">
          {String(label)}
        </span>
      ))}
    </span>
  );
}
