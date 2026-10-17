import { useMemo, useState } from "react";
import { PRODUCTS } from "@/data/docsTree";
import { RELEASES } from "@/data/releases";
import type { ProductKey, Release } from "@/data/types";
import { copyText, isHot, isNew, isUpcoming, relText, shortDate, weekOf, WINDOW_CHOICES } from "@/lib/releases";

type Tab = "latest" | "upcoming" | "feeds";
type Show = "all" | "unread" | "since";

interface Props {
  winDays: number;
  setWinDays: (n: number) => void;
  read: Set<string>;
  setRead: (s: Set<string>) => void;
  hidden: Set<ProductKey>;
  onShow: (id: string) => void;
  /** date (YYYY-MM-DD) of the viewer's previous visit, null on a first visit */
  lastVisit: string | null;
}

/** Markdown bullets for pasting into an email, Teams or a customer update. */
function summarise(rs: Release[]): string {
  return rs.map((r) => {
    const wk = weekOf(r.ver);
    const head = `${PRODUCTS[r.prod].name} ${r.ver}${wk ? ` (week ${wk})` : ""}, ${r.chan}, ${shortDate(r)}`;
    return `- **${head}**: ${r.items.join("; ")}\n  ${r.url}`;
  }).join("\n");
}

export default function ReleaseRadar({ winDays, setWinDays, read, setRead, hidden, onShow, lastVisit }: Props) {
  const [tab, setTab] = useState<Tab>("latest");
  const [show, setShow] = useState<Show>("all");
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");

  const hotCount = RELEASES.filter((r) => isHot(r, winDays, read)).length;
  const sinceCount = lastVisit ? RELEASES.filter((r) => !isUpcoming(r) && !!r.date && !r.approx && r.date > lastVisit).length : 0;

  const list = useMemo(() => {
    let rs = RELEASES.filter((r) => !hidden.has(r.prod));
    rs = tab === "upcoming"
      ? rs.filter((r) => isUpcoming(r)).sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      : rs.filter((r) => !isUpcoming(r)).sort((a, b) => (b.date || "0").localeCompare(a.date || "0"));
    if (tab === "latest" && show === "unread") rs = rs.filter((r) => isHot(r, winDays, read));
    if (tab === "latest" && show === "since") rs = lastVisit ? rs.filter((r) => !!r.date && !r.approx && r.date > lastVisit) : [];
    return rs;
  }, [tab, show, hidden, winDays, read, lastVisit]);

  const toggle = (id: string) => { const s = new Set(read); if (s.has(id)) s.delete(id); else s.add(id); setRead(s); };
  const markAll = () => { const s = new Set(read); RELEASES.filter((r) => isNew(r, winDays)).forEach((r) => s.add(r.id)); setRead(s); };
  const copy = async () => {
    const ok = await copyText(summarise(list));
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied(""), 2500);
  };

  return (
    <div className="card">
      <div className="radar-head">
        <span className="eyebrow">Release radar</span>
        {hotCount > 0 && <span className="badge">{hotCount} new</span>}
        <span className="flex-1" />
        <button className="btn" onClick={markAll}>Mark all read</button>
      </div>
      <h2 className="mt-1.5">What changed across Okta products</h2>
      <div className="radar-tools">
        <label htmlFor="win" className="eyebrow">Flag as new within</label>
        <select id="win" value={winDays} onChange={(e) => setWinDays(+e.target.value)}>
          {WINDOW_CHOICES.map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
        <label htmlFor="show" className="eyebrow">Show</label>
        <select id="show" value={show} onChange={(e) => setShow(e.target.value as Show)}>
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="since" disabled={!lastVisit}>
            {lastVisit ? `Since last visit (${sinceCount})` : "Since last visit (first visit)"}
          </option>
        </select>
      </div>
      <div className="tabs" role="tablist">
        {([["latest", "Latest"], ["upcoming", "Upcoming"], ["feeds", "Where to follow"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "feeds" ? <Feeds /> : (
        <>
          <div className="list-tools">
            <span className="eyebrow">{list.length} {list.length === 1 ? "entry" : "entries"}</span>
            <button className="btn" onClick={copy} disabled={!list.length} aria-live="polite">
              {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed: select and copy manually" : "Copy summary"}
            </button>
          </div>
          <ul className="rlist">
            {list.length === 0 && (
              <li className="empty">
                {show === "since" ? `Nothing new since your last visit on ${lastVisit}.` : "Nothing here for the current filters."}
              </li>
            )}
            {list.map((r) => <Item key={r.id} r={r} winDays={winDays} read={read} onToggle={toggle} onShow={onShow} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function Item({ r, winDays, read, onToggle, onShow }: { r: Release; winDays: number; read: Set<string>; onToggle: (id: string) => void; onShow: (id: string) => void }) {
  const up = isUpcoming(r), nw = isNew(r, winDays), rd = read.has(r.id);
  const wk = weekOf(r.ver);
  const cls = "rel-item" + (up ? " is-up" : nw && !rd ? " is-new" : "") + (rd && nw ? " read" : "");
  return (
    <li className={cls} id={`rel-${r.id}`}>
      <div className="row">
        <span className="prod"><i style={{ background: PRODUCTS[r.prod].color }} />{PRODUCTS[r.prod].name}</span>
        <span className="pill">{r.chan}</span>
        {up ? <span className="pill up">Upcoming</span> : nw && !rd ? <span className="pill new">New</span> : null}
        <span className="when">{relText(r)}</span>
      </div>
      <div className="ver">{r.ver}{wk && <span className="wk" title="Okta versions are year.week since October 2026">week {wk}</span>}</div>
      <ul>{r.items.map((i) => <li key={i}>{i}</li>)}</ul>
      <div className="acts">
        <a href={r.url} target="_blank" rel="noopener noreferrer">Read notes ↗</a>
        <button onClick={() => onShow(r.id)}>Show on map</button>
        {!up && <button onClick={() => onToggle(r.id)}>{rd ? "Mark unread" : "Mark read"}</button>}
      </div>
    </li>
  );
}

function Feeds() {
  return (
    <div className="feeds">
      <p className="mt-2.5 mb-1">Release cadence differs per product. What to watch:</p>
      <ul>
        <li><b>Identity Engine / Classic:</b> since October 2026 versions are year.week (2026.41.0 is week 41). Releases reach Preview first and Production about a week later, with weekly updates (.1, .2) in between. Check the Preview page for "Preview org features" before they reach Production.</li>
        <li><b>Workflows:</b> own Preview/Production pages, roughly weekly.</li>
        <li><b>Identity Governance &amp; Privileged Access:</b> separate notes under the Identity Engine release notes hub.</li>
        <li><b>ISPM:</b> dated announcements, a few per month.</li>
        <li><b>Access Gateway:</b> versioned appliance releases, each supported for one year.</li>
        <li><b>API changes:</b> <a href="https://developer.okta.com/docs/release-notes/" target="_blank" rel="noopener noreferrer">developer.okta.com release notes</a> publish an RSS feed per category.</li>
      </ul>
      <p className="mt-2 text-ink-3">Every entry links to the Okta page it was taken from. Snapshot, not a live feed: check the linked release notes before acting on anything here.</p>
    </div>
  );
}
