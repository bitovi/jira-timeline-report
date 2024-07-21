// sum.test.js
import { expect, test } from 'vitest'
import { deriveReleases } from './derive.js'



test('deriveReleases', () => {

    const output = deriveReleases([
        { id: "a", name: "first" },
        { id: "b", name: "second"},
        { id: "c", name: "RELEASE-1.2.3"},
        { id: "c", name: "RELEASE-2"}
    ]);
    // another
    // another
    // some comments

    const derived = output.map( release => release.names );

    expect(derived).toStrictEqual([
        { shortName: "first", shortVersion: null, version: null, semver: false},
        { shortName: "second",  shortVersion: null, version: null, semver: false},
        { shortName: "1.2.3",  shortVersion: "1.2.3", version: "1.2.3", semver: true},
        { shortName: "2", shortVersion: "2", version: "2.0.0", semver: true}
    ]);

    const releases2 = deriveReleases([
        { id: "a", name: "Bitovi-One" },
        { id: "b", name: "Bitovi-Two"}
    ]).map( release => release.names );

    expect(releases2).toStrictEqual([
        { shortName: "One", shortVersion: null, version: null, semver: false},
        { shortName: "Two",  shortVersion: null, version: null, semver: false}
    ]);
})