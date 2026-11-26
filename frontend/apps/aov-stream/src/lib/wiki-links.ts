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

/**
 * What a card can say of an entry from its description on the Wiki: the lines of stats an item opens with (four at
 * most), and the first line of what it does.
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
  const [first, ...rest] = paragraphs
  const statLike = (line: string) => /^[+\-−]\s?\d/.test(line)
  if (first?.every(statLike)) return { stats: first.slice(0, 4), line: rest[0]?.[0] ?? null }
  return { stats: [] as string[], line: first?.[0] ?? null }
}
