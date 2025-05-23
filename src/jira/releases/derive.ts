/**
 * This module processes normalized release data to derive additional release information.
 * It extracts and standardizes version numbers, sorts releases using semantic versioning,
 * and generates unique short names for each release.
 */

import { NormalizedRelease } from '../shared/types';
import uniqueTrailingNames from './unique-trailing-names';
import semver from 'semver';

export type DerivedRelease = NormalizedRelease & {
  names: {
    semver: boolean;
    shortName: string;
    shortVersion: string | null;
    version: string | null;
  };
};
/**
 * Extracts and standardizes the version number from a release string.
 * For example "Release 1.2.3" becomes "1.2.3".
 * If a wildcard "X" is present in the minor or patch version, it is replaced with "0" to standardize the format.
 * For example, "1.2.X" becomes "1.2.0".
 */
function partialReleaseName(release: string): string | undefined {
  let match = release.match(/(?:\d+\.\d+\.[\dX]+)|(?:\d+\.[\dX]+)|(?:\d+)$/);
  if (match) {
    return match[0].replace('.X', '.0');
  }
}

export function cleanedRelease(release: string): string | undefined {
  let clean = partialReleaseName(release);
  if (clean) {
    if (clean.length === 1) {
      clean = clean + '.0.0';
    }
    if (clean.length === 3) {
      clean = clean + '.0';
    }
    if (semver.clean(clean)) {
      return clean;
    }
  }
}

export function semverSort(values: string[]): string[] {
  const cleanMap: Record<string, string> = {};
  const cleanValues: string[] = [];
  values.forEach((release) => {
    const clean = cleanedRelease(release);
    if (clean && semver.clean(clean)) {
      cleanMap[clean] = release;
      cleanValues.push(clean);
    }
  });
  const cleanSorted = semver.sort(cleanValues);
  return cleanSorted.map((clean) => cleanMap[clean]);
}

/**
 * @typedef {{
 *   semver: Boolean,
 *   version: String | null,
 *   shortVersion: String | null,
 *   shortName: String
 * }} DerivedReleaseNames
 */

/**
 * @param {Array<import("../shared/types").NormalizedRelease>} normalizedReleases
 * @returns {DerivedRelease[]}
 */

export function deriveReleases(normalizedReleases: Array<NormalizedRelease>): Array<DerivedRelease> {
  const semverNames = normalizedReleases.map((normalizedRelease) => {
    const semverReleaseName = cleanedRelease(normalizedRelease.name) || null;
    const version = semverReleaseName ? semver.clean(semverReleaseName) : null;
    const shortVersion = semverReleaseName ? (partialReleaseName(normalizedRelease.name) ?? null) : null;

    return {
      semver: !!semverReleaseName,
      version,
      shortVersion,
    };
  });

  const namesToShorten = semverNames.map(({ shortVersion }, i) => {
    return shortVersion || normalizedReleases[i].name;
  });
  const shortNames = uniqueTrailingNames(namesToShorten);
  return normalizedReleases.map((normalizedRelease, index) => ({
    ...normalizedRelease,
    names: {
      ...semverNames[index],
      shortName: shortNames[index],
    },
  }));
}
