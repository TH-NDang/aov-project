import { lazy, Suspense, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { usePageCloseGuard } from "@/app/layout/page-tabs"
import { useSearchParams } from "react-router"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { publishingKeys } from "../../api/publishing-api"
import { type HeroRow } from "../../api/types"
import { heroLocationId, patchHeroLocation } from "../../model/hero-location"
import { HeroNavigationGuard } from "../workspace/hero-navigation-guard"
import { HeroQuickViewBody } from "./hero-quick-view-body"
import { confirmDiscard } from "@/components/confirm-dialog"
import { api } from "./hero-catalog-cells"

const HeroWorkspace = lazy(() =>
  import("../../pages/publishing-page").then((module) => ({ default: module.PublishingWorkspace })),
)

export function HeroQuickView({
  heroId,
  hero,
  ruleset,
  onClose,
}: {
  heroId: string
  hero: HeroRow | null
  ruleset: string
  onClose: () => void
}) {
  const [params, setParams] = useSearchParams()
  const restored = useQuery({
    queryKey: publishingKeys.revisions(heroId),
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
  })
  const revisions = (restored.data ?? hero?.revisions ?? []).filter((r) => !ruleset || r.rulesetId === ruleset)
  const requestedRevision = heroLocationId(params.get("revision"))
  const revision = requestedRevision
    ? revisions.find((r) => r.id === requestedRevision)
    : (revisions.find((r) => r.state === "DRAFT") ?? revisions.find((r) => r.state === "PUBLISHED"))
  const revisionId = requestedRevision || revision?.id || ""
  useEffect(() => {
    if (heroId && !requestedRevision && revision?.id) {
      setParams((current) => patchHeroLocation(current, { revision: revision.id }), {
        replace: true,
        preventScrollReset: true,
      })
    }
  }, [heroId, requestedRevision, revision?.id, setParams])
  const [unsafe, setUnsafe] = useState(false)
  const [saving, setSaving] = useState(false)
  const canLeave = async () =>
    !saving &&
    (!unsafe || (await confirmDiscard({ title: "Đóng trang tướng này?", description: "Bạn có thay đổi chưa lưu." })))
  usePageCloseGuard(() => !heroId || canLeave())
  return (
    <>
      <HeroNavigationGuard unsafe={!!heroId && (unsafe || saving)} busy={saving} />
      <Sheet
        open={!!heroId}
        onOpenChange={async (open) => {
          if (!open && (await canLeave())) {
            setUnsafe(false)
            onClose()
          }
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="h-dvh w-[min(960px,calc(100vw-44px))] gap-0 overflow-visible ease-out data-[state=open]:duration-200 data-[state=closed]:duration-150 motion-reduce:animate-none sm:max-w-[min(960px,calc(100vw-44px))]"
        >
          {/* The hero's own header leads the drawer and holds its close button. */}
          <SheetHeader className="sr-only">
            <SheetTitle>{hero?.code ? `Tướng / ${hero.code}` : "Chi tiết tướng"}</SheetTitle>
            <SheetDescription>{revision ? `Phiên bản #${revision.revisionNo}` : "Chi tiết tướng"}</SheetDescription>
          </SheetHeader>
          <HeroQuickViewBody>
            {heroId && (
              <Suspense
                fallback={
                  <p role="status" className="p-6">
                    Đang tải trang tướng…
                  </p>
                }
              >
                <HeroWorkspace
                  key={heroId}
                  heroId={heroId}
                  revisionId={revisionId}
                  onClose={async () => {
                    if (await canLeave()) {
                      setUnsafe(false)
                      onClose()
                    }
                  }}
                  onUnsavedChange={(unsafe, busy) => {
                    setUnsafe(unsafe)
                    setSaving(!!busy)
                  }}
                />
              </Suspense>
            )}
          </HeroQuickViewBody>
        </SheetContent>
      </Sheet>
    </>
  )
}
