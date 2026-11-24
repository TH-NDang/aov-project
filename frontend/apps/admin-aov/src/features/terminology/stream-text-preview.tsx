import { useDeferredValue, useMemo } from "react"
import { ExternalLink, PencilLine } from "lucide-react"
import { EntityReferenceArtwork, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import { MentionInput } from "@aov/ui/components/mention-input"
import { entityKindLabels, referenceTranslation, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { DATA_LOCALE } from "@aov/ui/lib/running-text-names"
import { EmptyState, ErrorState, LoadingState } from "@/components/query-state"
import { publicSite } from "@/features/community/api/page-api"
import { readStreamText, type LinkedName, type StreamReading } from "./stream-text-model"
import { useStreamReferences } from "./use-stream-references"

/** Tries a text as Stream reads it: the box marks the names that become links, and the list says where each one opens. */
export function StreamTextPreview({
  value,
  onChange,
  locale,
  disabled,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  locale: string
  disabled?: boolean
  maxLength?: number
}) {
  const { references, resolveIcon, loading, failed, retry } = useStreamReferences(locale)
  const text = useDeferredValue(value)
  const reading = useMemo(
    () => (references && text.trim() ? readStreamText(text, references) : undefined),
    [text, references],
  )
  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 space-y-2">
        <h4 className="flex min-h-8 items-center gap-2 type-label">
          <PencilLine aria-hidden className="size-4 text-muted-foreground" />
          Nội dung thử
        </h4>
        <MentionInput
          label="Nội dung thử"
          value={value}
          onChange={onChange}
          locale={locale}
          fallbackLocale={DATA_LOCALE}
          entities={references?.entities}
          index={references?.index}
          resolveIcon={resolveIcon}
          disabled={disabled}
          maxLength={maxLength}
          inputClassName="min-h-32 max-h-[50dvh] resize-y overflow-y-auto leading-7"
        />
      </div>
      {loading && <LoadingState>Đang tải danh sách tên…</LoadingState>}
      {failed && <ErrorState message="Chưa tải đủ danh sách tên. Tên chưa tải không được nhận." onRetry={retry} />}
      {reading && <Reading reading={reading} resolveIcon={resolveIcon} />}
    </div>
  )
}

const nameOf = (entity: EntityReference) => referenceTranslation(entity, DATA_LOCALE)?.name ?? entity.id

function Reading({
  reading: { linked, misspelled },
  resolveIcon,
}: {
  reading: StreamReading
  resolveIcon: EntityIconResolver
}) {
  return (
    <section aria-label="Stream sẽ liên kết" className="min-w-0 space-y-2">
      <h4 className="type-label">Stream sẽ liên kết</h4>
      {linked.length > 0 ? (
        <ul className="divide-y overflow-hidden admin-panel">
          {linked.map((name) => (
            <LinkedRow key={name.key} name={name} resolveIcon={resolveIcon} />
          ))}
        </ul>
      ) : (
        <EmptyState>Chưa có tên nào.</EmptyState>
      )}
      {misspelled.length > 0 && (
        <ul className="space-y-1">
          {misspelled.map(({ key, entity, label, expected }) => (
            <li key={key} className="type-body text-muted-foreground">
              Chưa nhận “{label}”. Viết “{expected}” để liên kết tới {nameOf(entity)}.
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LinkedRow({
  name: { entity, route, label },
  resolveIcon,
}: {
  name: LinkedName
  resolveIcon: EntityIconResolver
}) {
  const name = nameOf(entity)
  const kind = entityKindLabels[entity.kind]
  return (
    <li>
      <a
        href={route.startsWith("/") ? publicSite + route : route}
        target="_blank"
        rel="noreferrer"
        title="Mở trang trong thẻ mới"
        className="flex items-center gap-3 px-3 py-2.5 outline-none hover:bg-muted/35 focus-visible:bg-muted/35"
      >
        <EntityReferenceArtwork entity={entity} resolveIcon={resolveIcon} className="size-9 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate type-body">{name}</span>
          <span className="block truncate type-meta">{label === name ? kind : `${kind}, viết là “${label}”`}</span>
        </span>
        <ExternalLink aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </a>
    </li>
  )
}
