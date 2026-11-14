import type { Atlas } from "@/data/types";
import { useState } from "react";
import { copyText, isNew, isUpcoming, relText, weekOf } from "@/lib/releases";

interface Props { atlas: Atlas; id: string; winDays: number; onSelect: (id: string) => void; }

export default function DetailCard({ atlas, id, winDays, onSelect }: Props) {
  const { byId: BY_ID, products: PRODUCTS, childrenOf, pathOf } = atlas;
  const [copied, setCopied] = useState(false);
  const n = BY_ID[id];
  if (!n) return null;
  const link = `${location.origin}${location.pathname}#${id}`;
  const copyLink = async () => { if (await copyText(link)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const wk = n.rel ? weekOf(n.rel.ver) : null;
  const kids = childrenOf(id);
  const r = n.rel;
  return (
    <div className="card detail">
      <span className="eyebrow">Selected</span>
      <h3>{r ? `${PRODUCTS[n.prod].name} ${r.ver}` : n.label}{wk && <span className="wk">week {wk}</span>}</h3>
      <div className="path">{pathOf(n)}</div>
      <div className="text-[13px] text-ink-2">
        {r ? (
          <>
            <div className="flex flex-wrap gap-1.5 mb-1">
              <span className="pill">{r.chan}</span>
              {isUpcoming(r) ? <span className="pill up">Upcoming</span> : isNew(r, winDays) ? <span className="pill new">New</span> : null}
              <span className="pill">{relText(r)}</span>
            </div>
            <ul className="my-1 pl-4 list-disc">{r.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </>
        ) : n.level === 0 ? (
          atlas.id === "help" ? "Click any dot or label in the map. Release dots glow amber when they fall inside the \"new\" window." : "Click any dot or label in the map. Guide topics circle the Guides hub; pages open on developer.okta.com."
        ) : n.kind === "rnhub" || n.kind === "rnpage" ? (
          atlas.id === "help" ? "Release notes page. Its dated entries hang off it as amber or grey dots." : "Release notes page on developer.okta.com."
        ) : kids.length ? `${kids.length} sub-pages mapped below.` : "Leaf page."}
      </div>
      <div className="detail-acts">
        <a className="open" href={n.url} target="_blank" rel="noopener noreferrer">{atlas.id === "help" ? "Open in Okta docs ↗" : "Open on developer.okta.com ↗"}</a>
        {n.level !== 0 && <button className="btn" onClick={copyLink} title={link}>{copied ? "Link copied" : "Copy link"}</button>}
      </div>
      {kids.length > 0 && (
        <ul className="kids">
          {kids.map((c) => (
            <li key={c.id}>
              <button onClick={() => onSelect(c.id)}>{c.rel ? `◆ ${c.rel.ver} · ${c.rel.chan}` : `› ${c.label}`}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
