import type { Release } from "@/data/types";
import { SNAPSHOT_DATE } from "@/data/releases";

const DAY = 864e5;
const at = (d: string) => new Date(d + "T12:00:00");

/** "Now" never goes earlier than the snapshot, so a stale clock can't hide releases. */
export function nowDate(): Date {
  const snap = at(SNAPSHOT_DATE);
  const today = new Date();
  return today > snap ? today : snap;
}

export function ageDays(r: Release, now = nowDate()): number | null {
  if (!r.date) return null;
  return Math.floor((now.getTime() - at(r.date).getTime()) / DAY);
}
export const isUpcoming = (r: Release, now = nowDate()) => !!r.upcoming || (!!r.date && at(r.date) > now);
export function isNew(r: Release, winDays: number, now = nowDate()) {
  const a = ageDays(r, now);
  return !isUpcoming(r, now) && a != null && a >= 0 && a <= winDays;
}
export const isHot = (r: Release, winDays: number, read: Set<string>) => isNew(r, winDays) && !read.has(r.id);

const fmt = (d: string) => at(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export function relText(r: Release): string {
  if (!r.date) return "undated";
  if (r.approx) return at(r.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const a = ageDays(r)!;
  if (a < 0) return `in ${-a} d · ${fmt(r.date)}`;
  if (a === 0) return "today";
  return `${a} d ago · ${fmt(r.date)}`;
}

/* Per-viewer storage. Wrapped because private windows can throw, and validated because
   anything in localStorage can be edited by the user or another script on the origin. */
export const STORAGE_KEYS = ["oda-read", "oda-win", "oda-seen"] as const;

export const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  /** list of ids; anything that isn't an array of short strings falls back to [] */
  getIds(k: string, known: Set<string>): string[] {
    const v = store.get<unknown>(k, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && known.has(x)) : [];
  },
  /** number restricted to an allow-list */
  getChoice(k: string, allowed: readonly number[], d: number): number {
    const v = store.get<unknown>(k, d);
    return typeof v === "number" && allowed.includes(v) ? v : d;
  },
  clearAll() { try { STORAGE_KEYS.forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } },
};

export const WINDOW_CHOICES = [7, 14, 30, 90] as const;

/**
 * Okta switched to year.week versions in October 2026 (2026.10.0 became 2026.41.0).
 * Returns the week number for year.week versions, or null for the older year.month ones.
 */
export function weekOf(ver: string): number | null {
  const m = ver.match(/(\d{4})\.(\d{2})\.\d+/);
  if (!m) return null;
  const n = Number(m[2]);
  return n > 12 && n <= 53 ? n : null;
}

/** Short date for summaries, e.g. "12 Oct 2026" or "Oct 2026" when only the month is known. */
export function shortDate(r: Release): string {
  if (!r.date) return "undated";
  return at(r.date).toLocaleDateString("en-GB", r.approx ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Last-visit tracking for the "Since last visit" filter. `previous` is the visit before this one
 * (null on a first visit); the current time is stored for next time.
 */
export function rollLastVisit(): string | null {
  const prev = store.get<unknown>("oda-seen", null);
  const valid = typeof prev === "string" && /^\d{4}-\d{2}-\d{2}$/.test(prev) ? prev : null;
  store.set("oda-seen", new Date().toISOString().slice(0, 10));
  return valid;
}

/** Copy text to the clipboard; falls back to a hidden textarea when the async API is refused. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove(); return ok;
  } catch { return false; }
}
