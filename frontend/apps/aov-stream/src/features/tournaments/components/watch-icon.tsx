import type { ComponentProps, CSSProperties, ReactNode } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon, type StreamIconName } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import "./watch-icon.css"

type Press = Omit<ComponentProps<"button">, "children" | "type" | "title" | "aria-label">

/**
 * A round button of the room, which says its name when pointed at; with `words` the name stands in it. `shortcut` is
 * the key that does the same.
 */
export function RoomIcon({
  icon,
  label,
  size = 18,
  shortcut,
  words = false,
  className,
  ...button
}: Press & { icon: StreamIconName; label: string; size?: number; shortcut?: string; words?: boolean }) {
  const keys = useWatch((view) => view.keys)
  const title = shortcut && keys ? `${label} (${shortcut})` : label
  return (
    <button
      type="button"
      {...button}
      className={["tn-room-icon", className].filter(Boolean).join(" ")}
      title={words ? undefined : title}
      aria-label={words ? undefined : label}
      data-words={words || undefined}
    >
      <StreamIcon name={icon} size={size} />
      {words && <span>{label}</span>}
    </button>
  )
}

/** The video into the corner of the window, where there is room for it beside a page. */
export function RoomShrink() {
  const { text } = useStreamLocale()
  if (usePageLayout() !== "wide") return null
  return (
    <RoomIcon
      icon="shrink"
      label={text("Thu nhỏ video", "Shrink the video")}
      shortcut="T"
      onClick={() => watch.shrink()}
    />
  )
}

export function RoomClose() {
  const { text } = useStreamLocale()
  return <RoomIcon icon="close" size={20} label={text("Đóng video", "Close the video")} onClick={() => watch.close()} />
}

/** The round buttons at the end of a line, whose signs keep to the margin. */
export function RoomEnds({ children }: { children: ReactNode }) {
  return <span className="tn-room-ends">{children}</span>
}

/** What can be done now, in words: going on past what is on (`skip`), staying with it (`stay`), or another thing. */
export function RoomPress({
  kind,
  children,
  ...button
}: Omit<ComponentProps<"button">, "type" | "className"> & { kind?: "skip" | "stay" }) {
  return (
    <button type="button" {...button} className={kind ? `tn-room-press tn-room-${kind}` : "tn-room-press"}>
      {children}
      {kind === "skip" && <StreamIcon name="skip" size={15} />}
    </button>
  )
}

type Way = { onClick: () => void } | { to: string; state?: unknown } | { href: string }

/**
 * The one thing to do next. `note` says when or how long, and `done` how much of a count has passed, which fills a line
 * along its foot.
 */
export function RoomGo({
  icon,
  note,
  done,
  children,
  ...way
}: Way & { icon: StreamIconName; note?: string | null; done?: number; children: ReactNode }) {
  const inside = (
    <>
      <StreamIcon name={icon} size={16} />
      <span>{children}</span>
      {note && <small>{note}</small>}
      {"href" in way && <StreamIcon name="external" size={14} />}
    </>
  )
  if ("to" in way)
    return (
      <Link className="tn-room-go" to={way.to} state={way.state}>
        {inside}
      </Link>
    )
  if ("href" in way)
    return (
      <a className="tn-room-go" href={way.href} target="_blank" rel="noreferrer noopener">
        {inside}
      </a>
    )
  return (
    <button
      type="button"
      className="tn-room-go"
      data-counting={done != null || undefined}
      style={done != null ? ({ "--done": done } as CSSProperties) : undefined}
      onClick={way.onClick}
    >
      {inside}
    </button>
  )
}
