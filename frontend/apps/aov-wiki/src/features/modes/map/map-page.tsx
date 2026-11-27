import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PublicDrawer, PublicDrawerContent } from "@aov/ui/components/public-overlay"
import { GameFrame } from "../../../components/game-frame"
import { WikiBreadcrumb } from "../../../components/wiki-breadcrumb"
import { useWikiContext, useWikiText } from "../../../context/wiki-context"
import { WikiApiError } from "../../../lib/wiki-api"
import { mapMeta, notFoundMeta } from "../../../lib/seo/page-meta"
import { usePageHead } from "../../../lib/seo/use-page-head"
import { mapQuery, modeCardsQuery, type PublicMap } from "../mode-api"
import { MapBoard } from "./map-board"
import { MapDetails } from "./map-details"
import { MapIndex, MapLayers, LaneChooser, MapReminder, MapTabs } from "./map-parts"
import {
  CATEGORIES,
  clock,
  markers,
  objectsIn,
  readMapTab,
  refOf,
  resolveRef,
  timelineEnd,
  type Category,
  type MapTab,
  type TempoMoment,
} from "./map-model"
import { TempoMomentCard, TempoRail } from "./map-tempo"
import { readAutoShow, useMatchClock, writeAutoShow } from "./use-match-clock"
import "./map-page.css"

/** `/map` opens the first mode that has a published map; `/map/:code` opens that mode's map. */
export function MapPage() {
  const { code } = useParams()
  const { search } = useLocation()
  const { href } = useWikiContext()
  const text = useWikiText()
  const cards = useQuery({ ...modeCardsQuery(), enabled: !code })
  if (code) return <MapView key={code} code={code} />
  if (cards.isPending) return <MapSkeleton />
  const first = cards.data?.items.find((card) => card.hasMap)
  if (first) return <Navigate to={`${href(`/map/${encodeURIComponent(first.code)}`)}${search}`} replace />
  return (
    <div className="wiki-map-page">
      <div className="wiki-map-notice wiki-mascot-state" role="status">
        <h1>{text("Chưa có bản đồ nào", "No map yet")}</h1>
        <Link to={href("/modes")}>{text("Xem các chế độ chơi", "See the game modes")}</Link>
      </div>
    </div>
  )
}

