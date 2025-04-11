/**
 * This module processes a list of unsorted release strings by extracting and standardizing their version numbers,
 * sorting them using semantic versioning, and generating unique short names for each release.
 */

import semver from "semver";
import uniqueTrailingNames from "./unique-trailing-names";

interface UnsortedRelease {
  release: string;
}

interface SemverRelease {
  release: string;
  shortName: string;
  version: string | undefined;
  shortVersion: string | undefined;
}

function partialReleaseName(release: string): string | undefined {
  let match = release.match(/(?:\d+\.\d+\.[\dX]+)|(?:\d+\.[\dX]+)|(?:\d+)$/);
  if (match) {
    return match[0].replace(".X", ".0");
  }
}

export function cleanedRelease(release: string): string | undefined {
  let clean = partialReleaseName(release);
  if (clean) {
    if (clean.length === 1) {
      clean = clean + ".0.0";
    }
    if (clean.length === 3) {
      clean = clean + ".0";
    }
    if (semver.clean(clean)) {
      return clean;
    }
  }
}

export function semverSort(values: string[]): string[] {
  const cleanMap: Record<string, string> = {};
  const cleanValues: string[] = [];
  values.forEach((release: string) => {
    const clean = cleanedRelease(release);
    if (clean && semver.clean(clean)) {
      cleanMap[clean] = release;
      cleanValues.push(clean);
    }
  });
  const cleanSorted = semver.sort(cleanValues);
  return cleanSorted.map((clean: string) => cleanMap[clean]);
}

export default function deriveReleases(
  unsortedReleases: UnsortedRelease[]
): SemverRelease[] {
  const releaseToReleaseObject: Record<string, UnsortedRelease> = {};
  for (let releaseObject of unsortedReleases) {
    releaseToReleaseObject[releaseObject.release] = releaseObject;
  }

  const semverReleases: string[] = semverSort(
    Object.keys(releaseToReleaseObject)
  );

  const shortReleaseNames: string[] = uniqueTrailingNames(semverReleases);

  return semverReleases.map((release: string, index: number): SemverRelease => {
    return {
      ...releaseToReleaseObject[release],
      release: release,
      shortName: shortReleaseNames[index],
      version: cleanedRelease(release),
      shortVersion: partialReleaseName(release),
    };
  });
}
