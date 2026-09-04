import { classifyFieldValue, formatFieldValue } from './formatFieldValue';

describe('formatFieldValue', () => {
  it('renders a string', () => {
    expect(formatFieldValue('Migrate auth to OIDC', { type: 'string' })).toBe('Migrate auth to OIDC');
  });

  it('renders a number', () => {
    expect(formatFieldValue(8, { type: 'number' })).toBe('8');
    expect(formatFieldValue(0, { type: 'number' })).toBe('0');
  });

  // Matches the Table report's date convention (`fieldTypeRegistry.ts`) so the two agree on screen.
  it('renders a date as YYYY-MM-DD', () => {
    expect(formatFieldValue('2026-08-14', { type: 'date' })).toBe('2026-08-14');
    expect(formatFieldValue('2026-08-14T17:05:00.000+0000', { type: 'datetime' })).toBe('2026-08-14');
  });

  it('renders a user by display name', () => {
    expect(formatFieldValue({ accountId: 'x', displayName: 'Ada Lovelace' }, { type: 'user' })).toBe('Ada Lovelace');
  });

  it('renders a status, priority, or issue type by name', () => {
    expect(formatFieldValue({ name: 'In Progress' }, { type: 'status' })).toBe('In Progress');
    expect(formatFieldValue({ name: 'High' }, { type: 'priority' })).toBe('High');
  });

  it('renders a select option by value', () => {
    expect(formatFieldValue({ id: '1', value: 'Platform' }, { type: 'option' })).toBe('Platform');
  });

  it('joins an array using its item type', () => {
    expect(formatFieldValue(['api', 'auth'], { type: 'array', items: 'string' })).toBe('api, auth');
    expect(formatFieldValue([{ name: 'Backend' }, { name: 'Web' }], { type: 'array', items: 'component' })).toBe(
      'Backend, Web',
    );
  });

  it('renders an empty value as empty text, not "null"', () => {
    expect(formatFieldValue(null, { type: 'string' })).toBe('');
    expect(formatFieldValue(undefined, { type: 'number' })).toBe('');
    expect(formatFieldValue('', { type: 'string' })).toBe('');
    expect(formatFieldValue([], { type: 'array', items: 'string' })).toBe('');
  });

  it('falls back to the value itself when the schema is unknown', () => {
    expect(formatFieldValue('anything')).toBe('anything');
    expect(formatFieldValue(42)).toBe('42');
  });

  describe('values it refuses to render', () => {
    // `String(adf)` prints "[object Object]". Saying "unsupported" is the honest failure.
    it('refuses an ADF document', () => {
      const description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] };

      expect(formatFieldValue(description, { type: 'string' })).toBeNull();
    });

    it('refuses an object with no label', () => {
      expect(formatFieldValue({ shape: 'unexpected' }, { type: 'any' })).toBeNull();
    });

    it('refuses an array holding something it cannot render', () => {
      expect(formatFieldValue([{ name: 'ok' }, { shape: 'unexpected' }], { type: 'array' })).toBeNull();
    });

    it('refuses an unparseable date', () => {
      expect(formatFieldValue('not a date', { type: 'date' })).toBeNull();
    });
  });
});

describe('classifyFieldValue', () => {
  // Jira reports `schema.type: "string"` for a plain text field and a wiki-markup paragraph field
  // alike — `schema.custom` is the only signal that tells them apart. See
  // spec/030-inline-custom-field-report.
  const wikiSchema = { type: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textarea' };

  it('classifies a plain string as text, unaffected by this change', () => {
    expect(classifyFieldValue('Migrate auth to OIDC', { type: 'string' })).toEqual({
      kind: 'text',
      text: 'Migrate auth to OIDC',
    });
  });

  it('classifies a string field whose custom type is a paragraph field as wiki markup', () => {
    const markup =
      'h1. Status\n\n* Shipped the migration\n* Rolled back the old endpoint\n\n' +
      '||Env||State||\n|prod|green|\n|staging|green|\n';

    expect(classifyFieldValue(markup, wikiSchema)).toEqual({ kind: 'wiki', markup });
  });

  it('does not classify a plain string field as wiki markup just because it contains markup-like text', () => {
    // Only `schema.custom` decides this — a Summary containing literal asterisks stays plain text.
    expect(classifyFieldValue('h1. not actually a heading', { type: 'string' })).toEqual({
      kind: 'text',
      text: 'h1. not actually a heading',
    });
  });

  it('classifies an ADF document instead of refusing it', () => {
    const description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] };

    expect(classifyFieldValue(description, { type: 'string' })).toEqual({ kind: 'adf', document: description });
  });

  it('classifies an empty value as empty, unaffected by this change', () => {
    expect(classifyFieldValue(null, { type: 'string' })).toEqual({ kind: 'empty' });
    expect(classifyFieldValue(undefined, { type: 'number' })).toEqual({ kind: 'empty' });
    expect(classifyFieldValue('', wikiSchema)).toEqual({ kind: 'empty' });
    // An empty array classifies as empty text, not the `empty` kind itself — it's still an array of
    // (zero) members, each of which would be text, not nothing. `formatFieldValue` maps both to `''`.
    expect(classifyFieldValue([], { type: 'array', items: 'string' })).toEqual({ kind: 'text', text: '' });
  });

  it('classifies an array by joining its members as text, unaffected by this change', () => {
    expect(classifyFieldValue(['api', 'auth'], { type: 'array', items: 'string' })).toEqual({
      kind: 'text',
      text: 'api, auth',
    });
  });

  it('classifies a date as text, unaffected by this change', () => {
    expect(classifyFieldValue('2026-08-14', { type: 'date' })).toEqual({ kind: 'text', text: '2026-08-14' });
  });

  it('classifies an object with no label as unsupported, unaffected by this change', () => {
    expect(classifyFieldValue({ shape: 'unexpected' }, { type: 'any' })).toEqual({
      kind: 'unsupported',
      schemaType: 'any',
    });
  });
});