function MapView({ code }: { code: string }) {
  const { href, locale } = useWikiContext()
  const text = useWikiText()
  const map = useQuery(mapQuery(code))
  const missing = map.error instanceof WikiApiError && map.error.status === 404
  usePageHead(
    map.data
      ? mapMeta({ code, modeName: map.data.modeName, name: map.data.content.name }, locale)
      : missing
        ? notFoundMeta(locale, `/map/${encodeURIComponent(code)}`, "map")
        : null,
  )

  if (map.isPending) return <MapSkeleton />
  if (map.isError)
    return (
      <div className="wiki-map-page">
        <div className="wiki-map-notice wiki-mascot-state" role={missing ? "status" : "alert"}>
          <h1>
            {missing
              ? text("Chế độ này chưa có bản đồ", "This mode has no map yet")
              : text("Chưa tải được bản đồ", "The map could not be loaded")}
          </h1>
          {!missing && (
            <button type="button" className="wiki-map-retry" onClick={() => map.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          )}
          <Link to={href("/modes")}>{text("Xem các chế độ chơi", "See the game modes")}</Link>
        </div>
      </div>
    )
  return <MapScreen code={code} map={map.data} />
}

const ALL = new Set<Category>(CATEGORIES)
const STRUCTURES = new Set<Category>(["STRUCTURE"])

function MapScreen({ code, map }: { code: string; map: PublicMap }) {
  const { href } = useWikiContext()
  const text = useWikiText()
  const wide = usePageLayout() === "wide"
  const [params, setParams] = useSearchParams()
  const { content, images } = map
  const tab = readMapTab(params.get("tab"))
  const at = params.get("at")
  const [shown, setShown] = useState<ReadonlySet<Category>>(ALL)
  const [showAreas, setShowAreas] = useState(false)
  const [autoShow, setAutoShow] = useState(readAutoShow)
  const [reminder, setReminder] = useState<TempoMoment | null>(null)
  const end = timelineEnd(content.tempo)

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value == null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )

  const matchClock = useMatchClock(content.tempo, end, (moment) => {
    if (!autoShow) return
    setReminder(moment)
    update({ t: String(moment.seconds) })
  })
  useEffect(() => {
    if (!reminder) return
    const timer = window.setTimeout(() => setReminder(null), 7000)
    return () => window.clearTimeout(timer)
  }, [reminder])

  const chosen = resolveRef(content, at)
  const pick = (ref: string) => update({ at: ref === at ? null : ref })
  const chosenMoment =
    content.tempo.find((moment) => String(moment.seconds) === params.get("t")) ?? content.tempo[0] ?? null

  const lanesTab = tab === "lanes"
  const tempoTab = tab === "tempo"
  const chosenLane = chosen?.kind === "lane" ? chosen.lane : lanesTab ? (content.lanes[0] ?? null) : null
  const drawn = markers(content, tab === "map" ? shown : lanesTab ? STRUCTURES : ALL)
  const calloutRefs = new Set(
    (chosenMoment?.callouts ?? []).flatMap((callout) =>
      callout.objectCode ? [callout.objectCode, refOf(callout.objectCode, callout.spotKey)] : [],
    ),
  )
  const inArea = chosen?.kind === "area" ? new Set(objectsIn(content, chosen.area).map((found) => found.code)) : null
  const dimmed = new Set(
    drawn
      .filter((marker) =>
        lanesTab
          ? true
          : tempoTab
            ? !calloutRefs.has(marker.ref) && !calloutRefs.has(marker.object.code)
            : inArea
              ? !inArea.has(marker.object.code)
              : false,
      )
      .map((marker) => marker.ref),
  )

  const board = (
    <MapBoard
      content={content}
      images={images}
      markers={drawn}
      selected={tempoTab ? null : lanesTab ? (chosenLane?.code ?? null) : at}
      onPick={(ref) => {
        if (tempoTab) update({ tab: null, at: ref })
        else pick(ref)
      }}
      showAreas={tab === "map" && showAreas}
      highlightArea={tab === "map" && chosen?.kind === "area" ? chosen.area : null}
      highlightLane={lanesTab ? chosenLane : null}
      laneMarks={lanesTab}
      callouts={tempoTab ? (chosenMoment?.callouts ?? []) : []}
      dimmed={dimmed}
    >
      {reminder && (
        <MapReminder
          moment={reminder}
          onOpen={() => {
            update({ tab: "tempo", t: String(reminder.seconds) })
            setReminder(null)
          }}
          onClose={() => setReminder(null)}
        />
      )}
    </MapBoard>
  )

  const tempoPanel = (
    <>
      <TempoRail
        tempo={content.tempo}
        end={end}
        chosen={chosenMoment}
        onChoose={(moment) => update({ t: String(moment.seconds) })}
        matchClock={matchClock}
        autoShow={autoShow}
        onAutoShow={(on) => {
          setAutoShow(on)
          writeAutoShow(on)
        }}
      />
      {chosenMoment && <TempoMomentCard moment={chosenMoment} />}
    </>
  )

  const lanePanel = (
    <>
      <LaneChooser
        lanes={content.lanes}
        chosen={chosenLane?.code ?? null}
        onPick={(laneCode) => update({ at: laneCode })}
      />
      {chosenLane && (
        <MapDetails content={content} images={images} chosen={{ kind: "lane", lane: chosenLane }} onPick={pick} />
      )}
    </>
  )

  const details =
    chosen && chosen.kind !== "lane" ? (
      <MapDetails content={content} images={images} chosen={chosen} onPick={pick} named={wide} />
    ) : null

  const layers = (
    <MapLayers content={content} shown={shown} onShown={setShown} showAreas={showAreas} onShowAreas={setShowAreas} />
  )

  const heading = (
    <header className="wiki-map-heading">
      <h1>{content.name || text("Bản đồ", "Map")}</h1>
      <p>
        <Link to={href(`/modes/${encodeURIComponent(code)}`)}>{map.modeName}</Link>
        {matchClock.running && !tempoTab && (
          <button type="button" className="wiki-map-heading-clock" onClick={() => update({ tab: "tempo" })}>
            {clock(matchClock.seconds)}
          </button>
        )}
      </p>
    </header>
  )
  const tabs = (
    <MapTabs active={tab} onChoose={(next: MapTab) => update({ tab: next === "map" ? null : next, at: null })} />
  )

  if (wide)
    return (
      <div className="wiki-map-page" data-layout="wide">
        <WikiBreadcrumb
          className="wiki-map-breadcrumb"
          steps={[
            { label: text("Trang chủ", "Home"), to: href("/") },
            { label: text("Chế độ chơi", "Game modes"), to: href("/modes") },
            { label: map.modeName, to: href(`/modes/${encodeURIComponent(code)}`) },
            { label: text("Bản đồ", "Map") },
          ]}
        />
        {heading}
        {tabs}
        <div className="wiki-map-stage">
          <div className="wiki-map-stage-board">
            {tab === "map" && layers}
            {board}
          </div>
          <GameFrame as="section" className="wiki-map-panel" aria-label={text("Chi tiết", "Details")}>
            {tempoTab ? (
              tempoPanel
            ) : lanesTab ? (
              lanePanel
            ) : details ? (
              <>
                <button type="button" className="wiki-map-back" onClick={() => update({ at: null })}>
                  ‹ {text("Danh sách", "All places")}
                </button>
                {details}
              </>
            ) : (
              <MapIndex content={content} images={images} shown={shown} onPick={pick} />
            )}
          </GameFrame>
        </div>
      </div>
    )

  return (
    <div className="wiki-map-page" data-layout="compact">
      {heading}
      {tabs}
      {tab === "map" && layers}
      <div className="wiki-map-compact-board">{board}</div>
      {tempoTab ? (
        <div className="wiki-map-compact-panel">{tempoPanel}</div>
      ) : lanesTab ? (
        <div className="wiki-map-compact-panel">{lanePanel}</div>
      ) : (
        <MapIndex content={content} images={images} shown={shown} onPick={pick} />
      )}
      <PublicDrawer open={!!details} onOpenChange={(open) => !open && update({ at: null })}>
        <PublicDrawerContent aria-describedby={undefined} title={chosenTitle(chosen)}>
          {details}
        </PublicDrawerContent>
      </PublicDrawer>
    </div>
  )
}

function chosenTitle(chosen: ReturnType<typeof resolveRef>) {
  if (!chosen) return undefined
  return chosen.kind === "object" ? chosen.object.name : chosen.kind === "area" ? chosen.area.name : chosen.lane.name
}

function MapSkeleton() {
  return (
    <div className="wiki-map-page" aria-busy="true">
      <div className="wiki-map-skeleton-title" />
      <div className="wiki-map-skeleton-board" />
    </div>
  )
}
