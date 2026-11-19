import type { CommunityProfile } from "@aov/community-contracts"
import { PageReferencePicker } from "@/features/community/components/page-reference-picker"

/** An organization page, picked or created on the spot: the organizer of a tournament or the owner of a team. */
export function OrganizationPicker({
  label = "Đơn vị tổ chức",
  ...props
}: {
  label?: string
  value?: string | null
  actorKey: string
  canWrite: boolean
  onSelect: (profile: CommunityProfile | null) => void
}) {
  return <PageReferencePicker {...props} kind="ORGANIZATION" label={label} />
}
