import { legacyReportsStorageConfig, parseReportsStorageConfig } from './reports-config';

describe('parseReportsStorageConfig', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads a space pointer', () => {
    expect(parseReportsStorageConfig({ kind: 'space', spaceName: 'STATREPS', spaceType: 'Story' })).toEqual({
      kind: 'space',
      spaceName: 'STATREPS',
      spaceType: 'Story',
    });
  });

  // Every install that has never opened the Storage panel lands here, including the plugin store's
  // `{}` seed — so this must be silent, not a warning on every load.
  it.each([[undefined], [null], [{}], ['legacy'], [{ kind: 'legacy' }]])(
    'reads %p as legacy without complaining',
    (stored) => {
      expect(parseReportsStorageConfig(stored)).toEqual(legacyReportsStorageConfig);
      expect(console.warn).not.toHaveBeenCalled();
    },
  );

  // A newer client could write a kind this build has never heard of. Falling back shows the reports
  // this build can actually read; throwing would take the app down over a setting.
  it('falls back to legacy for a kind it does not recognise', () => {
    expect(parseReportsStorageConfig({ kind: 'forge-entity-property' })).toEqual(legacyReportsStorageConfig);
    expect(console.warn).toHaveBeenCalled();
  });

  it('falls back to legacy for a space pointer with nowhere to point', () => {
    expect(parseReportsStorageConfig({ kind: 'space', spaceName: 'STATREPS' })).toEqual(legacyReportsStorageConfig);
    expect(parseReportsStorageConfig({ kind: 'space', spaceName: '', spaceType: 'Story' })).toEqual(
      legacyReportsStorageConfig,
    );
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
