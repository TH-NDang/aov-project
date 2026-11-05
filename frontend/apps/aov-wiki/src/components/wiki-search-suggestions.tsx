import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { EntityReferenceArtwork } from "@aov/ui/components/entity-rich-text"
import { foldEntitySearch, referenceTranslation } from "@aov/ui/lib/entity-rich-text"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { wikiReferencesQuery } from "../lib/wiki-references"

const LIMIT = 8
const KIND_LABELS: Record<string, [string, string]> = {
  hero: ["Tướng", "Hero"],
  item: ["Trang bị", "Equipment"],
  enchantment: ["Phù hiệu", "Enchantment"],
  arcana: ["Bảng ngọc", "Arcana"],
  spell: ["Phụ trợ", "Talent"],
  term: ["Thuật ngữ", "Term"],
}
const KIND_ORDER = ["hero", "item", "term", "enchantment", "spell", "arcana"]

/** Published names matching what is typed, so a reader goes straight to a page instead of a filtered list. */
export function WikiSearchSuggestions({ search, onPick }: { search: string; onPick: () => void }) {
  const scope = useWikiContext()
  const { locale } = scope
  const needle = foldEntitySearch(search.trim())
  const references = useQuery({ ...wikiReferencesQuery(scope), enabled: needle.length > 0 })
  if (!needle) return null

  const fallback = references.data?.fallbackLocale ?? "vi-VN"
  const matches = (references.data?.entities ?? [])
    .filter((entity) => entity.destinations?.wiki && KIND_LABELS[entity.kind])
    .flatMap((entity) => {
      const translation = referenceTranslation(entity, locale, fallback)
      if (!translation) return []
      const names = [translation.name, ...translation.aliases].map(foldEntitySearch)
      const rank = names.some((name) => name.startsWith(needle))
        ? 0
        : names.some((name) => name.includes(needle))
          ? 1
          : 2
      return rank < 2 ? [{ entity, name: translation.name, rank }] : []
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        KIND_ORDER.indexOf(a.entity.kind) - KIND_ORDER.indexOf(b.entity.kind) ||
        a.name.localeCompare(b.name, locale),
    )
    .slice(0, LIMIT)

  if (!matches.length) return null

  return (
    <ul className="wiki-search-suggestions" aria-label={wikiText(locale, "Gợi ý tìm kiếm", "Search suggestions")}>
      {matches.map(({ entity, name }) => (
        <li key={`${entity.kind}:${entity.id}`}>
          <Link to={entity.destinations!.wiki!} onMouseDown={(event) => event.preventDefault()} onClick={onPick}>
            <EntityReferenceArtwork entity={entity} className="size-7 rounded-md" />
            <strong>{name}</strong>
            <span>{wikiText(locale, ...KIND_LABELS[entity.kind])}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
