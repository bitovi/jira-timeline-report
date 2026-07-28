import type { LayoutNode, LayoutPath, SectionNode, StoredNode } from './sections';

import {
  parseSections,
  toStoredSections,
  sameSections,
  savedReportNode,
  sectionNode,
  appendNode,
  setSectionTitleAt,
  removeNodeAt,
  moveNodeAt,
  canMoveNodeAt,
  canAddSectionAt,
  MAX_SECTION_DEPTH,
  visitNodes,
  pathKey,
} from './sections';

const storedSavedReport = (reportId: string): StoredNode => ({ type: 'saved-report', params: { reportId } });

const storedSection = (title: string, children: StoredNode[] = []): StoredNode => ({
  type: 'section',
  params: { title },
  children,
});

const reportIdOf = (node: StoredNode): string | undefined =>
  node.type === 'saved-report' ? node.params.reportId : undefined;

describe('parseSections', () => {
  it('returns an empty tree for anything that is not an array', () => {
    expect(parseSections(undefined)).toEqual([]);
    expect(parseSections(null)).toEqual([]);
    expect(parseSections('nope')).toEqual([]);
    expect(parseSections(storedSavedReport('a'))).toEqual([]);
  });

  it('returns an empty tree for an empty array', () => {
    expect(parseSections([])).toEqual([]);
  });

  it('parses saved-report nodes', () => {
    const [node] = parseSections([storedSavedReport('a')]);

    expect(node.type).toBe('saved-report');
    expect(node.type === 'saved-report' && node.params.reportId).toBe('a');
  });

  it('parses a section holding a saved report and another section, at depth', () => {
    const stored = [storedSection('Q3', [storedSavedReport('a'), storedSection('July', [storedSavedReport('b')])])];

    const [outer] = parseSections(stored);

    expect(outer.type).toBe('section');
    expect(outer.type === 'section' && outer.params.title).toBe('Q3');
    expect(outer.type === 'section' && outer.children.map((child) => child.type)).toEqual(['saved-report', 'section']);
  });

  it('tolerates a section with no title and no children', () => {
    const [node] = parseSections([{ type: 'section' }]);

    expect(node.type === 'section' && node.params.title).toBe('');
    expect(node.type === 'section' && node.children).toEqual([]);
  });

  // A document written by a newer client degrades to placeholders instead of blanking the page.
  it('degrades an unknown node type to a placeholder that keeps the original node', () => {
    const raw = { type: 'inline-report', params: { expression: '(issue = IMP-1).summary' } };

    const [node] = parseSections([raw]);

    expect(node.type).toBe('unknown');
    expect(node.type === 'unknown' && node.params).toMatchObject({ originalType: 'inline-report', raw });
  });

  it('degrades malformed nodes to placeholders', () => {
    const malformed = [null, 'x', {}, { type: 'saved-report', params: {} }, { type: 'saved-report' }];

    expect(parseSections(malformed).map((node) => node.type)).toEqual(Array(malformed.length).fill('unknown'));
  });

  it('degrades a malformed child without dropping its siblings', () => {
    const stored = [
      { type: 'section', params: { title: 'Q3' }, children: [storedSavedReport('a'), null, { type: 'future-node' }] },
    ];

    const [parsed] = parseSections(stored);

    expect(parsed.type === 'section' && parsed.children.map((child) => child.type)).toEqual([
      'saved-report',
      'unknown',
      'unknown',
    ]);
  });
});

describe('node identity', () => {
  // Ids exist so a node keeps its React instance across a reorder — without them a moved child
  // report re-mounts and refetches. They are in-memory only; `toStoredSections` drops them.
  it('gives every parsed node a unique id, at every depth', () => {
    const stored = [storedSection('Q3', [storedSavedReport('a'), storedSavedReport('a')]), storedSavedReport('a')];
    const ids: string[] = [];

    visitNodes(parseSections(stored), (node) => ids.push(node.id));

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every(Boolean)).toBe(true);
  });

  it('gives freshly built nodes an id too', () => {
    expect(savedReportNode('a').id).toBeTruthy();
    expect(sectionNode('Q3').id).toBeTruthy();
    expect(savedReportNode('a').id).not.toBe(savedReportNode('a').id);
  });
});

