import { parseLayout } from './usePickerLayout';

// See spec/031-column-select-redesign § 3.
describe('parseLayout', () => {
  it('defaults to expanded on the empty string, without throwing', () => {
    // This is the missing-key case: `useLocalStorage.ts:11` calls `deserialize(getItem(key) ?? '')`,
    // and `JSON.parse('')` throws — so a first-ever mount crashes without this guard.
    expect(() => parseLayout('')).not.toThrow();
    expect(parseLayout('')).toBe('expanded');
  });

  it('reads back what the default serializer wrote', () => {
    expect(parseLayout(JSON.stringify('compact'))).toBe('compact');
    expect(parseLayout(JSON.stringify('expanded'))).toBe('expanded');
  });

  it('falls back to expanded for a value nobody should have written', () => {
    expect(parseLayout('"nonsense"')).toBe('expanded');
    expect(parseLayout('not json')).toBe('expanded');
    expect(parseLayout('null')).toBe('expanded');
    expect(parseLayout('{"layout":"compact"}')).toBe('expanded');
  });
});
