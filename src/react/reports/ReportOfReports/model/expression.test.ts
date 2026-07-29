import { parseExpression, isExpressionError } from './expression';

/** Parses and asserts success, returning the halves — the shape most cases care about. */
const split = (source: string) => {
  const result = parseExpression(source);

  if (isExpressionError(result)) {
    throw new Error(`expected "${source}" to parse, got: ${result.error}`);
  }

  return result;
};

/** Parses and asserts failure, returning the message. */
const errorFor = (source: string) => {
  const result = parseExpression(source);

  if (!isExpressionError(result)) {
    throw new Error(`expected "${source}" to fail, got: ${JSON.stringify(result)}`);
  }

  return result.error;
};

describe('parseExpression', () => {
  it('splits the simple case', () => {
    expect(split('(workItem = SYSTEMS-918).summary')).toEqual({ jql: 'workItem = SYSTEMS-918', field: 'summary' });
  });

  it('ignores surrounding whitespace', () => {
    expect(split('  ( issue = ABC-1 ) . summary  ')).toEqual({ jql: 'issue = ABC-1', field: 'summary' });
  });

  // The four cases that defeat a regex or a naive split. See
  // spec/016-report-of-reports/003-self-reports Phase 1.
  it('is not confused by a parenthesis inside a quoted string', () => {
    expect(split('(summary ~ "foo)bar").duedate')).toEqual({ jql: 'summary ~ "foo)bar"', field: 'duedate' });
  });

  it('is not confused by nested groups', () => {
    expect(split('(project = A AND (x = 1 OR y = 2)).duedate')).toEqual({
      jql: 'project = A AND (x = 1 OR y = 2)',
      field: 'duedate',
    });
  });

  it('is not confused by escaped quotes', () => {
    expect(split('(summary ~ "say \\"hi\\"").summary')).toEqual({
      jql: 'summary ~ "say \\"hi\\""',
      field: 'summary',
    });
  });

  it('keeps a field name that contains spaces', () => {
    expect(split('(key = X).Story points')).toEqual({ jql: 'key = X', field: 'Story points' });
  });

  it('handles single-quoted strings too', () => {
    expect(split("(summary ~ 'foo)bar').summary")).toEqual({ jql: "summary ~ 'foo)bar'", field: 'summary' });
  });

  // A dot inside the JQL must not be mistaken for the accessor — the scanner finds the closing paren
  // first, so where the dots are doesn't matter.
  it('is not confused by a dot inside the JQL', () => {
    expect(split('(summary ~ "v1.2.3").summary')).toEqual({ jql: 'summary ~ "v1.2.3"', field: 'summary' });
  });

  it('keeps a custom field id as the accessor', () => {
    expect(split('(key = X).customfield_10014')).toEqual({ jql: 'key = X', field: 'customfield_10014' });
  });

  describe('errors', () => {
    it('requires a leading parenthesis', () => {
      expect(errorFor('issue = ABC-1.summary')).toMatch(/starts with "\("/);
      expect(errorFor('')).toMatch(/starts with "\("/);
    });

    it('reports an unterminated quote', () => {
      expect(errorFor('(summary ~ "foo).summary')).toMatch(/Unterminated quote/);
      // A trailing backslash consumes the closing quote, so this is unterminated too.
      expect(errorFor('(summary ~ "foo\\").summary')).toMatch(/Unterminated quote/);
    });

    it('reports unbalanced parentheses', () => {
      expect(errorFor('(issue = ABC-1.summary')).toMatch(/Unbalanced/);
      expect(errorFor('(project = A AND (x = 1).summary')).toMatch(/Unbalanced/);
    });

    it('reports empty parentheses', () => {
      expect(errorFor('().summary')).toMatch(/empty/);
      expect(errorFor('(   ).summary')).toMatch(/empty/);
    });

    it('reports a missing accessor', () => {
      expect(errorFor('(issue = ABC-1)')).toMatch(/Add a field/);
      expect(errorFor('(issue = ABC-1) summary')).toMatch(/Add a field/);
    });

    it('reports an empty accessor', () => {
      expect(errorFor('(issue = ABC-1).')).toMatch(/Name a field/);
    });

    // Deferred, not silently truncated: a user field already renders as its display name, so
    // `.assignee` is what the user wants here. See the plan's Out of scope.
    it('reports a multi-hop accessor', () => {
      expect(errorFor('(issue = ABC-1).assignee.displayName')).toMatch(/Only one field/);
    });
  });
});
