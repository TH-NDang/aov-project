import type { Reference } from "@aov/community-contracts"
import { DATA_LOCALE } from "@aov/ui/lib/running-text-names"
import type { EntityKind } from "@aov/ui/lib/reference-kinds"
import type { CatalogKind } from "./tournament-model.ts"

/** Where each kind of the game's catalog has its pages on the Wiki, and what the Wiki's own catalog calls it. */
const WIKI_PLACES: Record<CatalogKind, { path: string; kind: EntityKind }> = {
  heroes: { path: "hero", kind: "hero" },
  items: { path: "warehouse/items", kind: "item" },
  enchantments: { path: "warehouse/enchantments", kind: "enchantment" },
  arcana: { path: "warehouse/arcana", kind: "arcana" },
  spells: { path: "warehouse/spells", kind: "spell" },
}

/** The kind of a catalogue entry as the Wiki's list of names knows it. */
export const wikiKind = (kind: CatalogKind) => WIKI_PLACES[kind].kind

/**
 * The page of a hero, an item or another entry of the game on the Wiki, which is another site. The Wiki names its pages
 * by code and finds them by id too; a form of a hero opens on the hero that holds it.
 */
export function wikiEntryUrl(
  wikiUrl: string,
  kind: CatalogKind,
  entry: Pick<Reference, "id" | "code">,
  locale: string,
) {
  const key = entry.code?.trim() || entry.id
  const address = new URL(`${WIKI_PLACES[kind].path}/${encodeURIComponent(key)}`, wikiUrl.replace(/\/*$/, "/"))
  if (locale !== DATA_LOCALE) address.searchParams.set("locale", locale)
  return address.href
}

/** A line of a description, with the heading it opens with before its colon (an active or a passive), if any. */
export type EntryLine = { label: string | null; body: string }

/**
 * What a card can say of an entry from its description on the Wiki: the lines of stats an item opens with, and the
 * whole of the rest, paragraph by paragraph, each line split from the heading it opens with.
 */
export function describeEntry(description: string | null | undefined) {
  const paragraphs = (description ?? "")
    .replace(/<[^<>]*>/g, "")
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0)
  const statLike = (line: string) => /^[+\-−]\s?\d/.test(line)
  const [first, ...rest] = paragraphs
  const opensWithStats = !!first?.every(statLike)
  const text = (opensWithStats ? rest : paragraphs).map((lines) => lines.map(splitHeading))
  return { stats: opensWithStats ? first! : [], text }
}

function splitHeading(line: string): EntryLine {
  const match = /^([^:.,;!?]{2,40}):\s+(\S.*)$/.exec(line)
  return match ? { label: match[1]!.trim(), body: match[2]! } : { label: null, body: line }
}
