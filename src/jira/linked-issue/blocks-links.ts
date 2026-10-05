import type { IssueLink } from '../shared/types';

/**
 * Readers for the `Blocks` link type, shared by everything that walks the block graph.
 *
 * Jira records one link per relationship and reports it from both ends: on the issue that blocks,
 * the entry carries `outwardIssue` ("X blocks Y"); on the issue that is blocked, the entry carries
 * `inwardIssue` ("X is blocked by Y"). Both readers key off `type.name === 'Blocks'` rather than the
 * `inward`/`outward` description strings, so a site that renamed the descriptions still works — and
 * if the link type ever becomes configurable, it becomes configurable in one place.
 */

/** Keys of the issues this issue **blocks** (the outward direction). */
export function getBlocksKeys(links: IssueLink[] | undefined): string[] {
  if (!links) return [];

  // `flatMap` rather than `filter().map()`: TypeScript does not narrow an optional property through
  // a `filter` callback, and both `inwardIssue` and `outwardIssue` are optional on `IssueLink`.
  return links.flatMap((link) => (link?.type?.name === 'Blocks' && link.outwardIssue ? [link.outwardIssue.key] : []));
}

/** Keys of the issues this issue **is blocked by** (the inward direction). */
export function getBlockedByKeys(links: IssueLink[] | undefined): string[] {
  if (!links) return [];

  return links.flatMap((link) => (link?.type?.name === 'Blocks' && link.inwardIssue ? [link.inwardIssue.key] : []));
}
