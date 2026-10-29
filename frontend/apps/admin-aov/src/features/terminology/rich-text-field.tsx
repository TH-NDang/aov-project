import { EntityRichTextEditor, type EntityRichTextEditorProps } from "@aov/ui/components/entity-rich-text-editor"
import { useReferenceCatalog } from "./catalog"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { useSkillReferences } from "./use-skill-references"
import { useCommunityReferences, useReferenceSearch } from "./use-community-references"
import { useMemo } from "react"

export function AdminRichTextField(
  props: Omit<EntityRichTextEditorProps, "entities" | "fallbackLocale" | "autoRecognize" | "searchReferences">,
) {
  const catalog = useReferenceCatalog()
  const skills = useSkillReferences(props.value, props.locale, catalog.rulesetId)
  const community = useCommunityReferences(props.value, props.locale)
  const searchReferences = useReferenceSearch(catalog.rulesetId)
  const entities = useMemo(() => [...catalog.entities, ...skills, ...community], [catalog.entities, skills, community])
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
export function AdminRichTextPreview({ text, locale }: { text: string; locale: string }) {
  const catalog = useReferenceCatalog()
  const skills = useSkillReferences(text, locale, catalog.rulesetId)
  const community = useCommunityReferences(text, locale)
  const entities = useMemo(() => [...catalog.entities, ...skills, ...community], [catalog.entities, skills, community])
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
