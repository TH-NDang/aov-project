import { useEffect, useRef } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import type { WatchMatch } from "../../../lib/watch-types"
import "./watch-shortcuts.css"

type Shortcut = { keys: readonly [string, string?]; what: readonly [string, string]; timed?: boolean }

/** `timed` keys need a video whose games are known. */
const SHORTCUTS: Shortcut[] = [
  { keys: ["SPACE", "K"], what: ["Phát, tạm dừng", "Play, pause"] },
  { keys: ["J", "L"], what: ["Lùi, tới 10 giây", "Back, forward 10 s"] },
  { keys: ["←", "→"], what: ["Lùi, tới 5 giây", "Back, forward 5 s"] },
  { keys: ["[", "]"], what: ["Mốc trước, mốc sau", "Previous, next mark"], timed: true },
  { keys: ["P", "N"], what: ["Ván trước, ván sau", "Previous, next game"] },
  { keys: ["S"], what: ["Bỏ qua phần nghỉ, phần cấm chọn", "Skip the break or the draft"], timed: true },
  { keys: ["M"], what: ["Tắt, bật tiếng", "Mute"] },
  { keys: ["T"], what: ["Thu nhỏ, phóng to", "Shrink, back"] },
  { keys: ["?"], what: ["Phím tắt", "Shortcuts"] },
]

/** The keys of the room. It takes the focus, so it is read out, and leaves the keys working while it is open. */
export function WatchShortcuts({ match }: { match: WatchMatch }) {
  const { text } = useStreamLocale()
  const on = useWatch((view) => view.keys)
  const panel = useRef<HTMLElement>(null)
  useEffect(() => panel.current?.focus({ preventScroll: true }), [])
  const timed = match.story.level === "TIMED" || match.story.level === "LINKED"
  return (
    <section ref={panel} className="tn-room-shortcuts" aria-labelledby="room-shortcuts" tabIndex={-1}>
      <h3 id="room-shortcuts">{text("Phím tắt", "Shortcuts")}</h3>
      <dl>
        {SHORTCUTS.filter((shortcut) => timed || !shortcut.timed).map(({ keys, what }) => (
          <div key={what[1]}>
            <dt>{keys.map((key) => key && <kbd key={key}>{key === "SPACE" ? text("Cách", "Space") : key}</kbd>)}</dt>
            <dd>{text(...what)}</dd>
          </div>
        ))}
      </dl>
      <label>
        <input type="checkbox" checked={on} onChange={(event) => watch.setKeys(event.target.checked)} />
        {text("Dùng phím tắt", "Use shortcuts")}
      </label>
    </section>
  )
}
