import { Link } from "react-router"
import type { UseQueryResult } from "@tanstack/react-query"
import { ArrowUpRight, ChevronLeft } from "lucide-react"
import type { CommunityProfile } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"

/** The way to a record's profile page; it says so while the record has none, rather than leading nowhere. */
export function ProfileButton({ page, state }: { page: UseQueryResult<CommunityProfile | null>; state: unknown }) {
  if (page.isPending)
    return (
      <Button type="button" size="sm" className="ml-auto" disabled>
        Hồ sơ
      </Button>
    )
  if (!page.data)
    return (
      <span className="type-meta ml-auto" title={page.isError ? "Chưa tải được hồ sơ" : undefined}>
        {page.isError ? "Chưa tải được hồ sơ" : "Chưa có trang hồ sơ"}
      </span>
    )
  return (
    <Button asChild size="sm" className="ml-auto">
      <Link to={`/pages/${page.data.id}`} state={state}>
        Hồ sơ <ArrowUpRight aria-hidden />
      </Link>
    </Button>
  )
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="esp-peek-back" onClick={onBack} aria-label="Quay lại thẻ trước">
      <ChevronLeft className="size-4" aria-hidden />
    </button>
  )
}
