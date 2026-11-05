import { Plus } from "lucide-react"
import type { ProfileContent } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { PageReferencePicker } from "./page-reference-picker"
import { PlatformIcon } from "./platform-icon"

export function CircuitChannelsField({
  content,
  actorKey,
  canWrite,
  busy,
  onOrganizationChange,
  onEditLink,
}: {
  content: ProfileContent
  actorKey: string
  canWrite: boolean
  busy: boolean
  onOrganizationChange: (id: string | null) => void
  onEditLink: (index: number | null) => void
}) {
  return (
    <section className="space-y-3 admin-section py-4 @xl/profile-editor:py-5">
      <div className="flex items-center gap-3">
        <h2 className="type-section-title flex-1">Kênh thông tin chính thức</h2>
        {canWrite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Thêm kênh thông tin"
                disabled={busy}
                onClick={() => onEditLink(null)}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Thêm website, kênh phát sóng hoặc mạng xã hội</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="type-meta">
        Không bắt buộc. Thêm kênh riêng hoặc tham chiếu tới tổ chức để xem các kênh dùng chung.
      </p>
      {content.links.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kênh của hệ thống giải">
          {content.links.map((link, index) => (
            <Button
              key={index}
              type="button"
              variant="outline"
              className="h-auto max-w-full py-2"
              disabled={busy}
              aria-label={`${canWrite ? "Chỉnh sửa" : "Xem"} kênh ${link.label}`}
              onClick={() => onEditLink(index)}
            >
              <PlatformIcon url={link.url} className="size-6 shrink-0" />
              <span className="truncate">{link.label}</span>
              {link.official && <OfficialBadge label="Kênh chính thức" />}
            </Button>
          ))}
        </div>
      )}
      <PageReferencePicker
        kind="ORGANIZATION"
        label="Tổ chức cung cấp kênh chung"
        value={content.channelOrganizationId}
        actorKey={actorKey}
        canWrite={canWrite && !busy}
        canCreate={false}
        onSelect={(organization) => onOrganizationChange(organization?.id || null)}
      />
    </section>
  )
}
