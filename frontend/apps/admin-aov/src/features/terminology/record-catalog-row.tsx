import { Link } from "react-router"
import { ArrowUpRight } from "lucide-react"
import { EntityReferenceArtwork } from "@aov/ui/components/entity-rich-text"
import { entityKindLabels } from "@aov/ui/lib/entity-rich-text"
import { ThemedLogoImg } from "@/components/themed-logo-img"
import { AliasChips } from "./alias-chips"
import type { CatalogRecord } from "./record-catalog-api"

/** A record another screen keeps: its name opens that screen, since nothing of it is edited here. */
export function RecordCatalogRow({ record: { entity, path, logoUrl, logoDarkUrl } }: { record: CatalogRecord }) {
  const [text] = entity.translations
  const name = text?.name ?? entity.id
  return (
    <tr className="group/entry relative block border-b border-border/60 p-3 transition-colors last:border-b-0 hover:bg-muted/35 focus-within:bg-muted/35 @xl/catalog:table-row @xl/catalog:align-middle @xl/catalog:p-0">
      <td className="block @xl/catalog:table-cell @xl/catalog:px-3 @xl/catalog:py-3">
        <Link
          to={path}
          className="flex min-h-8 items-center gap-2.5 rounded-lg after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <ThemedLogoImg
            url={logoUrl}
            darkUrl={logoDarkUrl}
            className="size-9 shrink-0 rounded-lg object-contain ring-1 ring-foreground/10"
            fallback={
              <EntityReferenceArtwork
                entity={entity}
                className="size-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10"
              />
            }
          />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block leading-5 font-semibold break-words group-hover/entry:underline group-hover/entry:underline-offset-4">
              {name}
            </span>
            <span className="block text-xs text-muted-foreground">{entityKindLabels[entity.kind]}</span>
          </span>
        </Link>
      </td>
      <td className="mt-2 block @xl/catalog:mt-0 @xl/catalog:table-cell @xl/catalog:px-3 @xl/catalog:py-3">
        {text?.aliases.length ? (
          <AliasChips aliases={text.aliases} />
        ) : (
          <span className="hidden text-xs text-muted-foreground @xl/catalog:inline">—</span>
        )}
      </td>
      <td className="hidden @xl/catalog:table-cell @xl/catalog:px-3 @xl/catalog:py-3">
        <span className="text-xs text-muted-foreground">—</span>
      </td>
      <td className="hidden text-muted-foreground @xl/catalog:table-cell @xl/catalog:px-2 @xl/catalog:py-3">
        <span className="inline-flex size-8 items-center justify-center">
          <ArrowUpRight aria-hidden className="size-4" />
        </span>
      </td>
    </tr>
  )
}
