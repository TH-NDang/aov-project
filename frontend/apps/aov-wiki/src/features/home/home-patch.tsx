import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { ChangeTag, ChangeTally } from "../../components/change-tag"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { patchChangeTone } from "../../lib/change-kinds"
import { patchDayLabel } from "../../lib/patch-day-label"
import { useDragScroll } from "../../lib/use-drag-scroll"
import { seasonUpdatesQuery } from "./home-api"
import { SeasonUpdates } from "./season-updates"
import { kindTally, useChangedHeroes, type ChangedHero } from "../../lib/use-changed-heroes"
import "./home-patch.css"

/** A changed hero as a small portrait card: the picture, the word for the change in its colour and the name; what changed is its tooltip. */
function HeroCard({ hero }: { hero: ChangedHero }) {
  const portrait = hero.shown?.portrait?.currentVersion?.url ?? hero.shown?.head?.currentVersion?.url
  const body = (
    <>
      <span className="wiki-home-patch-art">
        {portrait && <WikiImage className="wiki-home-patch-image" src={portrait} frameWidth={192} alt="" />}
        <span className="wiki-home-patch-tag">
          <ChangeTag kind={hero.kind} />
        </span>
        <strong>{hero.name}</strong>
      </span>
    </>
  )
  return (
    <li data-tone={patchChangeTone(hero.kind)}>{hero.to ? <Link to={hero.to}>{body}</Link> : <span>{body}</span>}</li>
  )
}

/**
 * The version in force, kept compact: one line with its day, name, how many heroes each kind of change touched and the
 * way to the notes, then every changed hero as a small portrait card, new and remade first, then stronger, weaker and
 * the rest. The cards run in one row that scrolls sideways (a swipe, or a drag with the mouse) and snaps to each card;
 * on a phone the row runs to the edges of the screen so the next card peeks in.
 */
export function HomePatch() {
  const scope = useWikiContext()
  const { locale, href, region, regions } = scope
  const updates = useQuery(seasonUpdatesQuery(scope))
  const { heroes, pending, failed, retry } = useChangedHeroes()
  const current = updates.data?.patches.find((patch) => patch.isCurrent)
  const date = current?.effectiveOn ?? current?.effectiveAt ?? ""
  const row = useDragScroll<HTMLUListElement>("horizontal")

  return (
    <section className="wiki-home-patch" aria-labelledby="wiki-home-patch-title">
      <header className="wiki-home-patch-head">
        <span className="wiki-home-patch-live">{wikiText(locale, "Đang áp dụng", "In force")}</span>
        <h2 id="wiki-home-patch-title">
          {current ? (
            <>
              {wikiText(locale, "Bản ", "Version ")}
              <LocalTime
                value={date}
                sourceTimeZone={regions.find((market) => market.code === region)?.timeZone}
                label={(zone) => patchDayLabel(date, zone)}
                fallback={current.code}
              />
            </>
          ) : (
            wikiText(locale, "Bản hiện tại", "Current version")
          )}
        </h2>
        {current?.title && <p className="wiki-home-patch-name">{current.title}</p>}
        {heroes.length > 0 && (
          <span className="wiki-home-patch-tally">
            <ChangeTally kinds={kindTally(heroes)} />
          </span>
        )}
        {current && (
          <Link className="wiki-home-patch-notes" to={href(`/updates/${current.code}`)}>
            {wikiText(locale, "Ghi chú đầy đủ", "Full notes")}
            <WikiIcon name="arrow" size={16} />
          </Link>
        )}
      </header>

      {pending ? (
        <div className="wiki-home-patch-loading" role="status">
          <span className="sr-only">{wikiText(locale, "Đang tải…", "Loading…")}</span>
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : heroes.length ? (
        <ul className="wiki-home-patch-heroes" ref={row.ref} {...row.handlers}>
          {heroes.map((hero) => (
            <HeroCard key={hero.id} hero={hero} />
          ))}
        </ul>
      ) : (
        !failed && (
          <p className="wiki-home-patch-empty">
            {wikiText(locale, "Bản này không đổi tướng nào.", "No hero changed.")}
          </p>
        )
      )}
      {failed && (
        <p className="wiki-home-patch-empty" role="status">
          {wikiText(locale, "Không tải được hết thay đổi.", "Some changes did not load.")}{" "}
          <button type="button" onClick={retry}>
            {wikiText(locale, "Thử lại", "Retry")}
          </button>
        </p>
      )}
      <SeasonUpdates />
    </section>
  )
}
