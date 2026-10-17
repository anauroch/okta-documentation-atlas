import { BY_ID, PRODUCTS, childrenOf, pathOf } from "@/data/docsTree";
import { isNew, isUpcoming, relText } from "@/lib/releases";

interface Props { id: string; winDays: number; onSelect: (id: string) => void; }

export default function DetailCard({ id, winDays, onSelect }: Props) {
  const n = BY_ID[id];
  if (!n) return null;
  const kids = childrenOf(id);
  const r = n.rel;
  return (
    <div className="card detail">
      <span className="eyebrow">Selected</span>
      <h3>{r ? `${PRODUCTS[n.prod].name} ${r.ver}` : n.label}</h3>
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
        ) : n.id === "root" ? (
          "Click any dot or label in the map. Release dots glow amber when they fall inside the \"new\" window."
        ) : n.kind === "rnhub" || n.kind === "rnpage" ? (
          "Release notes page. Its dated entries hang off it as amber or grey dots."
        ) : kids.length ? `${kids.length} sub-pages mapped below.` : "Leaf page."}
      </div>
      <a className="open" href={n.url} target="_blank" rel="noopener noreferrer">Open in Okta docs ↗</a>
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
