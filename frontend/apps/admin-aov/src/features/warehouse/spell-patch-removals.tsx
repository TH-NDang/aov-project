import { useQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { HeroAsset } from "../publishing/hero-content"

interface RemovalChange {
  id: string
  spellId: string
  code: string
  name: string
  iconAssetId: string | null
  sourceUrl: string
}

export function SpellPatchRemovals({ variantId, locale }: { variantId: string; locale: string }) {
  const query = useQuery({
    queryKey: ["patch-spell-removals", variantId, locale],
    queryFn: () =>
      backendRequest<RemovalChange[]>(
        `/admin/spell-removals?${new URLSearchParams({ patchVariantId: variantId, locale })}`,
      ),
  })
  if (query.isError)
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {errorMessage(query.error)}{" "}
        <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
          Tải lại lịch sử phụ trợ
        </Button>
      </p>
    )
  if (!query.data?.length) return null
  return (
    <section className="space-y-2 border-t pt-4">
      <h3 className="px-4 text-sm font-medium">Phụ trợ đã loại bỏ</h3>
      {query.data.map((event) => (
        <div key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <HeroAsset id={event.iconAssetId} alt="" frameAspectRatio={1} className="size-10 shrink-0 rounded-full" />
          <Link
            to={`/spells?item=${event.spellId}`}
            className="min-w-0 flex-1 text-sm font-medium hover:text-primary hover:underline"
          >
            {event.name}
            <span className="block font-mono text-xs text-muted-foreground">{event.code}</span>
          </Link>
          <span className="text-xs text-muted-foreground">Đã loại bỏ</span>
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Nguồn xác nhận
          </a>
        </div>
      ))}
    </section>
  )
}
