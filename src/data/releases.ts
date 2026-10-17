import type { Release } from "./types";
import data from "./releases.json";

/**
 * Release radar entries, verified against help.okta.com.
 *
 * The data lives in releases.json so it can be validated and hash-locked outside
 * the TypeScript build. Every edit must be followed by `npm run data:lock` after
 * a human has checked each entry against its `url`. `npm run build` refuses to
 * run if the JSON changed without a new lock (see scripts/check-data.mjs).
 */
export const SNAPSHOT_DATE: string = data.snapshotDate;
export const RELEASES: Release[] = data.releases as Release[];
