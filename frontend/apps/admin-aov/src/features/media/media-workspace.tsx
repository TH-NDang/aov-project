import { Activity, lazy, Suspense, useEffect, useState } from "react"
import { Navigate, useLocation, useSearchParams } from "react-router"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { MEDIA_NAV } from "@/app/nav"
import { NavIcon } from "@/app/nav-icon"
import { MEDIA_TABS, mediaTabLocation, readMediaTab, type MediaTab } from "./media-location"
import type { Request } from "../publishing/publishing-api"

const CharacterImagesPage = lazy(() =>
  import("./character-images-page").then((module) => ({ default: module.CharacterImagesPage })),
)
const BadgesPage = lazy(() => import("./badges-page").then((module) => ({ default: module.BadgesPage })))

export function MediaWorkspace({ request }: { request?: Request }) {
  const [params, setParams] = useSearchParams()
  const selected = readMediaTab(params)
  const [visited, setVisited] = useState<Set<MediaTab>>(() => new Set([selected]))
  useEffect(
    () => setVisited((current) => (current.has(selected) ? current : new Set([...current, selected]))),
    [selected],
  )
  return (
    <Tabs
      value={selected}
      activationMode="manual"
      onValueChange={(value) => {
        if (value === selected) return
        const next = new URL(mediaTabLocation(params, value as MediaTab), "http://local")
        setParams(next.searchParams, { preventScrollReset: true })
      }}
      className="min-h-0 min-w-0 flex-1 gap-0"
    >
      <div className="shrink-0 scrollbar-none overflow-x-auto overflow-y-hidden border-b px-4 pt-2 md:px-6">
        <TabsList variant="line" aria-label="Loại ảnh" className="h-11 min-w-max justify-start">
          {MEDIA_NAV.map((item, index) => (
            <TabsTrigger key={MEDIA_TABS[index]} value={MEDIA_TABS[index]} className="px-3">
              <NavIcon item={item} />
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {MEDIA_TABS.filter((tab) => visited.has(tab) || tab === selected).map((tab) => (
        <TabsContent
          key={tab}
          value={tab}
          forceMount
          hidden={tab !== selected}
          className={tab === selected ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        >
          <Activity mode={tab === selected ? "visible" : "hidden"}>
            <Suspense
              fallback={
                <p role="status" className="p-6 text-sm text-muted-foreground">
                  Đang tải nội dung…
                </p>
              }
            >
              {tab === "badges" ? (
                <BadgesPage request={request} />
              ) : (
                <CharacterImagesPage
                  role={tab === "head" ? "HEAD" : tab === "cover" ? "SPLASH" : "PORTRAIT"}
                  request={request}
                />
              )}
            </Suspense>
          </Activity>
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function LegacyMediaRedirect({ tab }: { tab?: MediaTab }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  return <Navigate to={`${mediaTabLocation(params, tab ?? readMediaTab(params))}${location.hash}`} replace />
}
