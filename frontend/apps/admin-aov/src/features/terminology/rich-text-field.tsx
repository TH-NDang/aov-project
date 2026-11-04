import { EntityRichTextEditor, type EntityRichTextEditorProps } from "@aov/ui/components/entity-rich-text-editor"
import { AdminEntityText, useReferenceCatalog } from "./catalog"
import { Eye, PencilLine } from "lucide-react"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { useSkillReferences } from "./use-skill-references"
import { useCommunityReferences, useReferenceSearch } from "./use-community-references"
import { memo, useDeferredValue, useMemo } from "react"

export function AdminRichTextField(
  props: Omit<EntityRichTextEditorProps, "entities" | "fallbackLocale" | "autoRecognize" | "searchReferences">,
) {
  const catalog = useReferenceCatalog()
  const skills = useSkillReferences(props.value, props.locale, catalog.rulesetId)
  const community = useCommunityReferences(props.value, props.locale)
  const searchReferences = useReferenceSearch(catalog.rulesetId)
  const entities = useMemo(() => [...skills, ...community, ...catalog.entities], [catalog.entities, skills, community])
  return (
    <EntityRichTextEditor
      {...props}
      entities={entities}
      fallbackLocale={catalog.config.fallbackLocale}
      autoRecognize={catalog.config.autoRecognize}
      resolveIcon={catalog.resolveIcon}
      searchReferences={searchReferences}
    />
  )
}
const LiveContent = memo(AdminEntityText)

/** Uses the same reference context as the skill detail displayed outside the editor. */
export function AdminLiveRichTextField({
  short = false,
  ...props
}: Pick<EntityRichTextEditorProps, "label" | "locale" | "value" | "onChange" | "required"> & { short?: boolean }) {
  const text = useDeferredValue(props.value)
  const updating = text !== props.value
  return (
    <div className="@container/live min-w-0">
      <div className="grid min-w-0 gap-4 @min-[580px]/live:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h4 className="type-label flex items-center gap-2">
            <PencilLine aria-hidden className="size-4 text-muted-foreground" />
            {props.label}
          </h4>
          <AdminRichTextField
            {...props}
            compact
            hideLabel
            renderPreview={false}
            inputClassName={short ? "min-h-12" : "min-h-32 max-h-[42dvh] resize-y overflow-y-auto leading-7"}
          />
        </div>
        <section aria-label={`Kết quả hiển thị · ${props.label}`} className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="type-label flex items-center gap-2">
              <Eye aria-hidden className="size-4 text-muted-foreground" />
              Kết quả hiển thị
            </h4>
            <span className="type-meta inline-flex items-center gap-1.5">
              <span aria-hidden className={`size-1.5 rounded-full ${updating ? "bg-amber-500" : "bg-emerald-500"}`} />
              {updating ? "Đang cập nhật…" : "Trực tiếp"}
            </span>
          </div>
          <div
            aria-busy={updating}
            tabIndex={0}
            className="max-h-[45dvh] min-w-0 flex-1 overflow-y-auto rounded-lg bg-muted/30 px-3 py-2 text-sm leading-7 whitespace-pre-wrap break-words outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {text ? (
              <LiveContent text={text} />
            ) : (
              <span className="text-muted-foreground">Nội dung sẽ hiển thị khi bạn nhập.</span>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export function AdminRichTextPreview({ text, locale }: { text: string; locale: string }) {
  const catalog = useReferenceCatalog()
  const skills = useSkillReferences(text, locale, catalog.rulesetId)
  const community = useCommunityReferences(text, locale)
  const entities = useMemo(() => [...skills, ...community, ...catalog.entities], [catalog.entities, skills, community])
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