describe('toStoredSections', () => {
  it('drops in-memory ids', () => {
    expect(toStoredSections(parseSections([storedSavedReport('a')]))).toEqual([storedSavedReport('a')]);
  });

  it('drops ids at depth', () => {
    const stored = [storedSection('Q3', [storedSavedReport('a'), storedSection('July', [storedSavedReport('b')])])];

    expect(toStoredSections(parseSections(stored))).toEqual(stored);
  });

  // Saving a document written by a newer client must not destroy nodes this client couldn't render.
  it('restores an unrecognized node exactly as it was stored', () => {
    const stored = [
      storedSavedReport('a'),
      { type: 'inline-report', params: { expression: '(issue = IMP-1).summary' } } as unknown as StoredNode,
    ];

    expect(toStoredSections(parseSections(stored))).toEqual(stored);
  });

  it('round-trips a tree containing every node kind', () => {
    const stored = [
      storedSection('Q3', [
        storedSavedReport('a'),
        { type: 'text', params: { content: 'hi' } } as unknown as StoredNode,
        storedSection('July', [storedSavedReport('b')]),
      ]),
      storedSavedReport('c'),
    ];

    expect(toStoredSections(parseSections(stored))).toEqual(stored);
  });

  it('writes an unreadable node back as it was found', () => {
    expect(toStoredSections(parseSections([null]))).toEqual([null]);
  });
});

describe('sameSections', () => {
  // Drives the dirty flag: layout edits must surface "Save report", and a save must clear it.
  it('is true for trees that store identically', () => {
    const stored = [storedSection('Q3', [storedSavedReport('a')])];

    expect(sameSections(parseSections(stored), parseSections(stored))).toBe(true);
  });

  it('ignores in-memory ids', () => {
    const first = [savedReportNode('a')];
    const second = [savedReportNode('a')];

    expect(first[0].id).not.toBe(second[0].id);
    expect(sameSections(first, second)).toBe(true);
  });

  it('is false when a node is added, reordered, or retitled', () => {
    const base = parseSections([storedSavedReport('a'), storedSavedReport('b')]);

    expect(sameSections(base, parseSections([storedSavedReport('a')]))).toBe(false);
    expect(sameSections(base, parseSections([storedSavedReport('b'), storedSavedReport('a')]))).toBe(false);
    expect(sameSections(parseSections([storedSection('Q3')]), parseSections([storedSection('Q4')]))).toBe(false);
  });

  it('treats an absent saved tree as empty, so old reports are never dirty on load', () => {
    expect(sameSections(parseSections(undefined), parseSections(undefined))).toBe(true);
    expect(sameSections([], parseSections(undefined))).toBe(true);
  });
});

describe('appendNode', () => {
  it('appends to the root when no path is given', () => {
    const result = appendNode([savedReportNode('a')], savedReportNode('b'));

    expect(toStoredSections(result)).toEqual([storedSavedReport('a'), storedSavedReport('b')]);
  });

  it('appends into a section at depth', () => {
    const tree = [sectionNode('Q3', [sectionNode('July')])];

    const result = appendNode(tree, savedReportNode('a'), [0, 0]);

    expect(toStoredSections(result)).toEqual([storedSection('Q3', [storedSection('July', [storedSavedReport('a')])])]);
  });

  it('does not mutate the input tree', () => {
    const tree = [sectionNode('Q3')];
    const frozen = JSON.stringify(tree);

    appendNode(tree, savedReportNode('a'), [0]);

    expect(JSON.stringify(tree)).toBe(frozen);
  });

  it('leaves the tree unchanged when the path does not resolve to a container', () => {
    const tree = [savedReportNode('a')];

    expect(appendNode(tree, savedReportNode('b'), [0])).toEqual(tree);
    expect(appendNode(tree, savedReportNode('b'), [9])).toEqual(tree);
  });
});

