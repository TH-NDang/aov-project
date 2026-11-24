import { useStreamLocale } from "../../../components/stream-locale"
import { clock } from "../../../lib/tournament-model"
import "./game-clock.css"

/** The moment of a game whose equipment is shown: anywhere on the slider, or one of the moments recorded. */
export function GameClock({
  times,
  value,
  onChange,
}: {
  times: number[]
  value: number
  onChange: (time: number) => void
}) {
  const { text } = useStreamLocale()
  return (
    <div className="tn-clock">
      <label htmlFor="game-time">
        {text("Mốc đang xem", "Time shown")} <strong>{clock(value)}</strong>
        <span>
          {text(`${times.length} mốc ghi nhận`, `${times.length} recorded ${times.length === 1 ? "time" : "times"}`)}
        </span>
      </label>
      <input
        id="game-time"
        type="range"
        min="0"
        max={Math.max(times.at(-1) ?? 0, 1)}
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="tn-clock-ticks">
        {times.map((time) => (
          <button type="button" key={time} aria-pressed={value === time} onClick={() => onChange(time)}>
            {clock(time)}
          </button>
        ))}
      </div>
    </div>
  )
}
