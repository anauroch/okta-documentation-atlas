import { useMemo, useState } from "react";
import { PRODUCTS } from "@/data/docsTree";
import { RELEASES } from "@/data/releases";
import type { ProductKey, Release } from "@/data/types";
import { isHot, isNew, isUpcoming, relText } from "@/lib/releases";

type Tab = "latest" | "upcoming" | "feeds";

interface Props {
  winDays: number;
  setWinDays: (n: number) => void;
  read: Set<string>;
  setRead: (s: Set<string>) => void;
  hidden: Set<ProductKey>;
  onShow: (id: string) => void;
}

export default function ReleaseRadar({ winDays, setWinDays, read, setRead, hidden, onShow }: Props) {
  const [tab, setTab] = useState<Tab>("latest");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const hotCount = RELEASES.filter((r) => isHot(r, winDays, read)).length;

  const list = useMemo(() => {
    let rs = RELEASES.filter((r) => !hidden.has(r.prod));
    rs = tab === "upcoming"
      ? rs.filter((r) => isUpcoming(r)).sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      : rs.filter((r) => !isUpcoming(r)).sort((a, b) => (b.date || "0").localeCompare(a.date || "0"));
    if (unreadOnly && tab === "latest") rs = rs.filter((r) => isHot(r, winDays, read));
    return rs;
  }, [tab, unreadOnly, hidden, winDays, read]);

  const toggle = (id: string) => { const s = new Set(read); if (s.has(id)) s.delete(id); else s.add(id); setRead(s); };
  const markAll = () => { const s = new Set(read); RELEASES.filter((r) => isNew(r, winDays)).forEach((r) => s.add(r.id)); setRead(s); };

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
          {[7, 14, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
        <label className="eyebrow flex items-center gap-1.5">
          <input id="unreadOnly" type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only
        </label>
      </div>
      <div className="tabs" role="tablist">
        {([["latest", "Latest"], ["upcoming", "Upcoming"], ["feeds", "Where to follow"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "feeds" ? <Feeds /> : (
        <ul className="rlist">
          {list.length === 0 && <li className="empty">Nothing here for the current filters.</li>}
          {list.map((r) => <Item key={r.id} r={r} winDays={winDays} read={read} onToggle={toggle} onShow={onShow} />)}
        </ul>
      )}
    </div>
  );
}

function Item({ r, winDays, read, onToggle, onShow }: { r: Release; winDays: number; read: Set<string>; onToggle: (id: string) => void; onShow: (id: string) => void }) {
  const up = isUpcoming(r), nw = isNew(r, winDays), rd = read.has(r.id);
  const cls = "rel-item" + (up ? " is-up" : nw && !rd ? " is-new" : "") + (rd && nw ? " read" : "");
  return (
    <li className={cls}>
      <div className="row">
        <span className="prod"><i style={{ background: PRODUCTS[r.prod].color }} />{PRODUCTS[r.prod].name}</span>
        <span className="pill">{r.chan}</span>
        {up ? <span className="pill up">Upcoming</span> : nw && !rd ? <span className="pill new">New</span> : null}
        <span className="when">{relText(r)}</span>
      </div>
      <div className="ver">{r.ver}</div>
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
        <li><b>Identity Engine / Classic:</b> monthly release (x.0) to Preview first, Production about a week later, then weekly updates (x.1, x.2…). Check the Preview page for "Preview org features" before they reach Production.</li>
        <li><b>Workflows:</b> own Preview/Production pages, roughly weekly.</li>
        <li><b>Identity Governance &amp; Privileged Access:</b> separate notes under the Identity Engine release notes hub.</li>
        <li><b>ISPM:</b> dated announcements, a few per month.</li>
        <li><b>Access Gateway:</b> versioned appliance releases, each supported for one year.</li>
        <li><b>API changes:</b> <a href="https://developer.okta.com/docs/release-notes/" target="_blank" rel="noopener noreferrer">developer.okta.com release notes</a> publish an RSS feed per category.</li>
      </ul>
      <p className="mt-2 text-ink-3">Release data lives in <code>src/data/releases.ts</code>. Update that file to refresh the radar.</p>
    </div>
  );
}
