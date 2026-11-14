/** legend group key; each system (help.okta.com, developer.okta.com) has its own set */
export type ProductKey = string;

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
  /** always labelled and drawn larger, like a hub (developer guide topics) */
  pin?: boolean;
  /* runtime fields written by the force layout / label layer */
  x?: number; y?: number; z?: number;
  _near?: boolean;
}

export interface AtlasLink {
  source: string | AtlasNode;
  target: string | AtlasNode;
  kind: NodeKind;
}

export type SystemId = "help" | "dev";

/** One documentation site drawn as its own "solar system". */
export interface Atlas {
  id: SystemId;
  /** menu label */
  name: string;
  host: string;
  /** id of the centre node */
  root: string;
  snapshot: string;
  searchHint: string;
  nodes: AtlasNode[];
  links: AtlasLink[];
  byId: Record<string, AtlasNode>;
  products: Record<string, Product>;
  /** product keys shown as legend chips, in order */
  legend: string[];
  childrenOf: (id: string) => AtlasNode[];
  pathOf: (n: AtlasNode) => string;
}
