import type { CommunityProfile } from "@aov/community-contracts"
import { PageReferencePicker } from "@/features/community/page-reference-picker"

export function OrganizationPicker(props: {
  value?: string | null
  actorKey: string
  canWrite: boolean
  onSelect: (profile: CommunityProfile | null) => void
}) {
  return <PageReferencePicker {...props} kind="ORGANIZATION" label="Đơn vị tổ chức" />
}
