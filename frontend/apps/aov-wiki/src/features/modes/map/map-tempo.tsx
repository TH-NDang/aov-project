import type { CSSProperties } from "react"
import { useWikiText } from "../../../context/wiki-context"
import { clock, phases, railAt, railTime, type TempoMoment } from "./map-model"
import { CLOCK_SPEEDS, type ClockSpeed } from "./use-match-clock"
import "./map-tempo.css"

export interface ClockControls {
  seconds: number
  running: boolean
  speed: ClockSpeed
  setSpeed: (speed: ClockSpeed) => void
  seek: (seconds: number) => void
  toggle: () => void
  reset: () => void
}

/**
 * The match timeline: a clock to run, the phases as a gold rail with a gem for each mark, and the switch that lets
 * the marks show themselves when the clock reaches them.
 */
export function TempoRail({
  tempo,
  end,
  chosen,
  onChoose,
  matchClock,
  autoShow,
  onAutoShow,
}: {
  tempo: readonly TempoMoment[]
  end: number
  chosen: TempoMoment | null
  onChoose: (moment: TempoMoment) => void
  matchClock: ClockControls
  autoShow: boolean
  onAutoShow: (on: boolean) => void
}) {
  const text = useWikiText()
  const at = (seconds: number) => `${railAt(seconds, end) * 100}%`

  return (
    <section className="wiki-map-tempo" aria-label={text("Nhịp điệu trận", "Match tempo")}>
      <div className="wiki-map-clock">
        <button
          type="button"
          className="wiki-map-clock-play"
          aria-label={matchClock.running ? text("Dừng", "Pause") : text("Chạy đồng hồ", "Run the clock")}
          onClick={matchClock.toggle}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            {matchClock.running ? <path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z" /> : <path d="m8 5 11 7-11 7Z" />}
          </svg>
        </button>
        <output className="wiki-map-clock-time" aria-live="off">
          {clock(matchClock.seconds)}
        </output>
        <div className="wiki-map-clock-speeds" role="group" aria-label={text("Tốc độ", "Speed")}>
          {CLOCK_SPEEDS.map((speed) => (
            <button
              type="button"
              key={speed}
              aria-pressed={matchClock.speed === speed}
              title={speed === 1 ? text("Theo giờ thật", "Real time") : undefined}
              onClick={() => matchClock.setSpeed(speed)}
            >
              x{speed}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="wiki-map-clock-reset"
          aria-label={text("Về 0:00", "Back to 0:00")}
          onClick={matchClock.reset}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
          </svg>
        </button>
      </div>

      <div className="wiki-map-rail">
        <div className="wiki-map-rail-phases" aria-hidden="true">
          {phases(tempo, end).map((phase) => (
            <span
              key={phase.from}
              style={{ left: at(phase.from), width: `${(railAt(phase.to, end) - railAt(phase.from, end)) * 100}%` }}
              data-active={(matchClock.seconds >= phase.from && matchClock.seconds < phase.to) || undefined}
            >
              {phase.name}
            </span>
          ))}
        </div>
        <div className="wiki-map-rail-track">
          <span className="wiki-map-rail-done" style={{ width: at(matchClock.seconds) }} />
          {tempo.map((moment) => (
            <button
              type="button"
              key={moment.seconds}
              className="wiki-map-rail-mark"
              style={{ "--at": at(moment.seconds) } as CSSProperties}
              aria-pressed={chosen?.seconds === moment.seconds}
              data-passed={matchClock.seconds >= moment.seconds || undefined}
              aria-label={clock(moment.seconds)}
              onClick={() => {
                matchClock.seek(moment.seconds)
                onChoose(moment)
              }}
            >
              <span>{clock(moment.seconds)}</span>
            </button>
          ))}
          <input
            className="wiki-map-rail-scrub"
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(railAt(matchClock.seconds, end) * 1000)}
            aria-label={text("Thời điểm trận", "Match time")}
            aria-valuetext={clock(matchClock.seconds)}
            onChange={(event) => matchClock.seek(Math.round(railTime(Number(event.target.value) / 1000, end)))}
          />
        </div>
      </div>

      <label className="wiki-map-auto">
        <input type="checkbox" checked={autoShow} onChange={(event) => onAutoShow(event.target.checked)} />
        <span>{text("Tự hiện khi tới giờ", "Show each mark when its time comes")}</span>
      </label>
    </section>
  )
}

/** What the game says happens at a mark: its time, its phase and its numbered texts. */
export function TempoMomentCard({ moment }: { moment: TempoMoment }) {
  const text = useWikiText()
  return (
    <article className="wiki-map-moment" aria-label={clock(moment.seconds)}>
      <header>
        <strong>{clock(moment.seconds)}</strong>
        {moment.phase && <span>{moment.phase}</span>}
      </header>
      {moment.steps.length > 0 ? (
        <ol>
          {moment.steps.map((step, index) => (
            <li key={index}>
              {step.split("\n").map((line, lineIndex) => (
                <p key={lineIndex}>{line.replace(/^- /, "")}</p>
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <p className="wiki-map-moment-empty">{text("Không có ghi chú.", "No notes.")}</p>
      )}
    </article>
  )
}
