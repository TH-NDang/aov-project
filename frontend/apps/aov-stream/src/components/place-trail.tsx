import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { Link } from "react-router"
import { GameIcon } from "@aov/ui/components/game-icons"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import "./place-trail.css"

/** A page above the one being read, the nearest last. */
export type Place = { to: string; name: string; short?: string | null; mark?: ReactNode }

/** A page beside the one being read. */
export type Step = { to: string; name: string }

/** The sections of the bar, which every trail starts from. */
export function useSections() {
  const { text } = useStreamLocale()
  const section = (to: string, name: string, icon: "trophy-cup" | "compass"): Place => ({
    to,
    name,
    mark: <GameIcon name={icon} size={16} />,
  })
  return {
    tournaments: section("/competitions", text("Giải đấu", "Tournaments"), "trophy-cup"),
    explore: section("/explore", text("Khám phá", "Explore"), "compass"),
  }
}

/**
 * Where a page stands: the pages above it, each of which it leads to, then the page itself when its head does not name
 * it or another one can be chosen in its place. `steps` lead to the pages beside it.
 */
export function PlaceTrail({ places, current, steps }: { places: Place[]; current?: ReactNode; steps?: ReactNode }) {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  return (
    <nav className="wy" aria-label={text("Vị trí của trang", "Where this page is")}>
      <ol className="wy-trail">
        {places.map((place, at) => {
          // On a phone the section is its sign alone, the bar above already naming it, and so is a place on the way.
          const sign = compact && !!place.mark && (at === 0 || at < places.length - 1)
          return (
            <li key={at} data-sign={sign || undefined}>
              <Link to={place.to} aria-label={sign ? place.name : undefined}>
                {place.mark}
                {!sign && <span>{(compact && place.short) || place.name}</span>}
              </Link>
            </li>
          )
        })}
        {current && <li aria-current="page">{current}</li>}
      </ol>
      {steps}
    </nav>
  )
}

/** The pages before and after this one, in the order their list gives them. */
export function PlaceSteps({ label, before, after }: { label: string; before?: Step | null; after?: Step | null }) {
  const { text } = useStreamLocale()
  if (!before && !after) return null
  return (
    <div className="wy-steps" role="group" aria-label={label}>
      {before ? (
        <Link
          to={before.to}
          rel="prev"
          title={before.name}
          aria-label={text(`Trước: ${before.name}`, `Previous: ${before.name}`)}
        >
          <StreamIcon name="chevronLeft" size={16} />
          <span>{before.name}</span>
        </Link>
      ) : (
        <i aria-hidden="true">
          <StreamIcon name="chevronLeft" size={16} />
        </i>
      )}
      {after ? (
        <Link
          to={after.to}
          rel="next"
          title={after.name}
          aria-label={text(`Sau: ${after.name}`, `Next: ${after.name}`)}
        >
          <span>{after.name}</span>
          <StreamIcon name="chevronRight" size={16} />
        </Link>
      ) : (
        <i aria-hidden="true">
          <StreamIcon name="chevronRight" size={16} />
        </i>
      )}
    </div>
  )
}

/** Whether `head` has been scrolled away above the bar of the app. */
function usePassed(head: RefObject<HTMLElement | null>) {
  const [passed, setPassed] = useState(false)
  useEffect(() => {
    const element = head.current
    if (!element) return
    const bar = Number.parseFloat(getComputedStyle(element).getPropertyValue("--hub-topbar")) || 56
    const watch = new IntersectionObserver(
      ([entry]) => setPassed(!entry!.isIntersecting && entry!.boundingClientRect.bottom <= bar + 1),
      { rootMargin: `-${bar + 1}px 0px 0px 0px` },
    )
    watch.observe(element)
    return () => watch.disconnect()
  }, [head])
  return passed
}

/**
 * The head of a page once it has been scrolled away, on a wide layout: the way up, the page's own name, which goes back
 * to the top, its `tabs` and its `steps`. With tabs it stands under the head from the start and stays in reach; without
 * them it comes when the head goes.
 */
export function PlaceBar({
  head,
  places,
  name,
  mark,
  tabs,
  steps,
}: {
  head: RefObject<HTMLElement | null>
  places: Place[]
  name: string
  mark?: ReactNode
  tabs?: ReactNode
  steps?: ReactNode
}) {
  const { text } = useStreamLocale()
  const passed = usePassed(head)
  const up = places.at(-1)
  // The foot of the dark head while the head is in view; on its own it takes the colours of the page.
  const foot = !!tabs && !passed
  return (
    <div
      className={foot ? "wy-bar tn-night" : "wy-bar"}
      data-foot={foot || undefined}
      data-passed={passed || undefined}
      data-tabs={!!tabs || undefined}
    >
      <div className="wy-bar-inner">
        <div className="wy-bar-place" inert={!passed}>
          {up && (
            <Link className="wy-bar-up" to={up.to} aria-label={up.name} title={up.name}>
              {up.mark ?? (up.short || up.name)}
            </Link>
          )}
          <button
            type="button"
            title={text("Về đầu trang", "Back to the top")}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            {mark}
            <span>{name}</span>
          </button>
        </div>
        {tabs}
        {steps && (
          <div className="wy-bar-steps" inert={!passed}>
            {steps}
          </div>
        )}
      </div>
    </div>
  )
}
