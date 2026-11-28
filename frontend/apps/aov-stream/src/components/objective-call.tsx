import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { MapGlyph } from "@aov/ui/components/battle-map-glyph"
import { clock, epicCalls, type EpicCall } from "@aov/ui/lib/battle-map"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { battleMapQuery, TOURNAMENT_MODE } from "../lib/battle-map-api"
import { CALL_SHOWN, callAt, callSwitch, readingOf } from "../lib/objective-calls"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { useWatch } from "./use-watch"
import { watch } from "./watch-session"
import "./objective-call.css"

/** Whether big monster reminders show over the video, as the reader last chose. */
export const useCallsOn = () => useSyncExternalStore(callSwitch.subscribe, callSwitch.on, () => true)

/**
 * The reminder laid over the video when the clock of a timed game plays past a time the Wiki's battlefield map names
 * for big monsters, such as Caesar and the dragon at 2:00. It reads the map only while reminders are on and a timed
 * match is open, and calls nothing the reader jumps past.
 */
export function ObjectiveCall(): ReactNode {
  const { text } = useStreamLocale()
  const on = useCallsOn()
  const timed = useWatch((view) => view.match?.story.level === "TIMED")
  const map = useQuery({ ...battleMapQuery(TOURNAMENT_MODE), enabled: on && timed })
  const calls = useMemo(() => (map.data ? epicCalls(map.data.content) : []), [map.data])
  const [call, setCall] = useState<EpicCall | null>(null)

  useEffect(() => {
    if (!on || !calls.length) return
    let before = readingOf(watch.view().place)
    return watch.subscribe(() => {
      const after = readingOf(watch.view().place)
      const found = callAt(calls, before, after)
      before = after
      if (found) setCall(found)
    })
  }, [on, calls])

  useEffect(() => {
    if (!call) return
    const timer = setTimeout(() => setCall(null), CALL_SHOWN)
    return () => clearTimeout(timer)
  }, [call])

  if (!on || !call) return null
  const wiki = publicSiteUrl(import.meta.env.VITE_WIKI_URL, 5173, window.location.origin)
  const href = new URL(`map/${TOURNAMENT_MODE}?tab=tempo&t=${call.seconds}`, `${wiki.replace(/\/$/, "")}/`).href
  return (
    <div className="hub-call" role="status">
      <span className="hub-call-mark" aria-hidden="true">
        <MapGlyph glyph={call.glyph} size={20} />
      </span>
      <span className="hub-call-words">
        <b>{clock(call.seconds)}</b>
        <span>{call.labels.join(" · ")}</span>
      </span>
      <a className="hub-call-map" href={href} target="_blank" rel="noopener">
        {text("Bản đồ", "Map")}
      </a>
      <button
        type="button"
        className="hub-call-close"
        aria-label={text("Ẩn nhắc", "Hide reminder")}
        onClick={() => setCall(null)}
      >
        <StreamIcon name="close" size={14} />
      </button>
    </div>
  )
}
