/**
 * Paint order inside the auto-scheduler grid, lowest first. Everything in the grid is positioned, so
 * without an explicit layer the winner is whichever element comes last in the DOM — which is why a
 * team header's inline-edit affordance used to be painted over by the epic bars below it.
 */
export const gridLayer = {
  /** The dependency-arrow SVG, which spans every row and must not intercept hover or clicks. */
  dependencies: 1,
  /** Epic bars, their day columns, and the summary metrics. */
  row: 30,
  /**
   * The team header's opaque band. Above the arrows so they stop at the row rather than striking
   * through its labels, which have no background of their own to hide behind.
   */
  teamHeaderBackground: 34,
  /** Team headers, whose editable controls overflow downward across the rows beneath them. */
  teamHeader: 35,
  /** The date scale, which stays legible over rows scrolled under it. */
  dateHeader: 40,
  /** Hover tooltips and popups, above every part of the grid. */
  popup: 50,
} as const;
