import React from 'react';

/**
 * The timeline area element (the grid cell spanning the month columns). `DatesTooltip` keeps the
 * tooltip horizontally inside this element. `null` means no boundary (viewport only).
 */
export const TimelineBoundaryContext = React.createContext<HTMLElement | null>(null);
