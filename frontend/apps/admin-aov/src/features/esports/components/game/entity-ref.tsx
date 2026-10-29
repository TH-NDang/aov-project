import { createContext, useContext, useMemo, type ReactNode } from "react"
import { EntityReferencePopover, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import { createEntityIndex, entityKindLabels, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { IconRef } from "../../model/game-view"

export type RefKind = "hero" | "item" | "spell" | "enchantment" | "arcana"

/**
 * Wiki reference data for the viewer, supplied by the page (admin catalogue now, public wiki later) so viewer
 * components stay free of app APIs.
 */
export type ReferenceSource = {
  entities: EntityReference[]
  context: "admin" | "wiki"
  locale?: string
  fallbackLocale?: string
  resolveIcon?: EntityIconResolver
}

type ResolvedSource = Required<Omit<ReferenceSource, "resolveIcon">> & {
  resolveIcon?: EntityIconResolver
  index: ReturnType<typeof createEntityIndex>
  byKey: Map<string, EntityReference>
  byName: Map<string, EntityReference>
}

const ReferenceSourceContext = createContext<ResolvedSource | null>(null)

const nameKey = (kind: string, name: string) => `${kind}:${name.trim().toLocaleLowerCase("vi")}`

export function ReferenceSourceProvider({ source, children }: { source: ReferenceSource; children: ReactNode }) {
  const { entities, context, locale = "vi-VN", fallbackLocale = "vi-VN", resolveIcon } = source
  const value = useMemo<ResolvedSource>(() => {
    const byKey = new Map<string, EntityReference>()
    const byName = new Map<string, EntityReference>()
    for (const entity of entities) {
      byKey.set(`${entity.kind}:${entity.id}`, entity)
      for (const translation of entity.translations ?? [])
        if (translation.name && !byName.has(nameKey(entity.kind, translation.name)))
          byName.set(nameKey(entity.kind, translation.name), entity)
    }
    return {
      entities,
      context,
      locale,
      fallbackLocale,
      resolveIcon,
      index: createEntityIndex(entities, locale, fallbackLocale),
      byKey,
      byName,
    }
  }, [entities, context, locale, fallbackLocale, resolveIcon])
  return <ReferenceSourceContext.Provider value={value}>{children}</ReferenceSourceContext.Provider>
}

/** The wiki entry for an observed hero/item/…, or a minimal stand-in so unlinked names still get a card. */
function referenceFor(kind: RefKind, entity: IconRef, source: ResolvedSource | null): EntityReference {
  const wiki =
    (entity.id && source?.byKey.get(`${kind}:${entity.id}`)) || source?.byName.get(nameKey(kind, entity.name))
  // The tournament catalogue already carries a ready icon URL; prefer it over resolving the wiki media asset.
  if (wiki) return entity.iconUrl ? { ...wiki, icon: entity.iconUrl } : wiki
  return {
    id: entity.id || entity.name,
    kind,
    translations: [{ locale: source?.locale ?? "vi-VN", name: entity.name, aliases: [], description: "" }],
    icon: entity.iconUrl,
    unresolved: true,
  }
}

/**
 * The wiki reference card for a hero, item, spell, enchantment or arcana used in the game: the same card as reference
 * mentions in wiki text, with the entry's description and a link to it.
 */
export function EntityRef({
  kind,
  entity,
  children,
}: {
  kind: RefKind
  entity: IconRef | null | undefined
  children: ReactNode
}) {
  const source = useContext(ReferenceSourceContext)
  const reference = useMemo(() => (entity ? referenceFor(kind, entity, source) : null), [kind, entity, source])
  if (!entity || !reference) return <>{children}</>
  return (
    <EntityReferencePopover
      entity={reference}
      locale={source?.locale ?? "vi-VN"}
      fallbackLocale={source?.fallbackLocale}
      context={source?.context ?? "admin"}
      index={source?.index}
      resolveIcon={source?.resolveIcon}
      label={entity.name}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`${entityKindLabels[kind]}: ${entity.name}`}
        className="inline-flex cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-[var(--esp-gold)]"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </span>
    </EntityReferencePopover>
  )
}
