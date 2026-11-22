import { Fragment, useId, useLayoutEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { changeKindIcon, changeKindIcons } from "@aov/ui/components/change-kind-icons"
import { LocalTime } from "@aov/ui/components/local-time"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { patchDayLabel } from "../lib/patch-day-label"
import { WikiIcon } from "./wiki-icon"
import { WikiImage } from "./wiki-image"
import "./patch-changes-row.css"

export type ChangedSubject = {
  id: string
  name: string
  kind?: string
  image?: string
  href?: string
  open?: (button: HTMLButtonElement) => void
}
const labels: Record<string, [string, string]> = {
  ADDED: ["Mới", "New"],
  REMOVED: ["Đã gỡ", "Removed"],
  BUFF: ["Tăng sức mạnh", "Buff"],
  NERF: ["Giảm sức mạnh", "Nerf"],
  REWORK: ["Làm lại", "Rework"],
  FIX: ["Sửa lỗi", "Fix"],
  RELEASE: ["Ra mắt", "New hero"],
  ADJUSTMENT: ["Điều chỉnh", "Adjustment"],
  BALANCE: ["Cân bằng", "Balance"],
  UPDATED: ["Cập nhật", "Updated"],
}
/** The order readers look for: what is new, what was remade, what got stronger, what got weaker, then the rest. */
const KIND_ORDER = ["RELEASE", "ADDED", "REWORK", "BUFF", "NERF", "ADJUSTMENT", "BALANCE", "FIX", "UPDATED", "REMOVED"]
/** The colour a kind of change is read by; every other kind reads as an adjustment. */
const TONES: Record<string, string> = { RELEASE: "new", ADDED: "new", REWORK: "rework", BUFF: "up", NERF: "down" }

export function patchChangeTone(kind: string) {
  return TONES[kind] ?? "adjust"
}

/** The changed subjects grouped by kind, in the order readers look for, each group by name. */
export function groupedChanges<T extends ChangedSubject>(entries: readonly T[], locale: string) {
  const byKind = new Map<string, T[]>()
  for (const entry of entries) byKind.set(entry.kind ?? "", [...(byKind.get(entry.kind ?? "") ?? []), entry])
  return [...byKind]
    .sort(([a], [b]) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
    .map(([kind, list]) => ({ kind, list: list.sort((a, b) => a.name.localeCompare(b.name, locale)) }))
}

/**
 * The title of a list of changes and the notes it leads to: the version on screen by its day, or the whole season when
 * a season is read without a version.
 */
export function PatchChangesTitle() {
  const { locale, patchVariantId, seasonId, options, region, regions } = useWikiContext()
  const wholeSeason = !!seasonId && !patchVariantId
  const patch = options?.patches.find((item) => (patchVariantId ? item.id === patchVariantId : item.isCurrent))
  const season = options?.seasons.find((item) => item.id === seasonId)?.displayName
  const day = patch?.regionalDate
  if (wholeSeason) return wikiText(locale, `Thay đổi trong mùa ${season ?? ""}`, `Changed in ${season ?? "the season"}`)
  if (!day) return wikiText(locale, "Thay đổi ở bản này", "Changed in this version")
  return (
    <>
      {wikiText(locale, "Thay đổi ở bản ", "Changed in version ")}
      <LocalTime
        value={day}
        sourceTimeZone={regions.find((market) => market.code === region)?.timeZone}
        label={(zone) => patchDayLabel(day, zone)}
      />
    </>
  )
}

/** Where the full notes of the changes on screen are: the season's list of versions, or the version's own notes. */
export function usePatchNotesPath() {
  const { patchVariantId, seasonId, options } = useWikiContext()
  if (seasonId && !patchVariantId) return "/updates"
  const patch = options?.patches.find((item) => (patchVariantId ? item.id === patchVariantId : item.isCurrent))
  return patch ? `/updates/${patch.code}` : undefined
}

export function patchChangeLabel(kind: string, locale: string) {
  return wikiText(locale, ...(labels[kind] ?? labels.UPDATED))
}
/** A change kind as readers see it: its drawn mark and its name. */
export function ChangeKindLabel({ kind, size = 18 }: { kind: string; size?: number }) {
  const { locale } = useWikiContext()
  const Art = changeKindIcon(kind) ?? changeKindIcons.UPDATED
  return (
    <span className="inline-flex items-center gap-1">
      <Art size={size} className="shrink-0" />
      {patchChangeLabel(kind, locale)}
    </span>
  )
}

/**
 * How many chips of a row fit before its closing link, and where the last of them ends, so the link can follow it.
 * Measured again whenever the row or the link changes size. The link reads longer once it has to count the chips left
 * out, so both of its lengths are taken into account.
 */
function useFittingChips(enabled: boolean, total: number, signature: string) {
  const row = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ fit: number; edge?: number }>({ fit: total })
  useLayoutEffect(() => {
    const node = row.current
    const track = node?.firstElementChild
    if (!enabled || !node || !track) return
    const measure = () => {
      const chips = [...node.querySelectorAll<HTMLElement>("[data-chip]")]
      if (!chips.length) return
      const tail = node.querySelector<HTMLElement>("[data-tail]")
      const count = node.querySelector<HTMLElement>("[data-rest]")
      const gap = Number.parseFloat(getComputedStyle(node).columnGap) || 0
      const start = node.getBoundingClientRect().left
      const end = (chip: HTMLElement) => chip.getBoundingClientRect().right - start
      const countWidth = count?.offsetWidth ?? 0
      const linkWidth = (tail?.offsetWidth ?? 0) - (count?.dataset.rest === "shown" ? countWidth : 0)
      const everyChipFits = end(chips[chips.length - 1]) <= node.clientWidth - (linkWidth ? linkWidth + gap : 0)
      const fitting = everyChipFits
        ? chips
        : chips.filter((chip) => end(chip) <= node.clientWidth - linkWidth - countWidth - gap)
      const fit = fitting.length
      const edge = everyChipFits || !fit ? undefined : Math.ceil(end(fitting[fit - 1]))
      setState((current) => (current.fit === fit && current.edge === edge ? current : { fit, edge }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    observer.observe(track)
    // Names are measured in the page's font, which can arrive after the first layout.
    void document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [enabled, signature])
  return enabled ? { row, fit: Math.min(state.fit, total), edge: state.edge } : { row, fit: total, edge: undefined }
}

/**
 * What the version on screen changed in this list, grouped by kind of change, with the link to the notes closing the
 * row. A wide page shows the chips that fit one row and counts the rest in that link; a compact page scrolls the row
 * sideways.
 */
export function PatchChangesRow({
  entries,
  pending = false,
  failed = false,
  retry,
}: {
  entries: ChangedSubject[]
  /** Holds the row's place while the changes load, so the list below does not move when they arrive. */
  pending?: boolean
  failed?: boolean
  retry?: () => void
}) {
  const { locale, href } = useWikiContext()
  const wide = usePageLayout() === "wide"
  const titleId = useId()
  const notesPath = usePatchNotesPath()
  const groups = groupedChanges(entries, locale)
  const chips = groups.flatMap((group) => group.list)
  const place = new Map(chips.map((chip, index) => [chip.id, index]))
  const { row, fit, edge } = useFittingChips(wide, chips.length, `${locale} ${chips.map((chip) => chip.id).join()}`)
  if (!entries.length && !failed && !pending) return null

  const left = chips.length - fit
  // A season gathers the changes of several versions, so its notes are the whole list of them.
  const notes = notesPath && (
    <Link className="wiki-changes-notes" to={href(notesPath)} data-tail="">
      {/* Kept measurable while unused, so the row knows how long the link gets before it has to cut a chip. */}
      {wide && (
        <span data-rest={left ? "shown" : "spare"} aria-hidden={!left || undefined}>
          {wikiText(locale, `+${left || chips.length} khác · `, `+${left || chips.length} more · `)}
        </span>
      )}
      {wikiText(locale, "Xem ghi chú đầy đủ", "Read the full notes")}
      <WikiIcon name="arrow" size={16} />
    </Link>
  )

  return (
    <section className="wiki-changes" aria-labelledby={titleId} aria-busy={pending || undefined}>
      <header className="wiki-changes-heading">
        <h2 id={titleId}>
          <PatchChangesTitle />
        </h2>
        {chips.length > 0 && <small>{chips.length}</small>}
      </header>
      {chips.length > 0 ? (
        <div ref={row} className="wiki-changes-row">
          {/* A wide row ends where its last whole chip ends, so the link follows the chips without a gap. */}
          <div className="wiki-changes-track" style={{ maxWidth: edge }}>
            {groups.map(({ kind, list }) => {
              const Art = changeKindIcon(kind) ?? changeKindIcons.UPDATED
              const tone = kind ? patchChangeTone(kind) : undefined
              return (
                <Fragment key={kind}>
                  {kind && (
                    <span
                      className="wiki-changes-kind"
                      data-tone={tone}
                      data-cut={place.get(list[0].id)! >= fit || undefined}
                      aria-hidden="true"
                    >
                      <Art size={18} className="shrink-0" />
                      {patchChangeLabel(kind, locale)}
                    </span>
                  )}
                  {list.map((entry) => {
                    const chip = {
                      className: "wiki-changes-chip",
                      "data-chip": "",
                      "data-tone": tone,
                      "data-cut": place.get(entry.id)! >= fit || undefined,
                    }
                    const body = (
                      <>
                        {entry.image && (
                          <span className="wiki-changes-art">
                            <WikiImage src={entry.image} alt="" />
                          </span>
                        )}
                        {entry.name}
                        {kind && <span className="sr-only">, {patchChangeLabel(kind, locale)}</span>}
                      </>
                    )
                    return entry.href ? (
                      <Link key={entry.id} to={entry.href} {...chip}>
                        {body}
                      </Link>
                    ) : entry.open ? (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={(event) => entry.open?.(event.currentTarget)}
                        {...chip}
                      >
                        {body}
                      </button>
                    ) : (
                      <span key={entry.id} {...chip}>
                        {body}
                      </span>
                    )
                  })}
                </Fragment>
              )
            })}
            {!wide && notes}
          </div>
          {wide &&
            (notes ||
              (left > 0 && (
                <span className="wiki-changes-rest" data-tail="">
                  <span data-rest="shown">{wikiText(locale, `+${left} khác`, `+${left} more`)}</span>
                </span>
              )))}
        </div>
      ) : (
        pending && (
          <div className="wiki-changes-loading" role="status">
            <span className="sr-only">{wikiText(locale, "Đang tải thay đổi", "Loading changes")}</span>
            <span />
            <span />
            <span />
            <span />
          </div>
        )
      )}
      {failed && (
        <p className="wiki-changes-failed" role="status">
          {wikiText(locale, "Chưa tải được hết ghi nhận thay đổi.", "Some patch changes could not be loaded.")}{" "}
          <button type="button" onClick={retry}>
            {wikiText(locale, "Thử lại", "Retry")}
          </button>
        </p>
      )}
    </section>
  )
}
