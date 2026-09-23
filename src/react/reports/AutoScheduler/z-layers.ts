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
   * The pinned `what` column. Above the bars and the day-column rules, which slide under it when the
   * grid is scrolled sideways; below the team header, whose own name cell is pinned on both axes.
   */
  labelColumn: 32,
  /**
   * The team header's opaque band. Above the arrows so they stop at the row rather than striking
   * through its labels, which have no background of their own to hide behind.
   */
  teamHeaderBackground: 34,
  /** Team headers, whose editable controls overflow downward across the rows beneath them. */
  teamHeader: 35,
  /**
   * The pinned team name. A layer of its own rather than sharing `teamHeader` with the capacity
   * controls beside it: at equal z-index the later element in the DOM wins, and the controls row
   * would paint over the name once the grid is scrolled sideways.
   */
  teamHeaderLabel: 36,
  /** The date scale, which stays legible over rows scrolled under it. */
  dateHeader: 40,
  /**
   * The grid's top-left cell, pinned on both axes. Above the date scale, which is the one thing that
   * would otherwise slide over the label column when the grid is scrolled sideways.
   */
  gridCorner: 45,
  /** Hover tooltips and popups, above every part of the grid. */
  popup: 50,
} as const;
