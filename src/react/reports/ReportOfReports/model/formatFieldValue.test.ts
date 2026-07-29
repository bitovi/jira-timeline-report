import { formatFieldValue } from './formatFieldValue';

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
