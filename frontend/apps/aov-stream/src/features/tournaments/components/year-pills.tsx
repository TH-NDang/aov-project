import { useStreamLocale } from "../../../components/stream-locale"

/** The years of a list as chips, newest first; `all` adds one for every year. */
export function YearPills({
  years,
  value,
  all,
  onChange,
}: {
  years: string[]
  value: string
  all: boolean
  onChange: (year: string) => void
}) {
  const { text } = useStreamLocale()
  if (years.length < 2) return null
  return (
    <div className="hub-pills" role="group" aria-label={text("Năm", "Year")}>
      {all && (
        <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")}>
          {text("Mọi năm", "All years")}
        </button>
      )}
      {years.map((year) => (
        <button key={year} type="button" aria-pressed={value === year} onClick={() => onChange(year)}>
          {year}
        </button>
      ))}
    </div>
  )
}
