import { useStreamLocale } from "../../../components/stream-locale"
import { clock } from "../../../lib/tournament-model"
import "./game-clock.css"

/**
 * The moment of a game whose inventories are shown: anywhere on the slider, one of the moments they were seen at, or
 * none of them (null), which shows what was built over the whole game.
 */
export function GameClock({
  times,
  value,
  onChange,
}: {
  times: number[]
  value: number | null
  onChange: (time: number | null) => void
}) {
  const { text } = useStreamLocale()
  const last = Math.max(times.at(-1) ?? 0, 1)
  return (
    <div className="tn-clock">
      <label htmlFor="game-time">
        {value == null ? text("Trang bị của", "Items of") : text("Trang bị lúc", "Items at")}{" "}
        <strong>{value == null ? text("cả ván", "the whole game") : clock(value)}</strong>
        <span>
          {text(`${times.length} mốc ghi nhận`, `${times.length} recorded ${times.length === 1 ? "time" : "times"}`)}
        </span>
      </label>
      <input
        id="game-time"
        type="range"
        min="0"
        max={last}
        step="1"
        value={value ?? last}
        aria-valuetext={value == null ? text("cả ván", "the whole game") : clock(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="tn-clock-ticks">
        <button type="button" aria-pressed={value == null} onClick={() => onChange(null)}>
          {text("Cả ván", "Whole game")}
        </button>
        {times.map((time) => (
          <button type="button" key={time} aria-pressed={value === time} onClick={() => onChange(time)}>
            {clock(time)}
          </button>
        ))}
      </div>
    </div>
  )
}
