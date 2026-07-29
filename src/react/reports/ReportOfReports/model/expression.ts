/**
 * Splits an inline-value expression into its two halves.
 *
 *     (workItem = SYSTEMS-918).summary
 *      └────────┬──────────┘  └──┬──┘
 *             JQL              field
 *
 * The inner half is JQL; the outer half is a Jira field, which is just the `fields` argument every
 * search in this app already carries. See spec/016-report-of-reports/003-self-reports.
 */

export interface ParsedExpression {
  /** The JQL between the outermost parentheses, trimmed. */
  jql: string;
  /** The accessor after the closing parenthesis — a field id, display name, or JQL clause name. */
  field: string;
}

export interface ExpressionError {
  /** User-facing: this renders in the document where the value would have been. */
  error: string;
}

export type ExpressionResult = ParsedExpression | ExpressionError;

export const isExpressionError = (result: ExpressionResult): result is ExpressionError => 'error' in result;

const EXAMPLE = '(issue = ABC-1).summary';

/**
 * Parses an expression, returning either its halves or a message explaining what's wrong. Never
 * throws — a malformed expression is something the user is mid-way through typing, not an exception.
 *
 * **A regex can't do this.** The closing parenthesis is found by scanning with paren depth *and*
 * quote state, because JQL strings can contain parentheses (`summary ~ "foo)bar"`) and clauses can
 * nest (`(project = A AND (x = 1 OR y = 2)).duedate`) — which also defeats `lastIndexOf('.')`, since
 * a field name may contain a dot-free string but the JQL may not.
 */
export const parseExpression = (source: string): ExpressionResult => {
  const trimmed = source.trim();

  if (!trimmed.startsWith('(')) {
    return { error: `An expression starts with "(" — for example ${EXAMPLE}` };
  }

  let depth = 0;
  let quote: string | null = null;
  let close = -1;

  for (let at = 0; at < trimmed.length; at++) {
    const char = trimmed[at];

    if (quote) {
      // A backslash escapes the next character, so `"say \"hi\""` is one string, not three.
      if (char === '\\') {
        at++;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;

      if (depth === 0) {
        close = at;
        break;
      }
    }
  }

  if (quote) {
    return { error: 'Unterminated quote in the JQL.' };
  }

  if (close === -1) {
    return { error: 'Unbalanced parentheses — the opening "(" has no matching ")".' };
  }

  const jql = trimmed.slice(1, close).trim();

  if (!jql) {
    return { error: 'The parentheses are empty — put a JQL query inside them.' };
  }

  const rest = trimmed.slice(close + 1).trim();

  if (!rest.startsWith('.')) {
    return { error: `Add a field after the closing ")" — for example ${EXAMPLE}` };
  }

  // Not trimmed further than the ends: field names legitimately contain spaces ("Story points"), so
  // anything unexpected here is left for the field resolver to report by name.
  const field = rest.slice(1).trim();

  if (!field) {
    return { error: `Name a field after the "." — for example ${EXAMPLE}` };
  }

  if (field.includes('.')) {
    return { error: `Only one field is supported, so "${field}" won't work. Use the field itself.` };
  }

  return { jql, field };
};
