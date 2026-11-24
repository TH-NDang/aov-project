import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityKind } from "@aov/ui/lib/reference-kinds"

/** The community's data has one language, the one its editors write in. */
export const DATA_LOCALE = "vi-VN"

/** A line of community-service's lists of names, as `ReferenceName` in @aov/community-contracts describes it. */
export type NamedRecord = {
  id: string
  kind: "CIRCUIT" | "ORGANIZATION" | "COMPETITION" | "TEAM" | "PLAYER" | "PERSON"
  name: string
  path: string
  shortName?: string
  aliases?: string[]
  circuitId?: string
  teamIds?: string[]
  /** What a screen looks its picture up by, with an `EntityIconResolver`; the lists themselves carry no picture. */
  iconAssetId?: string
}

export const namedRecordKinds: Record<NamedRecord["kind"], EntityKind> = {
  CIRCUIT: "circuit",
  ORGANIZATION: "organization",
  COMPETITION: "competition",
  TEAM: "team",
  PLAYER: "player",
  PERSON: "person",
}
const recordKinds = new Map(
  Object.entries(namedRecordKinds).map(([kind, entity]) => [entity, kind as NamedRecord["kind"]]),
)

/** The kind community-service knows a reference by; game entries have none there. */
export const previewKind = (kind: EntityKind) => recordKinds.get(kind)

/** What a text names, as the recognizer keys it. */
export const referenceKey = (kind: EntityKind, id: string) => `${kind}:${id}`

/**
 * A season also goes by its circuit's short name: "AIC 2026" is the season of 2026, where "AIC" alone is the circuit.
 */
function seasonAlias(name: NamedRecord, circuit: NamedRecord | undefined) {
  if (!circuit?.shortName || !name.name.startsWith(`${circuit.name} `)) return []
  return [circuit.shortName + name.name.slice(circuit.name.length)]
}

/** The records of community-service as the recognizer reads them. */
export function communityReferences(names: NamedRecord[]): EntityReference[] {
  const circuits = new Map(names.filter((name) => name.kind === "CIRCUIT").map((name) => [name.id, name]))
  return names.map((name) => ({
    id: name.id,
    kind: namedRecordKinds[name.kind],
    autoMatch: true,
    teamIds: name.teamIds,
    iconAssetId: name.iconAssetId,
    destinations: { stream: name.path },
    translations: [
      {
        locale: DATA_LOCALE,
        name: name.name,
        aliases: [...(name.aliases ?? []), ...seasonAlias(name, circuits.get(name.circuitId ?? ""))],
        shortNames: name.shortName ? [name.shortName] : [],
        description: "",
      },
    ],
  }))
}

export type WikiMode = { code: string; name: string; summary?: string | null }

const WIKI_PATHS: Partial<Record<EntityKind, string>> = {
  hero: "hero",
  item: "warehouse/items",
  enchantment: "warehouse/enchantments",
  arcana: "warehouse/arcana",
  spell: "warehouse/spells",
  mode: "modes",
}

/** The page of a game entry on the Wiki, which is another site. */
function wikiAddress(wikiUrl: string, kind: EntityKind, id: string, locale: string) {
  const address = new URL(`${WIKI_PATHS[kind]}/${encodeURIComponent(id)}`, wikiUrl.replace(/\/*$/, "/"))
  if (locale !== DATA_LOCALE) address.searchParams.set("locale", locale)
  return address.href
}

/**
 * Game entries of the Wiki's own catalog. Terms stay out: "armor" or "stun" in a post is a word, not a place to go.
 */
export function wikiReferences(
  entities: EntityReference[],
  modes: WikiMode[],
  { wikiUrl, locale }: { wikiUrl: string; locale: string },
): EntityReference[] {
  const catalog = entities.filter((entity) => WIKI_PATHS[entity.kind])
  const entries: EntityReference[] = [
    ...catalog.map((entity) => ({
      ...entity,
      // The Wiki only lets heroes be recognized in game text; here the rules of running text decide for each name.
      autoMatch: entity.kind === "hero" ? entity.autoMatch : true,
    })),
    ...modes.map((mode) => ({
      id: mode.code,
      kind: "mode" as const,
      autoMatch: true,
      translations: [{ locale, name: mode.name, aliases: [], description: mode.summary ?? "" }],
    })),
  ]
  return entries.map((entity) => ({
    ...entity,
    destinations: { stream: wikiAddress(wikiUrl, entity.kind, entity.id, locale) },
  }))
}

/** Host and path of an address, whatever its protocol, query and closing slash; nothing for text that is none. */
function place(address: string) {
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(address) ? address : `https://${address}`)
    return `${url.host.replace(/^www\./, "")}${decodeURI(url.pathname).replace(/\/+$/, "")}`
  } catch {
    return undefined
  }
}

/** Finds the record an address opens, for texts that paste a link to one of our pages. */
export function addressResolver(references: EntityReference[], streamUrl: string) {
  const root = streamUrl.replace(/\/*$/, "")
  const keys = new Map<string, string>()
  const add = (address: string, key: string) => {
    const found = place(address)
    if (found && !keys.has(found)) keys.set(found, key)
  }
  for (const { kind, id, destinations } of references) {
    const target = destinations?.stream
    if (!target) continue
    const key = referenceKey(kind, id)
    add(target.startsWith("/") ? root + target : target, key)
    // A page opens by its id as well as by its code, and a team by its id once it has a page.
    const own = { team: "teams", player: "players", person: "people", circuit: "pages", organization: "pages" }
    if (kind in own) add(`${root}/${own[kind as keyof typeof own]}/${id}`, key)
  }
  return (address: string) => {
    const found = place(address)
    return found ? keys.get(found) : undefined
  }
}
