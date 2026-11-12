import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { EntityReferenceIcon, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { foldEntitySearch, referenceTranslation, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { cn } from "@aov/ui/lib/utils"
import { useReferenceCatalog } from "@/features/terminology/catalog"

export type BuildKind = "item" | "enchantment" | "arcana" | "spell"

const KINDS: BuildKind[] = ["item", "enchantment", "arcana", "spell"]

export interface BuildReferences {
  lookup: (kind: BuildKind, id: string | null | undefined) => EntityReference | undefined
  options: Record<BuildKind, EntityReference[]>
  resolveIcon?: EntityIconResolver
}

export const referenceName = (entity: EntityReference | undefined, fallback = "Chưa xác định") =>
  (entity && referenceTranslation(entity, "vi-VN")?.name) || fallback

/** Items, enchantments, arcana and spells of the Wiki, from the shared reference catalog, by kind and identifier. */
export function useBuildReferences(): BuildReferences {
  const { entities, resolveIcon } = useReferenceCatalog()
  return useMemo(() => {
    const byKey = new Map<string, EntityReference>()
    const options = Object.fromEntries(KINDS.map((kind) => [kind, [] as EntityReference[]])) as Record<
      BuildKind,
      EntityReference[]
    >
    for (const entity of entities)
      if ((KINDS as string[]).includes(entity.kind)) {
        byKey.set(`${entity.kind}:${entity.id}`, entity)
        options[entity.kind as BuildKind].push(entity)
      }
    for (const kind of KINDS) options[kind].sort((a, b) => referenceName(a).localeCompare(referenceName(b), "vi"))
    return { lookup: (kind, id) => (id ? byKey.get(`${kind}:${id}`) : undefined), options, resolveIcon }
  }, [entities, resolveIcon])
}

/** One reference icon with its name as the tooltip; an empty slot shows a dashed box. */
export function ReferenceIcon({
  kind,
  id,
  references,
  className = "size-10",
  round = false,
}: {
  kind: BuildKind
  id: string | null | undefined
  references: BuildReferences
  className?: string
  round?: boolean
}) {
  const entity = references.lookup(kind, id)
  if (!entity)
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center border border-dashed border-muted-foreground/40 text-muted-foreground type-meta",
          round ? "rounded-full" : "rounded-md",
          className,
        )}
        title={id ? "Không còn trong danh mục" : "Chưa xác định"}
        aria-label={id ? "Không còn trong danh mục" : "Chưa xác định"}
      >
        ?
      </span>
    )
  return (
    <span title={referenceName(entity)} className="inline-flex shrink-0">
      <EntityReferenceIcon
        entity={entity}
        resolveIcon={references.resolveIcon}
        className={cn(className, round ? "rounded-full" : "rounded-md")}
      />
      <span className="sr-only">{referenceName(entity)}</span>
    </span>
  )
}

/** A searchable list of one kind of reference; picking one closes the list. */
export function ReferencePicker({
  kind,
  value,
  references,
  label,
  onChange,
  filter,
  round = false,
}: {
  kind: BuildKind
  value: string | null
  references: BuildReferences
  label: string
  onChange: (id: string | null) => void
  filter?: (entity: EntityReference) => boolean
  round?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const query = foldEntitySearch(search.trim())
  const shown = references.options[kind].filter(
    (entity) =>
      (!filter || filter(entity) || entity.id === value) &&
      (!query || foldEntitySearch(`${referenceName(entity)} ${entity.id}`).includes(query)),
  )
  const selected = references.lookup(kind, value)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            // No padding: the hover and focus rings draw outside the icon, so a picker takes the same room as the icon
            // it replaces and a row of six still fits on one line while editing.
            "inline-flex outline-none ring-offset-1 ring-offset-background hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring",
            round ? "rounded-full" : "rounded-md",
          )}
          aria-label={`${label}: ${referenceName(selected)}`}
          title={`${label}: ${referenceName(selected)}`}
        >
          <ReferenceIcon kind={kind} id={value} references={references} round={round} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm ${label.toLocaleLowerCase("vi")}…`}
            aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
            className="pl-8"
          />
        </label>
        <ul className="mt-2 max-h-72 overflow-y-auto" role="listbox" aria-label={label}>
          {value && (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left type-body text-muted-foreground hover:bg-muted"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                Bỏ trống ô này
              </button>
            </li>
          )}
          {shown.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                role="option"
                aria-selected={entity.id === value}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left type-body hover:bg-muted"
                onClick={() => {
                  onChange(entity.id)
                  setOpen(false)
                  setSearch("")
                }}
              >
                <EntityReferenceIcon
                  entity={entity}
                  resolveIcon={references.resolveIcon}
                  defer
                  className={cn("size-7", round ? "rounded-full" : "rounded-md")}
                />
                <span className="min-w-0 flex-1 truncate">{referenceName(entity)}</span>
                {entity.id === value && <Check className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {!shown.length && <li className="px-2 py-1.5 type-body text-muted-foreground">Không có kết quả.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
