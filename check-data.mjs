#!/usr/bin/env node
/**
 * Guards the release radar data against unreviewed or invented edits.
 *
 *   node scripts/check-data.mjs         validate + verify lock (runs before every build)
 *   node scripts/check-data.mjs --lock  validate + write a new lock after you have reviewed the data
 *
 * The lock is a SHA-256 of src/data/releases.json. Any change to the JSON, by a person
 * or an AI agent, fails the build until someone re-runs --lock deliberately.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, "src/data/releases.json");
const lockPath = join(root, "src/data/releases.lock");
const treePath = join(root, "src/data/docsTree.ts");

const PRODUCTS = new Set(["oie", "oce", "wf", "oag", "ispm", "mcp", "aerial", "res"]);
const ALLOWED_HOSTS = new Set(["help.okta.com", "developer.okta.com"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const raw = readFileSync(jsonPath, "utf8");
const errors = [];
let data;
try { data = JSON.parse(raw); } catch (e) { console.error(`releases.json is not valid JSON: ${e.message}`); process.exit(1); }

// release-notes page ids that exist in the docs tree
const tree = readFileSync(treePath, "utf8");
const pageIds = new Set([...tree.matchAll(/["'](rn-[a-z0-9-]+)["']/g)].map((m) => m[1]));

if (!ISO.test(data.snapshotDate ?? "")) errors.push("snapshotDate must be YYYY-MM-DD");
if (!Array.isArray(data.releases) || data.releases.length === 0) errors.push("releases must be a non-empty array");

const seen = new Set();
for (const [i, r] of (data.releases ?? []).entries()) {
  const at = `releases[${i}] (${r?.id ?? "no id"})`;
  if (!r || typeof r !== "object") { errors.push(`${at}: not an object`); continue; }
  if (!r.id || seen.has(r.id)) errors.push(`${at}: missing or duplicate id`);
  seen.add(r.id);
  if (!PRODUCTS.has(r.prod)) errors.push(`${at}: unknown prod "${r.prod}"`);
  if (!pageIds.has(r.parent)) errors.push(`${at}: parent "${r.parent}" is not a release-notes page in docsTree.ts`);
  if (!r.ver || !r.chan) errors.push(`${at}: ver and chan are required`);
  if (r.date !== null && !ISO.test(r.date ?? "")) errors.push(`${at}: date must be YYYY-MM-DD or null`);
  if (r.date && !r.upcoming && r.date > data.snapshotDate) errors.push(`${at}: shipped date ${r.date} is after snapshotDate ${data.snapshotDate}; mark it upcoming or fix the date`);
  if (r.upcoming && r.date && r.date <= data.snapshotDate) errors.push(`${at}: upcoming entry dated on/before snapshotDate; it has shipped or the date is wrong`);
  try {
    const u = new URL(r.url);
    if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.host)) errors.push(`${at}: url must be https on ${[...ALLOWED_HOSTS].join(" or ")}`);
  } catch { errors.push(`${at}: url is not a valid URL`); }
  if (!Array.isArray(r.items) || r.items.length === 0 || r.items.some((s) => typeof s !== "string" || !s.trim()))
    errors.push(`${at}: items must be a non-empty list of strings`);
}

if (errors.length) {
  console.error("Release data failed validation:\n  - " + errors.join("\n  - "));
  process.exit(1);
}

const hash = createHash("sha256").update(raw).digest("hex");

if (process.argv.includes("--lock")) {
  writeFileSync(lockPath, hash + "\n");
  console.log(`releases.json validated (${data.releases.length} entries) and locked: ${hash.slice(0, 12)}…`);
  process.exit(0);
}

const locked = existsSync(lockPath) ? readFileSync(lockPath, "utf8").trim() : "";
if (locked !== hash) {
  console.error(
    "src/data/releases.json changed since it was last reviewed.\n" +
    "Check every new or changed entry against its url on help.okta.com, then run:\n\n" +
    "  npm run data:lock\n\n" +
    "and commit releases.json together with releases.lock.",
  );
  process.exit(1);
}
console.log(`releases.json OK (${data.releases.length} entries, lock ${hash.slice(0, 12)}…)`);
