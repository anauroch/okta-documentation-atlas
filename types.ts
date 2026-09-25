export type ProductKey =
  | "root" | "oie" | "oce" | "wf" | "oag" | "ispm" | "mcp" | "aerial" | "res" | "rn";

export type NodeKind = "doc" | "rnhub" | "rnpage" | "release";

export interface Product {
  name: string;
  color: string;
}

export interface Release {
  id: string;
  prod: ProductKey;
  /** id of the release-notes page node this entry hangs off */
  parent: string;
  ver: string;
  chan: string;
  /** ISO date (YYYY-MM-DD) or null when the source page gives none */
  date: string | null;
  /** true when only the month is known */
  approx?: boolean;
  /** true for scheduled releases that have not shipped */
  upcoming?: boolean;
  url: string;
  items: string[];
}

export interface AtlasNode {
  id: string;
  label: string;
  url: string;
  prod: ProductKey;
  kind: NodeKind;
  parent: string | null;
  level: number;
  rel?: Release;
  /* runtime fields written by the force layout / label layer */
  x?: number; y?: number; z?: number;
  _near?: boolean;
}

export interface AtlasLink {
  source: string | AtlasNode;
  target: string | AtlasNode;
  kind: NodeKind;
}
