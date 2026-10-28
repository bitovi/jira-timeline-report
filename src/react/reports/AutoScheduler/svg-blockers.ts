// SVG Blocker utilities for AutoScheduler grid
// Provides: makeInsertBlockers, highlightUpstream, highlightDownstream

// SVG/path helpers
function getTopLeft(el: Element) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

function minusPoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function getCenterRight(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return { x: rect.right, y: rect.top + rect.height / 2 };
}
function getCenterLeft(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top + rect.height / 2 };
}

const DEFAULT_STROKE = '#97a0af';
/** A blocker that finishes after the frozen item it blocks is due to start. */
export const LATE_STROKE = '#FF8B00';

/** The stroke a path returns to when it stops being highlighted. */
function baseStroke(pathEl: Element) {
  return pathEl.getAttribute('data-base-stroke') || DEFAULT_STROKE;
}

/**
 * True when `blocker` ends (at the current slider position) after the frozen item it blocks starts.
 * Both sides are the bars as drawn, so the orange line always agrees with the picture.
 */
export function isLateForFrozen(
  blocker: { dueDayTop: number },
  blocked: { linkedIssue: { frozen?: unknown }; startDateWithTimeEnoughToFinish: number },
) {
  return Boolean(blocked.linkedIssue.frozen) && blocker.dueDayTop > blocked.startDateWithTimeEnoughToFinish + 1e-6;
}

// Helper to create SVG path element
export function path(attributes: Record<string, string>): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', DEFAULT_STROKE);
  for (const attr in attributes) {
    path.setAttributeNS(null, attr, attributes[attr]);
  }
  return path;
}

function makeCurveBetweenPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  controlDistance: number = 30,
) {
  return `M ${start.x} ${start.y} \
    c ${controlDistance} 0, ${end.x - start.x - controlDistance} ${end.y - start.y}, ${
      end.x - start.x
    } ${end.y - start.y}`;
}

// Draws SVG blockers between issues in the grid. Takes a getter so a memoised drawer still reads the
// latest results — late-blocker colouring follows the uncertainty slider.
export function makeInsertBlockers(getStatsUIData: () => any | null) {
  const insertTheBlockers = () => {
    // Draw blockers after DOM is rendered
    const svg = document.getElementById('dependencies')?.querySelector('svg') as SVGSVGElement | null;
    const statsUIData = getStatsUIData();
    if (!svg || !statsUIData) return;

    // Remove previous blockers
    svg.querySelectorAll('.path-blocker').forEach((el) => el.remove());
    const svgRect = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${svgRect.width} ${svgRect.height}`);

    // Map work-item elements by id
    const elementsAndWorkMap: Record<string, { element: HTMLElement; work: any }> = {};
    document.querySelectorAll<HTMLElement>('.work-item').forEach((element) => {
      if (element.id && (element as HTMLElement).offsetParent) {
        const work = statsUIData.simulationIssueResults.find((i: any) => i.linkedIssue.key === element.id);
        if (work) {
          elementsAndWorkMap[element.id] = { element: element as HTMLElement, work };
        }
      }
    });
    // Draw blockers
    Object.values(elementsAndWorkMap).forEach(({ element, work }) => {
      const blocks = work.linkedIssue.linkedBlocks;
      if (!blocks) return;
      const blockerPoint = minusPoint(getCenterRight(element), getTopLeft(svg));
      for (const blocking of blocks) {
        const blocked = elementsAndWorkMap[blocking.key];
        if (!blocked) continue;
        const blockedPoint = minusPoint(getCenterLeft(blocked.element), getTopLeft(svg));
        const stroke = isLateForFrozen(work, blocked.work) ? LATE_STROKE : DEFAULT_STROKE;
        const blockingPath = path({
          d: makeCurveBetweenPoints(blockerPoint, blockedPoint),
          stroke,
          'data-base-stroke': stroke,
        });
        blockingPath.classList.add('path-blocker');
        blockingPath.id = work.linkedIssue.key + '-' + blocking.key;
        svg.appendChild(blockingPath);
      }
    });
  };

  return () => {
    if (!getStatsUIData()) return;
    setTimeout(() => {
      insertTheBlockers();
    }, 100); // delay to enable the animation to complete
  };
}

// Recursively highlight all upstream blockers for a given linkedIssue
export function highlightUpstream(linkedIssue: any, highlight = true, visited = new Set<string>()) {
  if (!linkedIssue || visited.has(linkedIssue.key)) return;
  visited.add(linkedIssue.key);
  if (linkedIssue.linkedBlockedBy) {
    for (const blocker of linkedIssue.linkedBlockedBy) {
      // Highlight the SVG path from blocker to this issue
      const pathEl =
        document.getElementById(`${blocker.key}-${linkedIssue.key}`) ||
        document.querySelector(`.path-blocker[id='${blocker.key}-${linkedIssue.key}']`);
      if (pathEl) {
        pathEl.setAttribute('stroke', highlight ? '#BF2600' : baseStroke(pathEl)); // red-500 for upstream
        pathEl.setAttribute('stroke-width', highlight ? '3' : '2');
      }
      // Recurse upstream
      highlightUpstream(blocker, highlight, visited);
    }
  }
}

// Recursively highlight all downstream blockers for a given linkedIssue
export function highlightDownstream(linkedIssue: any, highlight = true, visited = new Set<string>()) {
  if (!linkedIssue || visited.has(linkedIssue.key)) return;
  visited.add(linkedIssue.key);
  if (linkedIssue.linkedBlocks) {
    for (const blocked of linkedIssue.linkedBlocks) {
      // Highlight the SVG path from this issue to blocked
      const pathEl =
        document.getElementById(`${linkedIssue.key}-${blocked.key}`) ||
        document.querySelector(`.path-blocker[id='${linkedIssue.key}-${blocked.key}']`);
      if (pathEl) {
        pathEl.setAttribute('stroke', highlight ? '#0065FF' : baseStroke(pathEl)); // blue-300 for downstream
        pathEl.setAttribute('stroke-width', highlight ? '3' : '2');
      }
      // Recurse downstream
      highlightDownstream(blocked, highlight, visited);
    }
  }
}
