import type { StoredNode } from './sections';

import { SECTIONS_PARAM, decodeSections, encodeSections, sectionsBaseline } from './documentParam';
import { inlineReportNode, savedReportNode, sectionNode } from './sections';

describe('documentParam', () => {
  it('names the param after the stored field', () => {
    expect(SECTIONS_PARAM).toBe('sections');
  });

  it('round-trips a tree with all four node types', () => {
    // The fourth type, `unknown`, has no constructor — it only ever comes out of a parse.
    const unknown = decodeSections(JSON.stringify([{ type: 'chart', params: { kind: 'pie' } }]))!;

    const tree = [
      sectionNode('Q3', [savedReportNode('abc-123'), inlineReportNode('(issue = ABC-1).summary')]),
      ...unknown,
    ];

    const encoded = encodeSections(tree);

    expect(encoded).toBe(
      JSON.stringify([
        {
          type: 'section',
          params: { title: 'Q3' },
          children: [
            { type: 'saved-report', params: { reportId: 'abc-123' } },
            { type: 'inline-report', params: { expression: '(issue = ABC-1).summary' } },
          ],
        },
        { type: 'chart', params: { kind: 'pie' } },
      ]),
    );

    expect(encodeSections(decodeSections(encoded)!)).toBe(encoded);
  });

  // The guarantee `toStoredSections` already makes; this pins that a trip through the URL doesn't
  // erode it. An older client that merely opened and refreshed a document would otherwise silently
  // drop whatever a newer one had written.
  it('keeps an unknown node and an unknown key byte-identical across encode → decode → encode', () => {
    const raw = JSON.stringify([
      { type: 'section', params: { title: 'Q3', columns: 2 }, children: [], collapsed: true },
      { type: 'chart', params: { kind: 'pie' } },
    ]);

    expect(encodeSections(decodeSections(raw)!)).toBe(raw);
  });

  it('reads an absent param as "no opinion", not as an empty document', () => {
    expect(decodeSections(null)).toBeNull();
    expect(decodeSections(undefined)).toBeNull();
  });

  it('degrades malformed JSON to an empty document rather than throwing', () => {
    expect(decodeSections('{not json')).toEqual([]);
    expect(decodeSections('')).toEqual([]);
  });

  // parseSections' own contract: a non-array is an empty tree.
  it('degrades a well-formed non-array to an empty document', () => {
    expect(decodeSections('{"type":"section"}')).toEqual([]);
  });

  describe('sectionsBaseline', () => {
    it('is an empty document when nothing is open', () => {
      expect(sectionsBaseline()).toBe('[]');
      expect(sectionsBaseline({})).toBe('[]');
    });

    // The param is written only when the tree differs from this, so a baseline that didn't match
    // what `encodeSections` produces for the saved tree would leave every document permanently
    // dirty. A section saved without `children` is the case that catches it.
    it('matches what encodeSections produces for the saved tree', () => {
      const saved = [{ type: 'section', params: { title: 'Q3' } }] as unknown as StoredNode[];

      expect(sectionsBaseline({ sections: saved })).toBe(
        JSON.stringify([{ type: 'section', params: { title: 'Q3' }, children: [] }]),
      );
    });
  });
});