describe('setSectionTitleAt', () => {
  it('retitles a root section', () => {
    const tree = [sectionNode('Q3'), savedReportNode('a')];

    expect(toStoredSections(setSectionTitleAt(tree, [0], 'Q4'))).toEqual([storedSection('Q4'), storedSavedReport('a')]);
  });

  it('retitles a section at depth', () => {
    const tree = [sectionNode('Q3', [sectionNode('July')])];

    expect(toStoredSections(setSectionTitleAt(tree, [0, 0], 'August'))).toEqual([
      storedSection('Q3', [storedSection('August')]),
    ]);
  });

  // A new section starts blank, and clearing a title back to blank is a legitimate edit — not a
  // reason to refuse the change and leave the old title on screen.
  it('accepts a blank title', () => {
    expect(toStoredSections(setSectionTitleAt([sectionNode('Q3')], [0], ''))).toEqual([storedSection('')]);
  });

  // A retitle must not remount the section or anything under it: a remounted ChildReport refetches
  // from Jira. Keeping the id and the children array is what buys that.
  it('keeps the section id and its children array', () => {
    const section = sectionNode('Q3', [savedReportNode('a')]);

    const [updated] = setSectionTitleAt([section], [0], 'Q4');

    expect(updated.id).toBe(section.id);
    expect((updated as SectionNode).children).toBe(section.children);
  });

  it('leaves the tree unchanged for a path that does not resolve', () => {
    const tree = [sectionNode('Q3')];

    expect(setSectionTitleAt(tree, [9], 'Q4')).toBe(tree);
    expect(setSectionTitleAt(tree, [0, 0], 'Q4')).toBe(tree);
    expect(setSectionTitleAt(tree, [], 'Q4')).toBe(tree);
  });

  it('leaves the tree unchanged when the path points at something that is not a section', () => {
    const tree = [savedReportNode('a')];

    expect(setSectionTitleAt(tree, [0], 'Q4')).toBe(tree);
  });

  // Opening the title field and confirming without typing must not surface "Save report".
  it('leaves the tree unchanged when the title already matches', () => {
    const tree = [sectionNode('Q3')];

    expect(setSectionTitleAt(tree, [0], 'Q3')).toBe(tree);
  });

  it('does not mutate the input tree', () => {
    const tree = [sectionNode('Q3', [savedReportNode('a')])];
    const frozen = JSON.stringify(tree);

    setSectionTitleAt(tree, [0], 'Q4');

    expect(JSON.stringify(tree)).toBe(frozen);
  });
});

describe('canAddSectionAt', () => {
  // A section at each of the three allowed levels: Q3 › July › Week 1.
  const tree = [
    sectionNode('Q3', [sectionNode('July', [sectionNode('Week 1', [savedReportNode('a')])])]),
    savedReportNode('b'),
  ];
  const cases: Array<[LayoutPath, boolean]> = [
    [[], true], // the document root, which is not a level of its own
    [[0], true], // into level 1
    [[0, 0], true], // into level 2
    [[0, 0, 0], false], // into level 3 — a fourth nested section would exceed the cap
    [[0, 0, 0, 0], false], // a saved report, and past the cap besides
    [[1], false], // a saved report holds nothing
    [[9], false], // out of range
  ];

  it.each(cases)('is %j → %s', (path, expected) => {
    expect(canAddSectionAt(tree, path)).toBe(expected);
  });

  // Pins the guard to the ticket's "up to 3 levels deep" rather than to its own constant: adding
  // for as long as it says yes must leave exactly MAX_SECTION_DEPTH nested sections.
  it('allows a document to be built exactly MAX_SECTION_DEPTH sections deep', () => {
    let built: LayoutNode[] = [];
    let path: LayoutPath = [];

    while (canAddSectionAt(built, path)) {
      built = appendNode(built, sectionNode('level'), path);
      path = [...path, 0]; // each container was empty, so the new section lands at index 0
    }

    expect(path.length).toBe(MAX_SECTION_DEPTH);
    expect(toStoredSections(built)).toEqual([
      storedSection('level', [storedSection('level', [storedSection('level')])]),
    ]);
  });

  // The cap governs the creation affordance only. A document nested deeper — hand-edited, or from a
  // client with a higher cap — still renders and saves back intact instead of being clamped.
  it('does not stop a deeper stored document from round-tripping', () => {
    const deep = [storedSection('1', [storedSection('2', [storedSection('3', [storedSection('4')])])])];

    expect(toStoredSections(parseSections(deep))).toEqual(deep);
    expect(canAddSectionAt(parseSections(deep), [0, 0, 0])).toBe(false);
  });
});

describe('removeNodeAt', () => {
  it('removes a root node', () => {
    const tree = [savedReportNode('a'), savedReportNode('b')];

    expect(toStoredSections(removeNodeAt(tree, [0]))).toEqual([storedSavedReport('b')]);
  });

  it('removes a nested node', () => {
    const tree = [sectionNode('Q3', [savedReportNode('a'), savedReportNode('b')])];

    expect(toStoredSections(removeNodeAt(tree, [0, 1]))).toEqual([storedSection('Q3', [storedSavedReport('a')])]);
  });

  it('leaves the tree unchanged for a path that does not resolve', () => {
    const tree = [savedReportNode('a')];

    expect(removeNodeAt(tree, [9])).toEqual(tree);
    expect(removeNodeAt(tree, [0, 0])).toEqual(tree);
    expect(removeNodeAt(tree, [])).toEqual(tree);
  });

  it('does not mutate the input tree', () => {
    const tree = [sectionNode('Q3', [savedReportNode('a')])];
    const frozen = JSON.stringify(tree);

    removeNodeAt(tree, [0, 0]);

    expect(JSON.stringify(tree)).toBe(frozen);
  });
});

