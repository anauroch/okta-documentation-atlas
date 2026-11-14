import type { Atlas, AtlasNode, SystemId } from "./types";
import { HELP_ATLAS } from "./docsTree";
import { DEV_ATLAS } from "./devTree";

export const ATLASES: Record<SystemId, Atlas> = { help: HELP_ATLAS, dev: DEV_ATLAS };
export const otherSystem = (s: SystemId): SystemId => (s === "help" ? "dev" : "help");

/** Which system a node id belongs to, if any. */
export function systemOf(id: string): SystemId | null {
  return HELP_ATLAS.byId[id] ? "help" : DEV_ATLAS.byId[id] ? "dev" : null;
}
export const nodeById = (id: string): AtlasNode | undefined => HELP_ATLAS.byId[id] ?? DEV_ATLAS.byId[id];
