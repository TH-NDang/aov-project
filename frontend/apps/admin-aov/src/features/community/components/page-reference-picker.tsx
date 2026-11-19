import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link2, Pencil, Plus } from "lucide-react"
import type { CommunityProfile, ProfileKind } from "@aov/community-contracts"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { pageApi, pageKeys } from "../api/page-api"
import { PageReference } from "./page-reference"
import { PageSearchDialog } from "./page-search-dialog"
import { ProfileTypeIcon } from "./profile-icons"

export function PageReferencePicker({
  value,
  kind,
  label,
  actorKey,
  canWrite,
  canCreate = canWrite,
  fallbackName = "",
  onSelect,
}: {
  value?: string | null
  kind?: ProfileKind
  label: string
  actorKey: string
  canWrite: boolean
  canCreate?: boolean
  fallbackName?: string
  onSelect: (profile: CommunityProfile | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = useQuery({
    queryKey: pageKeys.page(actorKey, value),
    queryFn: () => pageApi.read(value!),
    enabled: !!value,
  })
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Avatar className="size-10 shrink-0 rounded-lg border bg-background">
          <AvatarImage src={selected.data?.content?.avatarUrl || undefined} alt="" className="object-contain" />
          <AvatarFallback className="rounded-lg">
            {kind ? <ProfileTypeIcon kind={kind} className="size-5" /> : <Link2 className="size-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="type-meta mb-1">{label}</p>
          {value ? (
            <PageReference id={value} label={selected.data?.content?.name || fallbackName || label} />
          ) : (
            <p className="type-body">{fallbackName || "Chưa liên kết hồ sơ"}</p>
          )}
          {!value && fallbackName && <p className="type-meta mt-1">Chưa liên kết hồ sơ</p>}
        </div>
        {canWrite && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Chọn tham chiếu: ${label}`}
            title={`Chọn ${label.toLowerCase()}`}
            onClick={() => setOpen(true)}
          >
            {value ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          </Button>
        )}
      </div>
      {selected.isError && value && (
        <p role="alert" className="type-meta text-destructive">
          Chưa tải được tham chiếu. Bạn có thể chọn lại hồ sơ.
        </p>
      )}
      {selected.data && !selected.data.published && (
        <p className="type-meta">Hồ sơ nháp · chỉ hiển thị công khai sau khi được xuất bản.</p>
      )}
      <PageSearchDialog
        open={open && canWrite}
        onOpenChange={setOpen}
        label={label}
        kinds={kind ? [kind] : undefined}
        actorKey={actorKey}
        canCreate={canCreate}
        value={value}
        initialName={fallbackName}
        onSelect={(profile) => canWrite && onSelect(profile)}
      />
    </div>
  )
}
