/**
 * Query parameters of the Wiki are English. Some pages first shipped with Vietnamese names, so a parameter can name
 * the older spelling it replaces: links shared before keep working, and the address is rewritten the first time the
 * reader changes that value.
 */
export interface ParamName {
  name: string
  /** The name older links used. */
  legacy?: string
}

/** A parameter's value, read under its name or the older one. */
export const readParam = (params: URLSearchParams, { name, legacy }: ParamName) =>
  params.get(name) ?? (legacy ? params.get(legacy) : null)

/** Writes a parameter under its name and drops the older one; an empty value removes it. */
export function writeParam(params: URLSearchParams, { name, legacy }: ParamName, value: string | null | undefined) {
  if (legacy) params.delete(legacy)
  if (value) params.set(name, value)
  else params.delete(name)
}

/** Both spellings of the parameters, for removing all of them from a link. */
export const paramNames = (names: readonly ParamName[]) =>
  names.flatMap(({ name, legacy }) => (legacy ? [name, legacy] : [name]))

/** The game modes' parameters and the Vietnamese names their first links used. */
export const MODE_PARAMS = {
  search: { name: "q" },
  cost: { name: "cost", legacy: "gia" },
  traits: { name: "traits", legacy: "phe" },
  sort: { name: "sort", legacy: "xep" },
  lineupUnit: { name: "lineup-unit", legacy: "quan" },
  view: { name: "view", legacy: "xem" },
  filter: { name: "filter", legacy: "loc" },
} as const satisfies Record<string, ParamName>

/** Values that also changed language: a table view was `bang`, sorts were `dang-len` and `moi`. */
export const LEGACY_VALUES: Record<string, string> = { bang: "table", "dang-len": "trending", moi: "recent" }

/** A parameter's value with its older Vietnamese spelling read as the English one. */
export const readModeParam = (params: URLSearchParams, param: ParamName) => {
  const value = readParam(params, param)
  return value === null ? null : (LEGACY_VALUES[value] ?? value)
}
