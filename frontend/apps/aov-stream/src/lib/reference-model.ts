import type { CommunityProfile, ReferenceKind, ReferenceName } from "@aov/community-contracts"
import type { EntityKind, EntityReference } from "@aov/ui/lib/entity-rich-text"
import { introductions } from "@aov/ui/lib/reference-words"

/** The community's data has one language, the one its editors write in. */
export const DATA_LOCALE = "vi-VN"

const KINDS: Record<ReferenceKind, EntityKind> = {
  CIRCUIT: "circuit",
  ORGANIZATION: "organization",
  COMPETITION: "competition",
  TEAM: "team",
  PLAYER: "player",
  PERSON: "person",
}
const PREVIEWED = new Map(Object.entries(KINDS).map(([kind, entity]) => [entity, kind as ReferenceKind]))

/** The kind community-service knows a reference by; game entries have none there. */
export const previewKind = (kind: EntityKind): ReferenceKind | undefined => PREVIEWED.get(kind)

/** What a text names, as the recognizer keys it. */
export const referenceKey = (kind: EntityKind, id: string) => `${kind}:${id}`

/** The record a page shows: the page itself, or the team or player it stands for. */
export function pageReferenceKey({ kind, id, entityId }: Pick<CommunityProfile, "kind" | "id" | "entityId">) {
  return referenceKey(KINDS[kind], (kind === "TEAM" || kind === "PLAYER") && entityId ? entityId : id)
}

/**
 * A season also goes by its circuit's short name: "AIC 2026" is the season of 2026, where "AIC" alone is the circuit.
 */
function seasonAlias(name: ReferenceName, circuit: ReferenceName | undefined) {
  if (!circuit?.shortName || !name.name.startsWith(`${circuit.name} `)) return []
  return [circuit.shortName + name.name.slice(circuit.name.length)]
}

/** The records of community-service as the recognizer reads them. */
export function communityReferences(names: ReferenceName[]): EntityReference[] {
  const circuits = new Map(names.filter((name) => name.kind === "CIRCUIT").map((name) => [name.id, name]))
  return names.map((name) => ({
    id: name.id,
    kind: KINDS[name.kind],
    autoMatch: true,
    teamIds: name.teamIds,
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

/** One line about a game entry: the start of its description, without markup. */
export function firstLine(description: string) {
  return description
    .replace(/<[^<>]*>/g, "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "")
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

const PERSON_WORDS = new RegExp(`<ref=(?:player|person):|(?:${introductions.player})\\s`, "iu")

/**
 * Whether a text may name a person, so the long list of players is read only for it: it calls someone one, it links
 * one, or it speaks of a team and says something more that could be a name. `rest` are its words outside the names
 * found so far.
 */
export function mayNamePeople(text: string, rest: string, namesTeam: boolean, about: Iterable<string> = []) {
  if (PERSON_WORDS.test(text.normalize("NFC"))) return true
  const team = namesTeam || [...about].some((key) => key.startsWith("team:"))
  return team && /[\p{Lu}\p{Lo}\p{N}]/u.test(rest)
}

/** The words of a text while its references are not known yet. */
export const plainReferences = (text: string) => text.replace(/<ref=[a-z]+:[\w.-]+>([^<>]*)<\/ref>/gi, "$1")
