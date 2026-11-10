import { useMemo } from "react"
import { PencilLine } from "lucide-react"
import { EntityRichText, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import { EntityRichTextEditor } from "@aov/ui/components/entity-rich-text-editor"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityReferenceSearch } from "@aov/ui/lib/entity-rich-text-editor"
import { useReferenceCatalog } from "./catalog"
import { useSkillReferences } from "./use-skill-references"
import { useCommunityReferences, useReferenceSearch } from "./use-community-references"

/** What a description is recognised against, and where typing @ searches. */
export interface AdminReferenceContext {
  entities: EntityReference[]
  fallbackLocale: string
  autoRecognize: boolean
  resolveIcon?: EntityIconResolver
  searchReferences?: EntityReferenceSearch
}

/** The saved reference catalog plus the skills and community entries the text names. */
function useAdminReferenceEntities(text: string, locale: string) {
  const catalog = useReferenceCatalog()
  const skills = useSkillReferences(text, locale, catalog.rulesetId)
  const community = useCommunityReferences(text, locale)
  const entities = useMemo(() => [...skills, ...community, ...catalog.entities], [catalog.entities, skills, community])
  return { catalog, entities }
}

export interface AdminDescriptionFieldProps {
  label: string
  locale: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  maxLength?: number
  /** `short` keeps the box one line high, for a tag or a row in a list. */
  size?: "regular" | "short"
  /** The toolbar above the box. Without it, the bar over a selection still formats and @ still inserts references. */
  toolbar?: boolean
  /** Paragraph types: normal, note, info and example. */
  paragraphStyles?: boolean
  /** The button that inserts an example table, and editing a table in place. */
  exampleTables?: boolean
  /** Hides the heading where the block around the field already names it. */
  hideLabel?: boolean
  /** Recognises against another catalog, such as the terminology draft that is still being edited. */
  references?: AdminReferenceContext
}

/**
 * The one description input of the Admin. It reads like the published text and is typed into directly: colours, bold,
 * paragraph types, tables, @ references and the icons of recognised names show while writing, so there is no separate
 * preview and no mode to switch. The tools stay quiet until the box is in use. Pages that need fewer tools turn them off
 * with props instead of using another editor; the stored text is the same rich text everywhere.
 */
export function AdminDescriptionField({ references, ...props }: AdminDescriptionFieldProps) {
  if (references) return <DescriptionBox {...props} references={references} />
  return <CatalogDescriptionBox {...props} />
}

function CatalogDescriptionBox(props: Omit<AdminDescriptionFieldProps, "references">) {
  const { catalog, entities } = useAdminReferenceEntities(props.value, props.locale)
  const searchReferences = useReferenceSearch(catalog.rulesetId)
  const references = useMemo(
    () => ({
      entities,
      fallbackLocale: catalog.config.fallbackLocale,
      autoRecognize: catalog.config.autoRecognize,
      resolveIcon: catalog.resolveIcon,
      searchReferences,
    }),
    [entities, catalog.config.fallbackLocale, catalog.config.autoRecognize, catalog.resolveIcon, searchReferences],
  )
  return <DescriptionBox {...props} references={references} />
}

const inputSizes = {
  regular: "min-h-32 max-h-[50dvh] resize-y overflow-y-auto leading-7",
  short: "min-h-9! h-auto! py-1.5 leading-6",
}

function DescriptionBox({
  label,
  size = "regular",
  toolbar = true,
  paragraphStyles = true,
  exampleTables = true,
  hideLabel = false,
  references,
  ...props
}: Omit<AdminDescriptionFieldProps, "references"> & { references: AdminReferenceContext }) {
  const box = (
    <div className="group/box min-w-0 space-y-2">
      {!hideLabel && (
        <h4 className="type-label flex min-h-8 items-center gap-2">
          <PencilLine aria-hidden className="size-4 text-muted-foreground" />
          {label}
        </h4>
      )}
      <div className="[&_[role=toolbar]]:opacity-60 [&_[role=toolbar]]:transition-opacity group-focus-within/box:[&_[role=toolbar]]:opacity-100 group-hover/box:[&_[role=toolbar]]:opacity-100">
        <EntityRichTextEditor
          {...props}
          {...references}
          label={label}
          compact
          hideLabel
          renderPreview={false}
          allowBlocks={paragraphStyles}
          allowTables={exampleTables}
          className={toolbar ? undefined : "space-y-1 [&>p[id$='-help']]:sr-only [&>[role=toolbar]]:hidden"}
          inputClassName={inputSizes[size]}
        />
      </div>
    </div>
  )
  return box
}

export function AdminRichTextPreview({ text, locale }: { text: string; locale: string }) {
  const { catalog, entities } = useAdminReferenceEntities(text, locale)
  return (
    <EntityRichText
      text={text}
      entities={entities}
      locale={locale}
      fallbackLocale={catalog.config.fallbackLocale}
      autoRecognize={catalog.config.autoRecognize}
      context="admin"
      resolveIcon={catalog.resolveIcon}
      firstOccurrenceOnly
    />
  )
}
