import { NODES, PRODUCTS, childrenOf } from "@/data/docsTree";
import type { AtlasNode, ProductKey } from "@/data/types";
import { isHot, isUpcoming, relText } from "@/lib/releases";

interface Props {
  hidden: Set<ProductKey>;
  query: string;
  winDays: number;
  read: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  note?: string;
}

/**
 * Keyboard and screen-reader friendly view of the same tree the 3D map shows.
 * Also the fallback when the browser has no WebGL.
 */
export default function ListView({ hidden, query, winDays, read, selectedId, onSelect, note }: Props) {
  const hubs = NODES.filter((n) => n.level === 1 && !hidden.has(n.prod));
  const q = query.trim().toLowerCase();
  const matchesDeep = (n: AtlasNode): boolean =>
    !q || n.label.toLowerCase().includes(q) || childrenOf(n.id).some(matchesDeep);

  return (
    <section className="listview" aria-label="Documentation tree">
      {note && <p className="lv-note">{note}</p>}
      <ul className="lv-root">
        {hubs.filter(matchesDeep).map((hub) => (
          <li key={hub.id}>
            <details open={!!q || hub.id === "rn"}>
              <summary>
                <i className="dot" style={{ background: PRODUCTS[hub.prod].color }} aria-hidden="true" />
                <span className="lv-hub">{hub.label}</span>
                <span className="lv-count">{countDeep(hub)}</span>
              </summary>
              <Branch parent={hub} q={q} matchesDeep={matchesDeep} winDays={winDays} read={read} selectedId={selectedId} onSelect={onSelect} />
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function countDeep(n: AtlasNode): number {
  return childrenOf(n.id).reduce((a, c) => a + 1 + countDeep(c), 0);
}

function Branch({ parent, q, matchesDeep, winDays, read, selectedId, onSelect }: {
  parent: AtlasNode; q: string; matchesDeep: (n: AtlasNode) => boolean; winDays: number; read: Set<string>;
  selectedId: string; onSelect: (id: string) => void;
}) {
  const kids = childrenOf(parent.id).filter(matchesDeep);
  if (!kids.length) return null;
  return (
    <ul>
      {kids.map((c) => {
        const r = c.rel;
        const hot = r ? isHot(r, winDays, read) : false;
        const up = r ? isUpcoming(r) : false;
        return (
          <li key={c.id} className={c.id === selectedId ? "sel" : undefined}>
            <a href={c.url} target="_blank" rel="noopener noreferrer" onFocus={() => onSelect(c.id)}>
              {r ? `${r.ver} · ${r.chan}` : c.label}
            </a>
            {r && <span className="lv-meta">{relText(r)}</span>}
            {hot && <span className="pill new">New</span>}
            {up && <span className="pill up">Upcoming</span>}
            <Branch parent={c} q={q} matchesDeep={matchesDeep} winDays={winDays} read={read} selectedId={selectedId} onSelect={onSelect} />
          </li>
        );
      })}
    </ul>
  );
}
