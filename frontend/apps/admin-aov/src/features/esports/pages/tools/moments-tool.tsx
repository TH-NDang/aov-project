import { useMemo } from "react"
import { EventComposer } from "../../components/game/event-composer"
import { MomentList } from "../../components/game/moment-list"
import { ObjectivePad } from "../../components/game/objective-pad"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { placeAt } from "../../model/playback-place"
import { chapterClock, chapterVideo } from "../../model/series-vod"
import { objectivesAt } from "../../model/timeline"
import { readTimeline } from "../../model/timeline-io"
import { videoToGame, youtubeWatchUrl } from "../../model/vod"
import type { GameDesk } from "../game-desk"
import { deleteMoment, momentRefusal, moveMoment, recordObjective, saveMoment } from "./moment-actions"
import { newMomentRefusal } from "./new-moment"

/** The moments of a game: the pad, or the form of one moment in its place, over the list of what is recorded. */
export function MomentsTool({ desk }: { desk: GameDesk }) {
  const { entry, view, chapter, lookups, playhead, editable, videoId } = desk
  const events = useMemo(() => readTimeline(entry.content), [entry.content])
  const placed = videoId !== null && chapter.live
  const videoAt = (second: number) => chapterVideo(chapter, second)

  return (
    <div className="esp-two">
      {editable && desk.form ? <MomentForm key={formKey(desk)} desk={desk} /> : <Pad desk={desk} events={events} />}
      <MomentList
        game={view}
        events={events}
        lookups={lookups}
        now={usePlayheadValue(playhead, (second) => {
          const place = placeAt([chapter], second)
          return place.kind === "play" || place.kind === "pause" ? Math.floor(place.clock) : null
        })}
        activeId={desk.activeId}
        videoAt={placed ? (event) => videoAt(event.at) : undefined}
        onSelect={(event) => {
          desk.onActive(event.id)
          if (placed) desk.seekGame(event.at)
        }}
        onMove={editable ? (event, seconds) => moveMoment(desk, event, event.at + seconds) : undefined}
        onEdit={editable ? (event) => desk.onForm({ editing: event }) : undefined}
        onDelete={editable ? (event) => deleteMoment(desk, event) : undefined}
        shareLink={placed ? (event) => desk.shareLink(videoAt(event.at)) : undefined}
        youtubeLink={placed ? (event) => youtubeWatchUrl(videoId, videoAt(event.at)) : undefined}
      />
    </div>
  )
}

/** A form asked for anew, or for another moment, starts empty. */
const formKey = ({ form }: GameDesk) =>
  form?.editing?.id ?? form?.refused?.id ?? `new-${form?.kind ?? ""}-${form?.at ?? ""}-${form?.side ?? ""}`

function Pad({ desk, events }: { desk: GameDesk; events: ReturnType<typeof readTimeline> }) {
  const { view, chapter, playhead, editable } = desk
  // Outside its place in a video a game shows everything it has.
  const at = usePlayheadValue(playhead, (second) =>
    chapter.live ? Math.floor(chapterClock(chapter, second)) : Number.MAX_SAFE_INTEGER,
  )
  const refusal = usePlayheadValue(playhead, () => (editable ? momentRefusal(desk) : null))
  const counts = useMemo(() => objectivesAt(events, at), [events, at])
  return (
    <ObjectivePad
      game={view}
      counts={counts}
      refusal={refusal}
      keycaps={!desk.compact}
      onRecord={editable ? (side, objective) => recordObjective(desk, side, objective) : undefined}
      onOther={
        editable
          ? () => {
              const refusal = newMomentRefusal(desk)
              if (refusal) desk.say(refusal)
              else desk.onForm({})
            }
          : undefined
      }
    />
  )
}

function MomentForm({ desk }: { desk: GameDesk }) {
  const { view, chapter, playhead, entry } = desk
  const form = desk.form!
  const events = useMemo(() => readTimeline(entry.content), [entry.content])
  const now = usePlayheadValue(playhead, (second) => Math.floor(second))
  const placed = desk.videoId !== null && chapter.live
  return (
    <EventComposer
      game={view}
      at={placed ? chapterClock(chapter, now) : 0}
      video={
        placed
          ? {
              now,
              toVideo: (second) => chapterVideo(chapter, second),
              toGame: (second) => (second < chapter.start ? null : videoToGame(chapter.sync, second)),
            }
          : undefined
      }
      knownDuration={view.durationSeconds}
      items={desk.items}
      itemIcon={desk.lookups.itemIcon}
      editing={form.editing}
      refused={form.refused}
      initialKind={form.kind}
      start={{ videoSecond: form.at, side: form.side }}
      snapshotsFor={(seat) => view.snapshots[seat]}
      events={events}
      onSave={(event) => saveMoment(desk, event, form.editing ?? null)}
      onCancel={() => desk.onForm(null)}
    />
  )
}
