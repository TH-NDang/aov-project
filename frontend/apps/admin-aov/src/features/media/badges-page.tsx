import { useMemo } from "react"
import { Link } from "react-router"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { badgeLabel } from "@/components/badge-picker"
import { useBadges } from "@/lib/queries"
import { useHeroIndex } from "@/lib/use-wiki-index"
import { Gallery, type GalleryRow } from "./gallery"

const GROUPS = [
  { value: "used", label: "Đang dùng" },
  { value: "unused", label: "Chưa dùng" },
]

export function BadgesPage() {
  const badges = useBadges()
  const { index } = useHeroIndex()

  const rows = useMemo<GalleryRow[] | undefined>(() => {
    if (!badges.data || !index) return undefined
    return badges.data.map((badge) => {
      const usage = index.badgeUsage.get(badge.id) ?? 0
      return {
        key: badge.id,
        path: badge.icon,
        title: badgeLabel(badge.id),
        note: usage ? `${usage} trang phục` : "Chưa gắn cho trang phục nào",
        group: usage ? "used" : "unused",
        tag: usage ? <Badge variant="secondary">{usage}</Badge> : undefined,
        meta: (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{badge.id}</span>
            {usage > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/skins?q=${encodeURIComponent(badge.id)}`}>Xem {usage} trang phục</Link>
              </Button>
            )}
          </div>
        ),
      }
    })
  }, [badges.data, index])

  return (
    <Gallery
      title="Bậc trang phục"
      description="Nhãn bậc (A, S, SS, SSS…) và nhãn sự kiện gắn trên portrait trang phục."
      rows={rows}
      groups={GROUPS}
      searchPlaceholder="Tìm bậc: huu han, ss, christmas…"
    />
  )
}
