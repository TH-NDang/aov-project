import { EntityRichTextEditor, type EntityRichTextEditorProps } from "@aov/ui/components/entity-rich-text-editor"
import { useReferenceCatalog } from "./catalog"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"

export function AdminRichTextField(
  props: Omit<EntityRichTextEditorProps, "entities" | "fallbackLocale" | "autoRecognize">,
) {
  const catalog = useReferenceCatalog()
  return (
    <EntityRichTextEditor
      {...props}
      entities={catalog.entities}
      fallbackLocale={catalog.config.fallbackLocale}
      autoRecognize={catalog.config.autoRecognize}
      resolveIcon={catalog.resolveIcon}
    />
  )
}
export function AdminRichTextPreview({ text, locale }: { text: string; locale: string }) {
  const catalog = useReferenceCatalog()
  return (
    <EntityRichText
      text={text}
      entities={catalog.entities}
      locale={locale}
      fallbackLocale={catalog.config.fallbackLocale}
      autoRecognize={catalog.config.autoRecognize}
      context="admin"
      resolveIcon={catalog.resolveIcon}
      firstOccurrenceOnly
    />
  )
}
