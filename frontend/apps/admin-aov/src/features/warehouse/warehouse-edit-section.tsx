/**
 * A part of a warehouse entry that a request to edit can point at. Each sheet has a single pencil for the whole page;
 * the part only says where the page opens once it is editing.
 */
export type WarehouseSection =
  "details" | "stats" | "recipe" | "positions" | "mechanics" | "states" | "context" | "translations" | "images"

export type EditTarget = { revisionId: string; section: WarehouseSection }