describe('moveNodeAt', () => {
  it('moves a root node up and down', () => {
    const tree = [savedReportNode('a'), savedReportNode('b'), savedReportNode('c')];

    expect(toStoredSections(moveNodeAt(tree, [1], -1)).map(reportIdOf)).toEqual(['b', 'a', 'c']);
    expect(toStoredSections(moveNodeAt(tree, [1], 1)).map(reportIdOf)).toEqual(['a', 'c', 'b']);
  });

  it('moves a nested node within its own section', () => {
    const tree = [sectionNode('Q3', [savedReportNode('a'), savedReportNode('b')])];

    const moved = moveNodeAt(tree, [0, 1], -1);

    expect(toStoredSections(moved)).toEqual([storedSection('Q3', [storedSavedReport('b'), storedSavedReport('a')])]);
  });

  // Moving off the end would mean re-parenting — the node would leave its section, which is not what
  // an up/down arrow means. Phase 4 ships sibling reordering only.
  it('never moves a node out of its container', () => {
    const tree = [sectionNode('Q3', [savedReportNode('a'), savedReportNode('b')]), savedReportNode('c')];

    expect(moveNodeAt(tree, [0, 0], -1)).toEqual(tree);
    expect(moveNodeAt(tree, [0, 1], 1)).toEqual(tree);
  });

  it('leaves the tree unchanged at either end of the root', () => {
    const tree = [savedReportNode('a'), savedReportNode('b')];

    expect(moveNodeAt(tree, [0], -1)).toEqual(tree);
    expect(moveNodeAt(tree, [1], 1)).toEqual(tree);
  });

  it('leaves the tree unchanged for a path that does not resolve', () => {
    const tree = [savedReportNode('a'), savedReportNode('b')];

    expect(moveNodeAt(tree, [9], -1)).toEqual(tree);
    expect(moveNodeAt(tree, [0, 0], 1)).toEqual(tree);
    expect(moveNodeAt(tree, [], -1)).toEqual(tree);
  });

  it('does not mutate the input tree', () => {
    const tree = [sectionNode('Q3', [savedReportNode('a'), savedReportNode('b')])];
    const frozen = JSON.stringify(tree);

    moveNodeAt(tree, [0, 1], -1);

    expect(JSON.stringify(tree)).toBe(frozen);
  });

  // A move must not remount the nodes it reorders: a remounted ChildReport refetches from Jira.
  it('carries node identity along with the node', () => {
    const [first, second] = [savedReportNode('a'), savedReportNode('b')];

    expect(moveNodeAt([first, second], [1], -1).map((node) => node.id)).toEqual([second.id, first.id]);
  });
});

describe('canMoveNodeAt', () => {
  const tree = [sectionNode('Q3', [savedReportNode('a'), savedReportNode('b')]), savedReportNode('c')];
  const cases: Array<[LayoutPath, number, boolean]> = [
    [[0], -1, false], // first at the root
    [[0], 1, true],
    [[1], -1, true],
    [[1], 1, false], // last at the root
    [[0, 0], -1, false], // first inside the section — must not escape it
    [[0, 0], 1, true],
    [[0, 1], 1, false], // last inside the section
    [[9], -1, false], // out of range
    [[0, 0, 0], 1, false], // descends into a node with no children
    [[], -1, false],
  ];

  it.each(cases)('is %j %i → %s', (path, offset, expected) => {
    expect(canMoveNodeAt(tree, path, offset)).toBe(expected);
  });

  // It backs the disabled state of the move controls, so a position it reports as movable must
  // actually move — and one it reports as blocked must leave the tree untouched.
  it.each(cases)('agrees with moveNodeAt for %j %i', (path, offset, expected) => {
    expect(moveNodeAt(tree, path, offset) !== tree).toBe(expected);
  });
});

describe('visitNodes', () => {
  it('visits every node depth-first with its path', () => {
    const tree: LayoutNode[] = [
      sectionNode('Q3', [savedReportNode('a'), sectionNode('July', [savedReportNode('b')])]),
      savedReportNode('c'),
    ];
    const visited: Array<[string, number[]]> = [];

    visitNodes(tree, (node, path) => visited.push([node.type, path]));

    expect(visited).toEqual([
      ['section', [0]],
      ['saved-report', [0, 0]],
      ['section', [0, 1]],
      ['saved-report', [0, 1, 0]],
      ['saved-report', [1]],
    ]);
  });
});

describe('pathKey', () => {
  it('distinguishes depth from position', () => {
    expect(pathKey([1, 0])).not.toBe(pathKey([1]));
    expect(pathKey([1, 0])).not.toBe(pathKey([0, 1]));
  });
});
