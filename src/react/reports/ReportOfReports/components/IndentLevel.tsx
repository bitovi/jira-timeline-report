import type { FC, ReactNode } from 'react';

import React from 'react';

/**
 * One step of nesting: a 22px indent with a hairline rail down its left edge (1px border + 21px of
 * padding, so the step is exactly 22px whatever it holds).
 *
 * Wrappers nest, which is the whole point — each level draws its own rail, and a section's children,
 * its nested sections, and its add row all share the one belonging to their level. Top-level nodes
 * aren't wrapped at all, so they have no rail.
 *
 * See spec/016-report-of-reports/004-redesign §2.
 */
export const IndentLevel: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="flex flex-col border-l border-neutral-201 pl-[21px]">{children}</div>
);

export default IndentLevel;
