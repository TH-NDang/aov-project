import { memo, useId } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { Link } from "react-router"
import {
  groupedChanges,
  PatchChangesTitle,
  patchChangeLabel,
  patchChangeTone,
  usePatchNotesPath,
  type ChangedSubject,
} from "../../../components/patch-changes-row"
import { WikiIcon, type WikiIconName } from "../../../components/wiki-icon"
import { WikiImage } from "../../../components/wiki-image"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { changeShortWord } from "../model/change-short-word"
import "./hero-patch-board.css"

/** The mark each tone of change is drawn with: up for stronger, down for weaker, a turn for remade, a spark for new. */
const MARKS: Record<string, WikiIconName> = {
  up: "stronger",
  down: "weaker",
  rework: "remade",
  new: "spark",
  adjust: "settings",
}

/** A changed hero, with its tall portrait for the board's cards. */
export type ChangedHero = ChangedSubject & { portrait?: string }

/**
 * What the version on screen changed in the hero library: one group for each kind of change, named with its mark in
 * the colour readers know it by, and a portrait card for each hero with the same mark in the corner. The colour stays
 * in the marks and a thin line under each card, so the row reads calm. The groups sit side by side, parted by a hairline,
 * and scroll sideways when they do not fit. A hero without a profile yet is listed without a link.
 */
export const HeroPatchBoard = memo(function HeroPatchBoard({
  entries,
  pending = false,
  failed = false,
  retry,
}: {
  entries: ChangedHero[]
  /** Holds the board's place while the changes load, so the list below does not move when they arrive. */
  pending?: boolean
  failed?: boolean
  retry?: () => void
}) {
  const { locale, href } = useWikiContext()
  const titleId = useId()
  const notesPath = usePatchNotesPath()
  const compact = usePageLayout() === "compact"
  const groups = groupedChanges(entries, locale)
  const notes = notesPath && (
    <Link className="wiki-hero-patch-notes" to={href(notesPath)}>
      {wikiText(locale, "Xem ghi chú đầy đủ", "Read the full notes")}
      <WikiIcon name="arrow" size={16} />
    </Link>
  )
  if (!entries.length && !failed && !pending) return null

  return (
    <section className="wiki-hero-patch" aria-labelledby={titleId} aria-busy={pending || undefined}>
      <header className="wiki-hero-patch-head">
        <h2 id={titleId}>
          <PatchChangesTitle />
        </h2>
        {entries.length > 0 && <small>{entries.length}</small>}
        {!compact && notes}
      </header>
      {entries.length > 0 ? (
        <div className="wiki-hero-patch-lanes">
          {groups.map(({ kind, list }) => {
            const tone = patchChangeTone(kind)
            const label = patchChangeLabel(kind, locale)
            return (
              <section key={kind} className="wiki-hero-patch-lane" data-tone={tone} aria-label={label}>
                <h3 className="wiki-hero-patch-kind">
                  <WikiIcon name={MARKS[tone] ?? "settings"} size={16} />
                  {label}
                  <small>{list.length}</small>
                </h3>
                <ul>
                  {list.map((entry) => {
                    const body = (
                      <>
                        <span className="wiki-hero-patch-art">
                          {entry.portrait || entry.image ? (
                            <WikiImage frameWidth={96} src={(entry.portrait ?? entry.image)!} alt="" loading="lazy" />
                          ) : (
                            <span>{entry.name.charAt(0)}</span>
                          )}
                        </span>
                        <span className="wiki-hero-patch-mark" aria-hidden="true">
                          {changeShortWord(kind, tone)}
                        </span>
                        <span className="wiki-hero-patch-name">{entry.name}</span>
                        <span className="sr-only">, {label}</span>
                      </>
                    )
                    return (
                      <li key={entry.id}>
                        {entry.href ? (
                          <Link className="wiki-hero-patch-card" to={entry.href}>
                            {body}
                          </Link>
                        ) : (
                          <span className="wiki-hero-patch-card">{body}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
          {/* On a phone the way to the notes closes the board, where the thumb ends after reading it. */}
          {compact && notes}
        </div>
      ) : (
        pending && (
          <div className="wiki-hero-patch-loading" role="status">
            <span className="sr-only">{wikiText(locale, "Đang tải thay đổi", "Loading changes")}</span>
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="wiki-skeleton" />
            ))}
          </div>
        )
      )}
      {failed && (
        <p className="wiki-hero-patch-failed" role="status">
          {wikiText(locale, "Chưa tải được hết ghi nhận thay đổi.", "Some patch changes could not be loaded.")}{" "}
          <button type="button" onClick={retry}>
            {wikiText(locale, "Thử lại", "Retry")}
          </button>
        </p>
      )}
    </section>
  )
})
