import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { stepDays, stepWords } from "../../../lib/standing-words"
import type { StandingStep } from "../../../lib/standings-steps"
import type { ShownStep } from "./standings-address"
import "./standings-steps-control.css"

type Control = {
  steps: StandingStep[]
  step: ShownStep
  /** Whether the stage goes on, so that its last step may be one that is being played. */
  live: boolean
}

/** What each step is called, with its days where it is not a day itself. */
function useStepNames({ steps, live }: Pick<Control, "steps" | "live">) {
  const { text, languageTag } = useStreamLocale()
  return steps.map((step, index) => ({
    words: stepWords(step, live && step.open && index === steps.length - 1, text, languageTag),
    days: stepDays(step, languageTag),
  }))
}

/** The step a table is shown at, between the ways to the one before and the one after it. */
export function StepButtons({ steps, step, live, children }: Control & { children?: ReactNode }) {
  const { text } = useStreamLocale()
  const names = useStepNames({ steps, live })
  const [said, setSaid] = useState("")
  const { words, days } = names[step.shown]!
  // Wide enough for the longest name, so the buttons stay where the pointer is.
  const longest = Math.max(...names.map((name) => `${name.words} ${name.days}`.length))
  const go = (by: -1 | 1) => {
    const name = names[step.shown + by]
    if (!name) return
    step.read(step.shown + by)
    setSaid(`${name.words} ${name.days}`)
  }
  const button = (by: -1 | 1) => {
    const name = names[step.shown + by]?.words
    const label = by < 0 ? text("Bước trước", "Previous step") : text("Bước sau", "Next step")
    return (
      <button
        type="button"
        aria-label={name ? `${label}: ${name}` : label}
        aria-disabled={!name || undefined}
        title={name}
        onClick={() => go(by)}
      >
        <StreamIcon name={by < 0 ? "chevronLeft" : "chevronRight"} size={18} />
      </button>
    )
  }
  return (
    <div className="tn-steps" role="group" aria-label={text("Thời điểm của bảng", "Moment of the table")}>
      {button(-1)}
      <div className="tn-steps-name" style={{ "--longest": longest } as CSSProperties}>
        <span>
          <b>{words}</b> {days && <small>{days}</small>}
        </span>
        {children}
      </div>
      {button(1)}
      <span className="sr-only" role="status">
        {said}
      </span>
    </div>
  )
}

/**
 * The steps of a table as a range. With `axis` it lies unseen over the race where that stands beside the table, the
 * mark on the axis being its thumb; everywhere else it is a line with a thumb.
 */
export function StepRange({
  steps,
  step,
  live,
  axis = false,
  className = "",
}: Control & { axis?: boolean; className?: string }) {
  const { text } = useStreamLocale()
  const names = useStepNames({ steps, live })
  const input = useRef<HTMLInputElement>(null)
  const read = useRef(step.read)
  // The step shown when a finger or the pointer came down. A finger that scrolls the page over the range moves its
  // thumb on the way, and the browser then cancels the press: that step was never chosen.
  const pressed = useRef<number | null>(null)
  useEffect(() => {
    read.current = step.read
  })
  // React reports every move of the thumb as a change; the change of the browser itself comes when a drag ends.
  useEffect(() => {
    const element = input.current
    if (!element) return
    const done = () => {
      const value = Number(element.value)
      if (value !== pressed.current) read.current(value)
      pressed.current = null
    }
    element.addEventListener("change", done)
    return () => element.removeEventListener("change", done)
  }, [])
  const last = steps.length - 1
  const { words, days } = names[step.shown]!
  return (
    <input
      ref={input}
      className={`tn-steps-range ${className}`}
      data-axis={axis || undefined}
      type="range"
      min={0}
      max={last}
      value={step.shown}
      aria-label={text("Thời điểm của bảng", "Moment of the table")}
      aria-valuetext={[words, days].filter(Boolean).join(", ")}
      style={{ "--share": step.shown / last } as CSSProperties}
      onPointerDown={() => {
        pressed.current = step.shown
      }}
      onPointerCancel={() => {
        if (pressed.current != null) step.move(pressed.current)
      }}
      // A key is never cancelled, so the step it chooses is read even where a cancelled press left the same one.
      onKeyDown={() => {
        pressed.current = null
      }}
      onChange={(event) => step.move(Number(event.target.value))}
    />
  )
}
