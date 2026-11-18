import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { PageReferencePicker } from "@/features/community/components/page-reference-picker"

export type UploadReferences = { ownerPageId?: string | null; relatedPageId?: string | null }

export function MediaUploadReferences({
  value,
  disabled,
  onChange,
  onOwnerName,
}: {
  value: UploadReferences
  disabled: boolean
  onChange: (value: UploadReferences) => void
  onOwnerName: (name: string) => void
}) {
  const access = useTournamentAccess()
  if (!access.canRead) return null
  return (
    <details className="rounded-lg border p-3">
      <summary className="type-label cursor-pointer">Tham chiếu hồ sơ (tùy chọn)</summary>
      <div className="mt-3 space-y-3">
        <PageReferencePicker
          label="Hồ sơ chủ sở hữu"
          value={value.ownerPageId}
          actorKey={access.actorKey}
          canWrite={!disabled}
          canCreate={false}
          onSelect={(profile) => {
            onChange({ ...value, ownerPageId: profile?.id || null })
            if (profile?.content) onOwnerName(profile.content.name)
          }}
        />
        <PageReferencePicker
          label="Nội dung liên quan"
          value={value.relatedPageId}
          actorKey={access.actorKey}
          canWrite={!disabled}
          canCreate={false}
          onSelect={(profile) => onChange({ ...value, relatedPageId: profile?.id || null })}
        />
      </div>
    </details>
  )
}
